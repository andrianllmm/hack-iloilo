import { randomInt, randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/accounts/auth", () => ({ requireRole: vi.fn() }));
// Never send real SMS, even if the developer's gateway configuration changes.
const { gatewaySend } = vi.hoisted(() => ({ gatewaySend: vi.fn() }));
vi.mock("@/lib/sms", () => ({ smsGateway: () => ({ send: gatewaySend }) }));
import * as dates from "@/lib/dates";
import { db } from "@/lib/supabase/admin";
import { findClientByPhone } from "@/modules/accounts/queries";
import { isGsm7, SMS_MAX_CHARS } from "@/modules/sms/logic";
import * as sms from "@/modules/sms/queries";
import { bookForClient } from "./actions";
import { findByRef } from "./queries";

// Opt in with an existing local Supabase environment; no database reset required.
describe.skipIf(process.env.RUN_BOOKING_SMS_DB_TESTS !== "1")(
  "booking commands through the inbound SMS router",
  () => {
    const phones = Array.from(
      { length: 3 },
      () => `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`,
    );
    const [sender, beneficiary, stranger] = phones;
    const thread = (phone = sender) => sms.smsThread(phone);
    const lastReply = async (phone = sender) =>
      (await thread(phone)).filter((m) => m.direction === "outbound").at(-1)!;
    const inbound = (body: string, phone = sender, gatewayId?: string) =>
      sms.handleInbound({ phone, body, gatewayId });
    const book = async (body = "BOOK DRY 5000 20/10", phone = sender) => {
      await inbound(body, phone);
      const reply = await lastReply(phone);
      expect(reply.body).toContain("Booking confirmed");
      const ref = /Ref ([A-Z0-9]{6})/.exec(reply.body)![1];
      return (await findByRef(ref))!;
    };

    beforeAll(() => {
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (!["localhost", "127.0.0.1"].includes(hostname))
        throw new Error("Booking integration tests require local Supabase.");
      gatewaySend.mockImplementation(async () => ({
        id: `test-${randomUUID()}`,
      }));
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      for (const [table, column] of [
        ["bookings", "booked_by_phone"],
        ["sms_messages", "phone"],
        ["clients", "phone"],
      ] as const) {
        const { error } = await db().from(table).delete().in(column, phones);
        if (error) throw error;
      }
    });

    it("books drying with the sender's identity and one GSM-7 confirmation", async () => {
      const booking = await book();
      const client = await findClientByPhone(sender);
      expect(booking).toMatchObject({
        client_id: client!.id,
        booked_by_phone: sender,
        channel: "sms",
        service: "drying",
        est_kg: 5000,
        flex_days: 0,
        status: "confirmed",
      });
      const replies = (await thread()).filter(
        (m) => m.direction === "outbound",
      );
      expect(replies).toHaveLength(1);
      expect(replies[0].body).toContain(booking.scheduled_date);
      expect(isGsm7(replies[0].body)).toBe(true);
      expect(replies[0].body.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    });

    it("registers a FOR beneficiary, books milling and confirms to both phones", async () => {
      const before = (await thread()).length;
      const booking = await book(
        `book mill 3000 20/10 ±3 FOR ${beneficiary.replace("+63", "0")}`,
      );
      const client = await findClientByPhone(beneficiary);
      expect(booking).toMatchObject({
        client_id: client!.id,
        service: "milling",
        flex_days: 3,
        booked_by_phone: sender,
      });
      expect((await lastReply(beneficiary)).body).toBe(
        (await lastReply()).body,
      );
      expect((await thread()).length).toBe(before + 2);
    });

    it("avoids duplicate confirmation for FOR the sender", async () => {
      const before = (await thread()).length;
      await book(`BOOK DRY 1 20/10 FOR ${sender}`);
      expect((await thread()).length).toBe(before + 2);
    });

    it("rejects invalid arguments and impossible dates without creating bookings", async () => {
      const count = async () => {
        const { count, error } = await db()
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("booked_by_phone", sender);
        if (error) throw error;
        return count;
      };
      const before = await count();
      for (const body of [
        "BOOK DRY 0 20/10",
        "BOOK DRY 1.5 20/10",
        "BOOK DRY 1 31/02",
        "BOOK DRY 1 20/10 ±8",
        "CANCEL ABC123 extra",
        "BOOK DRY 1 20/10 FOR invalid",
      ]) {
        await inbound(body);
        expect((await lastReply()).body).toContain("Unknown command");
      }
      expect(await count()).toBe(before);
    });

    it("resolves dates against Manila today, including year rollover", async () => {
      vi.spyOn(dates, "todayManila").mockReturnValue("2026-12-31");
      const booking = await book("BOOK MILL 100 01/01");
      expect(booking.scheduled_date).toBe("2027-01-01");
      expect(booking.preferred_date).toBe("2027-01-01");
    });

    it("does not create a second booking for a duplicate gateway delivery", async () => {
      const gatewayId = `booking-test-${randomUUID()}`;
      const before = (await thread()).length;
      await inbound("BOOK DRY 10 20/10", sender, gatewayId);
      await inbound("BOOK DRY 10 20/10", sender, gatewayId);
      expect((await thread()).length).toBe(before + 2);
    });

    it("authorizes the actual sender, not FOR, and allows the beneficiary to cancel", async () => {
      const booking = await book(`BOOK DRY 100 20/10 FOR ${beneficiary}`);
      await inbound(`CANCEL ${booking.ref} FOR ${beneficiary}`, stranger);
      expect((await lastReply(stranger)).body).toContain("Unknown command");
      expect((await findByRef(booking.ref))!.status).toBe("confirmed");
      await inbound(`cancel ${booking.ref.toLowerCase()}`, beneficiary);
      expect((await findByRef(booking.ref))!.status).toBe("cancelled");
      expect((await lastReply(beneficiary)).body).toContain(
        `${booking.ref} cancelled`,
      );
    });

    it("allows the original booker to cancel a beneficiary's booking", async () => {
      const booking = await book(`BOOK DRY 100 20/10 FOR ${beneficiary}`);
      await inbound(`CANCEL ${booking.ref}`);
      expect((await findByRef(booking.ref))!.status).toBe("cancelled");
      await inbound(`CANCEL ${booking.ref}`);
      expect((await lastReply()).body).toContain("cannot be cancelled");
    });

    it("reports unknown references", async () => {
      await inbound("CANCEL ZZZZZZ");
      expect((await lastReply()).body).toContain("No booking with ref");
    });

    it("sends staff confirmations and preserves saved bookings if SMS logging fails", async () => {
      const client = (await findClientByPhone(sender))!;
      const input = {
        clientId: client.id,
        service: "drying",
        estKg: 50,
        preferredDate: dates.todayManila(),
        flexDays: 0,
      };
      const result = await bookForClient(input);
      expect(result.status).toBe("created");
      if (result.status !== "created") throw new Error("Staff booking failed");
      expect((await lastReply()).body).toContain(result.booking.ref);
      vi.spyOn(sms, "send").mockRejectedValueOnce(
        new Error("SMS log unavailable"),
      );
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await bookForClient(input);
      expect(saved.status).toBe("created");
      if (saved.status !== "created")
        throw new Error("Saved booking reported as failed");
      expect(await findByRef(saved.booking.ref)).not.toBeNull();
      expect(errorLog).toHaveBeenCalled();
    });

    it("still confirms to the sender when beneficiary notification fails", async () => {
      const original = sms.send;
      vi.spyOn(sms, "send").mockImplementation(
        async (phone, template, vars) => {
          if (phone === beneficiary)
            throw new Error("Beneficiary SMS log unavailable");
          return original(phone, template, vars);
        },
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      const booking = await book(`BOOK DRY 100 20/10 FOR ${beneficiary}`);
      expect(booking.status).toBe("confirmed");
    });
  },
);

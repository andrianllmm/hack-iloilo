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
const { gatewaySend, extract, aiEnabled } = vi.hoisted(() => ({
  gatewaySend: vi.fn(),
  extract: vi.fn(),
  aiEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/sms", () => ({ smsGateway: () => ({ send: gatewaySend }) }));
vi.mock("@/lib/ai", () => ({ extract, aiEnabled }));
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/supabase/admin";
import { todayManila, addDays } from "@/lib/dates";
import { findOrRegisterByPhone } from "@/modules/accounts/queries";
import {
  cancelBySms,
  createBooking,
  proposeReschedule,
} from "@/modules/booking/queries";
import * as sms from "@/modules/sms/queries";
import { notify, notificationInbox, readNotifications } from "./queries";

describe.skipIf(process.env.RUN_NOTIFICATIONS_DB_TESTS !== "1")(
  "isolated staff notifications database",
  () => {
    let managerId: string;
    let encoderId: string;
    const phones: string[] = [];
    const clients: string[] = [];
    const ownEntities = new Set<string>();
    const client = async () => {
      const phone = `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
      const saved = await findOrRegisterByPhone(phone);
      phones.push(phone);
      clients.push(saved.id);
      return saved;
    };
    const event = (
      kind: "booking_created" | "sell_offer_created" = "booking_created",
    ) => {
      const entityId = `notification-test-${randomUUID()}`;
      ownEntities.add(entityId);
      return { kind, entityId, title: `Test ${kind}` };
    };
    const matching = async (entityId: string, kind?: string) => {
      let query = db().from("notifications").select().eq("entity_id", entityId);
      if (kind) query = query.eq("kind", kind);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    };
    beforeAll(async () => {
      const url = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      );
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.port !== "54421"
      )
        throw new Error(
          "Run against the isolated notifications Supabase on port 54421.",
        );
      const { data, error } = await db().from("staff").select("id, role");
      if (error) throw error;
      managerId = data.find((s) => s.role === "manager")!.id;
      encoderId = data.find((s) => s.role === "encoder")!.id;
      gatewaySend.mockImplementation(async () => ({
        id: `test-${randomUUID()}`,
      }));
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      aiEnabled.mockReturnValue(false);
      extract.mockReset();
      gatewaySend
        .mockReset()
        .mockImplementation(async () => ({ id: `test-${randomUUID()}` }));
      if (phones.length) {
        const { data, error } = await db()
          .from("sms_messages")
          .select("id")
          .in("phone", phones);
        if (error) throw error;
        for (const row of data) ownEntities.add(row.id);
      }
      if (ownEntities.size) {
        const { error } = await db()
          .from("notifications")
          .delete()
          .in("entity_id", [...ownEntities]);
        if (error) throw error;
      }
    });
    afterAll(async () => {
      if (!clients.length) return;
      for (const table of ["bookings", "sell_offers"] as const) {
        const { error } = await db()
          .from(table)
          .delete()
          .in("client_id", clients);
        if (error) throw error;
      }
      for (const table of ["sms_messages", "sms_prompts"] as const) {
        const { error } = await db().from(table).delete().in("phone", phones);
        if (error) throw error;
      }
      const { error } = await db().from("clients").delete().in("id", clients);
      if (error) throw error;
    });

    it("deduplicates concurrent writes without changing title or read state", async () => {
      const input = event();
      await Promise.all(Array.from({ length: 5 }, () => notify(input)));
      const rows = await matching(input.entityId);
      expect(rows).toHaveLength(1);
      await readNotifications(managerId, rows[0].id);
      await notify({ ...input, title: "Should not replace" });
      expect((await matching(input.entityId))[0].title).toBe(input.title);
      expect(
        (await notificationInbox(managerId)).items.find(
          (n) => n.id === rows[0].id,
        )!.read_at,
      ).not.toBeNull();
    });

    it("filters manager titles and counts, and maintains independent read state", async () => {
      const shared = event();
      const restricted = event("sell_offer_created");
      await notify(shared);
      await notify(restricted);
      const sharedId = (await matching(shared.entityId))[0].id;
      const restrictedId = (await matching(restricted.entityId))[0].id;
      const encoder = await notificationInbox(encoderId);
      expect(encoder.items.map((n) => n.id)).toEqual([sharedId]);
      expect(encoder.unreadCount).toBe(1);
      expect((await notificationInbox(managerId)).unreadCount).toBe(2);
      await readNotifications(encoderId, restrictedId);
      const { data, error } = await db()
        .from("notification_reads")
        .select()
        .eq("staff_id", encoderId)
        .eq("notification_id", restrictedId);
      if (error) throw error;
      expect(data).toEqual([]);
      await readNotifications(encoderId);
      expect((await notificationInbox(encoderId)).unreadCount).toBe(0);
      expect((await notificationInbox(managerId)).unreadCount).toBe(2);
      await readNotifications(managerId, sharedId);
      expect((await notificationInbox(managerId)).unreadCount).toBe(1);
    });

    it("counts all unread events while limiting the list to 20", async () => {
      await Promise.all(Array.from({ length: 25 }, () => notify(event())));
      const inbox = await notificationInbox(encoderId);
      expect(inbox.items).toHaveLength(20);
      expect(inbox.unreadCount).toBe(25);
      await readNotifications(encoderId);
      expect((await notificationInbox(encoderId)).unreadCount).toBe(0);
    });

    it("does not expose inbox functions or rows to public API roles", async () => {
      await notify(event("sell_offer_created"));
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      expect((await anon.from("notifications").select()).data).toEqual([]);
      expect(
        (await anon.rpc("staff_notification_inbox", { p_staff_id: managerId }))
          .error,
      ).not.toBeNull();
      expect(
        (await anon.rpc("read_staff_notifications", { p_staff_id: managerId }))
          .error,
      ).not.toBeNull();
    });

    it("creates booking and SMS cancellation events only after successful operations", async () => {
      const farmer = await client();
      const ctx = { phone: farmer.phone, client: farmer };
      const booking = await createBooking({
        clientId: farmer.id,
        channel: "sms",
        bookedByPhone: farmer.phone,
        service: "drying",
        estKg: 100,
        preferredDate: todayManila(),
        flexDays: 2,
      });
      ownEntities.add(booking.id);
      expect(await matching(booking.id, "booking_created")).toHaveLength(1);
      await cancelBySms(
        { ref: booking.ref },
        { ...ctx, phone: "+639000000000" },
      );
      expect(await matching(booking.id, "booking_cancelled")).toHaveLength(0);
      await cancelBySms({ ref: booking.ref }, ctx);
      await cancelBySms({ ref: booking.ref }, ctx);
      expect(await matching(booking.id, "booking_cancelled")).toHaveLength(1);
      const staffBooking = await createBooking({
        clientId: farmer.id,
        channel: "staff",
        bookedByPhone: farmer.phone,
        service: "milling",
        estKg: 100,
        preferredDate: todayManila(),
        flexDays: 0,
      });
      ownEntities.add(staffBooking.id);
      expect(await matching(staffBooking.id)).toHaveLength(0);
    });

    it("creates one manager-only offer event through the SMS router, including duplicate delivery", async () => {
      const farmer = await client();
      const date = todayManila().split("-");
      const gatewayId = randomUUID();
      const body = `SELL 500 RC222 ${date[2]}/${date[1]}`;
      await sms.handleInbound({ phone: farmer.phone, body, gatewayId });
      await sms.handleInbound({ phone: farmer.phone, body, gatewayId });
      const { data, error } = await db()
        .from("sell_offers")
        .select()
        .eq("client_id", farmer.id);
      if (error) throw error;
      expect(data).toHaveLength(1);
      ownEntities.add(data[0].id);
      expect(await matching(data[0].id, "sell_offer_created")).toHaveLength(1);
      expect((await notificationInbox(encoderId)).items).toEqual([]);
      expect((await notificationInbox(managerId)).items[0].href).toBe(
        "/buying",
      );
    });

    it("records separate reschedule answers by prompt, ignoring late duplicate answers", async () => {
      const farmer = await client();
      const booking = await createBooking({
        clientId: farmer.id,
        channel: "staff",
        bookedByPhone: farmer.phone,
        service: "drying",
        estKg: 100,
        preferredDate: todayManila(),
        flexDays: 2,
      });
      ownEntities.add(booking.id);
      for (const answer of ["YES", "NO"]) {
        await proposeReschedule(booking.id, addDays(todayManila(), 1));
        const { data, error } = await db()
          .from("sms_prompts")
          .select("id")
          .eq("ref", booking.ref)
          .eq("status", "open")
          .single();
        if (error) throw error;
        ownEntities.add(data.id);
        await sms.handleInbound({
          phone: farmer.phone,
          body: `${answer} ${booking.ref}`,
        });
        await sms.handleInbound({
          phone: farmer.phone,
          body: `${answer} ${booking.ref}`,
        });
        expect(
          await matching(
            data.id,
            answer === "YES" ? "reschedule_accepted" : "reschedule_declined",
          ),
        ).toHaveLength(1);
      }
    });

    it("flags unknown and malformed messages but not HELP or empty texts", async () => {
      const farmer = await client();
      for (const body of [
        "HELP",
        "  ",
        "banana unknown request",
        "BOOK DRY nope 20/10",
      ])
        await sms.handleInbound({ phone: farmer.phone, body });
      const thread = await sms.smsThread(farmer.phone);
      for (const message of thread.filter((m) => m.direction === "inbound"))
        expect(await matching(message.id, "sms_attention")).toHaveLength(
          ["HELP", "  "].includes(message.body) ? 0 : 1,
        );
    });

    it("does not flag a successful AI confirmation, but flags failed AI interpretation", async () => {
      const farmer = await client();
      aiEnabled.mockReturnValue(true);
      const date = todayManila().split("-");
      extract.mockResolvedValueOnce({
        intent: {
          command: "BOOK",
          args: {
            service: "drying",
            amount: 100,
            unit: "kg",
            dayMonth: `${date[2]}/${date[1]}`,
            flexDays: 0,
          },
        },
      });
      await sms.handleInbound({
        phone: farmer.phone,
        body: "I need drying please",
      });
      extract.mockResolvedValueOnce(null);
      await sms.handleInbound({ phone: farmer.phone, body: "Another request" });
      const inbound = (await sms.smsThread(farmer.phone)).filter(
        (m) => m.direction === "inbound",
      );
      expect(await matching(inbound[0].id, "sms_attention")).toHaveLength(0);
      expect(await matching(inbound[1].id, "sms_attention")).toHaveLength(1);
    });

    it("creates a failure alert only when sending fails, not for gateway acceptance", async () => {
      const farmer = await client();
      await sms.send(farmer.phone, "Successful test");
      gatewaySend.mockRejectedValueOnce(new Error("Gateway unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      await sms.send(farmer.phone, "Failed test");
      const outbound = (await sms.smsThread(farmer.phone)).filter(
        (m) => m.direction === "outbound",
      );
      expect(await matching(outbound[0].id)).toHaveLength(0);
      expect(await matching(outbound[1].id, "sms_failed")).toHaveLength(1);
    });
  },
);

import { existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/supabase/admin";
import {
  clientsDirectory,
  deleteClientRecord,
  findOrRegisterByPhone,
  updateClientRecord,
} from "./queries";

describe.skipIf(process.env.RUN_ACCOUNTS_DB_TESTS !== "1")(
  "local Supabase registration",
  () => {
    const phone = `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
    beforeAll(() => {
      for (const file of [".env.local", ".env"])
        if (existsSync(file)) process.loadEnvFile(file);
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (!["localhost", "127.0.0.1"].includes(hostname))
        throw new Error("Integration tests require local Supabase.");
    });
    afterAll(async () => {
      const hostname = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (["localhost", "127.0.0.1"].includes(hostname)) {
        const { error } = await db()
          .from("clients")
          .delete()
          .eq("phone", phone);
        if (error) throw error;
      }
    });
    it("supports shared-helper CRUD and preserves referenced clients", async () => {
      const owned: string[] = [];
      let bookingId: string | undefined;
      try {
        const coop = await findOrRegisterByPhone(
          `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`,
          { name: "Integration co-op", kind: "coop" },
        );
        owned.push(coop.id);
        const member = await findOrRegisterByPhone(
          `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`,
          { name: "Integration member", coop_id: coop.id },
        );
        owned.push(member.id);
        expect(
          (await clientsDirectory()).some((row) => row.id === member.id),
        ).toBe(true);
        const updated = await updateClientRecord(member.id, {
          name: "Updated integration member",
          phone: member.phone,
          kind: member.kind,
          municipality_id: null,
          coop_id: coop.id,
          buyer_type: null,
        });
        expect(updated.name).toBe("Updated integration member");
        expect(updated.id).toBe(member.id);
        await expect(deleteClientRecord(coop.id)).rejects.toThrow(
          "linked records or co-op members",
        );

        const { data: facility, error: facilityError } = await db()
          .from("facilities")
          .select("id")
          .limit(1)
          .single();
        if (facilityError) throw facilityError;
        const { data: booking, error: bookingError } = await db()
          .from("bookings")
          .insert({
            facility_id: facility.id,
            client_id: member.id,
            ref: randomInt(0, 36 ** 6)
              .toString(36)
              .toUpperCase()
              .padStart(6, "0"),
            service: "drying",
            booked_by_phone: member.phone,
            channel: "staff",
            est_kg: 100,
            preferred_date: "2026-10-20",
            scheduled_date: "2026-10-20",
          })
          .select("id")
          .single();
        if (bookingError) throw bookingError;
        bookingId = booking.id;
        await expect(deleteClientRecord(member.id)).rejects.toThrow(
          "linked records or co-op members",
        );
        const { error } = await db()
          .from("bookings")
          .delete()
          .eq("id", bookingId);
        if (error) throw error;
        bookingId = undefined;
        await deleteClientRecord(member.id);
        await deleteClientRecord(coop.id);
        expect(
          (await clientsDirectory()).some((row) => owned.includes(row.id)),
        ).toBe(false);
      } finally {
        if (bookingId) {
          const { error } = await db()
            .from("bookings")
            .delete()
            .eq("id", bookingId);
          if (error) throw error;
        }
        for (const id of owned.reverse()) {
          const { error } = await db().from("clients").delete().eq("id", id);
          if (error) throw error;
        }
      }
    });
    it("creates one row for simultaneous requests and preserves the winner", async () => {
      const results = await Promise.all([
        findOrRegisterByPhone(phone, { name: "Integration first" }),
        findOrRegisterByPhone(phone, { name: "Integration second" }),
      ]);
      expect(results[0].id).toBe(results[1].id);
      const { data, error } = await db()
        .from("clients")
        .select()
        .eq("phone", phone);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(
        (await findOrRegisterByPhone(phone, { name: "Replacement" })).name,
      ).toBe(data![0].name);
    });
  },
);

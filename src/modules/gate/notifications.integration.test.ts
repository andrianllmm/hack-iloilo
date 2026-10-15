import { existsSync } from "node:fs";
import { randomInt, randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
const { gatewaySend } = vi.hoisted(() => ({ gatewaySend: vi.fn() }));
vi.mock("@/lib/sms", () => ({ smsGateway: () => ({ send: gatewaySend }) }));
vi.mock("@/modules/setup/queries", async (original) => ({
  ...(await original<typeof import("@/modules/setup/queries")>()),
  currentFacility: vi.fn(),
}));
import { todayManila } from "@/lib/dates";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createPurchase, purchaseByBatch } from "@/modules/buying/queries";
import { purchaseText } from "@/modules/buying/logic";
import { currentFacility, type Facility } from "@/modules/setup/queries";
import * as sms from "@/modules/sms/queries";
import { dispatch, start } from "./queries";

type Tables = Database["public"]["Tables"];

describe.skipIf(process.env.RUN_GATE_SMS_DB_TESTS !== "1")(
  "local gate and batch notifications",
  () => {
    const facilityIds: string[] = [];
    const clientIds: string[] = [];
    const phones: string[] = [];
    let facility: Facility;
    let clients: Tables["clients"]["Row"][];

    async function newFacility(notifyAhead = 2) {
      const { data, error } = await db()
        .from("facilities")
        .insert({
          name: "Gate SMS integration",
          storage_capacity_kg: 100000,
          operating_hours_per_day: 8,
          notify_ahead_n: notifyAhead,
        })
        .select()
        .single();
      if (error) throw error;
      facilityIds.push(data.id);
      return data;
    }
    async function queue(
      overrides: Partial<Tables["queue_entries"]["Insert"]> = {},
    ) {
      const { data, error } = await db()
        .from("queue_entries")
        .insert({
          facility_id: facility.id,
          client_id: clients[0].id,
          service: "drying",
          status: "waiting",
          ownership: "custom",
          ...overrides,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    async function batch(overrides: Partial<Tables["batches"]["Insert"]> = {}) {
      const { data, error } = await db()
        .from("batches")
        .insert({
          facility_id: facility.id,
          client_id: clients[0].id,
          batch_no: `sms-test-${randomUUID()}`,
          ownership: "irpc",
          stage: "received",
          bags: 0,
          net_kg: 1000,
          mc: 25,
          ...overrides,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const outbound = async (phone: string) =>
      (await sms.smsThread(phone)).filter(
        (message) => message.direction === "outbound",
      );

    function failNotificationRead(
      table: "facilities" | "clients" | "dispatches",
    ) {
      const client = db();
      const original = client.from.bind(client);
      return vi.spyOn(client, "from").mockImplementation(((
        name: keyof Tables,
      ) => {
        if (name === table) throw new Error("Notification lookup unavailable");
        return original(name);
      }) as typeof client.from);
    }

    beforeAll(() => {
      for (const file of [".env.local", ".env"])
        if (existsSync(file)) process.loadEnvFile(file);
      const host = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid",
      ).hostname;
      if (!["127.0.0.1", "localhost"].includes(host))
        throw new Error("Gate notification tests require local Supabase.");
    });
    beforeEach(async () => {
      gatewaySend
        .mockReset()
        .mockImplementation(async () => ({ id: `test-${randomUUID()}` }));
      facility = await newFacility();
      vi.mocked(currentFacility).mockResolvedValue(facility);
      const { data, error } = await db()
        .from("clients")
        .insert(
          Array.from({ length: 5 }, (_, index) => ({
            name: `Gate SMS test ${index}`,
            kind: "farmer" as const,
            phone: `+639${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`,
          })),
        )
        .select();
      if (error) throw error;
      clients = data;
      clientIds.push(...data.map((client) => client.id));
      phones.push(...data.map((client) => client.phone));
      const { error: priceError } = await db().from("prices").insert({
        facility_id: facility.id,
        effective_date: todayManila(),
        buy_base_minor_per_kg: 2100,
        drying_fee_minor_per_kg: 160,
        milling_fee_minor_per_kg: 330,
        rice_minor_per_kg: 4700,
      });
      if (priceError) throw priceError;
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      if (!facilityIds.length) return;
      const { data: batches, error } = await db()
        .from("batches")
        .select("id")
        .in("facility_id", facilityIds);
      if (error) throw error;
      const ids = batches.map((row) => row.id);
      for (const table of ["dispatches", "purchases"] as const) {
        const { error } = await db().from(table).delete().in("batch_id", ids);
        if (error) throw error;
      }
      for (const table of ["batches", "queue_entries", "prices"] as const) {
        const { error } = await db()
          .from(table)
          .delete()
          .in("facility_id", facilityIds);
        if (error) throw error;
      }
      for (const [table, column, values] of [
        ["sms_messages", "phone", phones],
        ["clients", "id", clientIds],
        ["facilities", "id", facilityIds],
      ] as const) {
        const { error } = await db()
          .from(table)
          .delete()
          .in(column, [...values]);
        if (error) throw error;
      }
    });

    it("starts the batch before notifying only the next N in the same facility and service", async () => {
      const entry = await queue();
      const first = await queue({
        client_id: clients[1].id,
        checked_in_at: "2026-10-15T00:00:00Z",
      });
      const second = await queue({
        client_id: clients[2].id,
        checked_in_at: "2026-10-15T00:00:00Z",
      });
      await queue({
        client_id: clients[3].id,
        checked_in_at: "2026-10-15T00:01:00Z",
      });
      await queue({ client_id: clients[4].id, service: "milling" });
      const other = await newFacility();
      await queue({ facility_id: other.id, client_id: clients[4].id });
      const saved = await start(entry.id);
      expect(saved.queue_entry_id).toBe(entry.id);
      expect(gatewaySend).toHaveBeenCalledTimes(2);
      const expected = [first, second].sort((a, b) => a.id.localeCompare(b.id));
      for (const [index, waiting] of expected.entries()) {
        const client = clients.find(
          (client) => client.id === waiting.client_id,
        )!;
        expect(gatewaySend).toHaveBeenNthCalledWith(
          index + 1,
          client.phone,
          expect.stringContaining(`You are ${index + 1} in the waiting line`),
        );
      }
      await expect(start(entry.id)).rejects.toThrow("no longer waiting");
      expect(gatewaySend).toHaveBeenCalledTimes(2);
    });

    it("does not notify when disabled or when no clients are waiting", async () => {
      const { error } = await db()
        .from("facilities")
        .update({ notify_ahead_n: 0 })
        .eq("id", facility.id);
      if (error) throw error;
      const entry = await queue();
      const next = await queue({ client_id: clients[1].id });
      await start(entry.id);
      expect(gatewaySend).not.toHaveBeenCalled();
      const { error: enabledError } = await db()
        .from("facilities")
        .update({ notify_ahead_n: 2 })
        .eq("id", facility.id);
      if (enabledError) throw enabledError;
      await start(next.id);
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("restores waiting status without texting when batch creation fails", async () => {
      const entry = await queue();
      await queue({ client_id: clients[1].id });
      await batch({ queue_entry_id: entry.id });
      await expect(start(entry.id)).rejects.toMatchObject({ code: "23505" });
      const { data, error } = await db()
        .from("queue_entries")
        .select("status, started_at")
        .eq("id", entry.id)
        .single();
      if (error) throw error;
      expect(data).toEqual({ status: "waiting", started_at: null });
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("keeps service started and continues after an SMS logging failure", async () => {
      const entry = await queue();
      await queue({ client_id: clients[1].id });
      await queue({ client_id: clients[2].id });
      const originalSend = sms.send;
      const send = vi
        .spyOn(sms, "send")
        .mockRejectedValueOnce(new Error("SMS log unavailable"))
        .mockImplementationOnce(originalSend);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await start(entry.id);
      expect(saved.queue_entry_id).toBe(entry.id);
      expect(send).toHaveBeenCalledTimes(2);
      const { data, error } = await db()
        .from("queue_entries")
        .select("status")
        .eq("id", entry.id)
        .single();
      if (error) throw error;
      expect(data.status).toBe("serving");
      expect(gatewaySend).toHaveBeenCalledOnce();
    });

    it("texts saved purchase figures only on first save or changed amounts", async () => {
      const received = await batch();
      const first = await createPurchase(received.id);
      expect((await outbound(clients[0].phone)).map((row) => row.body)).toEqual(
        [purchaseText(first)],
      );
      expect(first).toMatchObject({
        paid_kg: 1000,
        price_minor_per_kg: 2100,
        total_minor: 2100000,
      });
      await createPurchase(received.id);
      expect(await outbound(clients[0].phone)).toHaveLength(1);
      const { error } = await db()
        .from("batches")
        .update({ net_kg: 900 })
        .eq("id", received.id);
      if (error) throw error;
      const changed = await createPurchase(received.id);
      expect(changed.id).toBe(first.id);
      expect((await outbound(clients[0].phone)).map((row) => row.body)).toEqual(
        [purchaseText(first), purchaseText(changed)],
      );
    });

    it("sends no purchase text for custom or incomplete receiving", async () => {
      const custom = await batch({ ownership: "custom" });
      await expect(createPurchase(custom.id)).rejects.toThrow(
        "only IRPC-owned",
      );
      const incomplete = await batch({ net_kg: null });
      await expect(createPurchase(incomplete.id)).rejects.toThrow("incomplete");
      expect(await purchaseByBatch(custom.id)).toBeNull();
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("preserves the purchase if notification logging fails", async () => {
      const received = await batch();
      vi.spyOn(sms, "send").mockRejectedValueOnce(
        new Error("SMS log unavailable"),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await createPurchase(received.id);
      expect((await purchaseByBatch(received.id))!.id).toBe(saved.id);
    });

    it("texts each successful partial dispatch and rejects excess kg without texting", async () => {
      const milled = await batch({ stage: "milled", rice_kg: 1000 });
      const input = {
        batchId: milled.id,
        buyerId: clients[1].id,
        kg: 400,
        priceMinorPerKg: 4700,
        orRef: "OR-123",
      };
      await dispatch(input);
      expect((await outbound(clients[1].phone))[0].body).toContain(
        `Batch ${milled.batch_no}.`,
      );
      await expect(dispatch({ ...input, kg: 700 })).rejects.toThrow(
        "Only 600 kg",
      );
      expect(gatewaySend).toHaveBeenCalledOnce();
      await dispatch({ ...input, kg: 600, orRef: "OR-124" });
      expect(await outbound(clients[1].phone)).toHaveLength(2);
      const { data, error } = await db()
        .from("batches")
        .select("stage")
        .eq("id", milled.id)
        .single();
      if (error) throw error;
      expect(data.stage).toBe("dispatched");
    });

    it("notifies an owner pickup and omits missing receipts", async () => {
      const stored = await batch({
        ownership: "custom",
        stage: "stored",
        dried_kg: 1000,
      });
      await dispatch({
        batchId: stored.id,
        buyerId: clients[0].id,
        kg: 1000,
        priceMinorPerKg: 0,
        orRef: null,
      });
      expect((await outbound(clients[0].phone))[0].body).toContain(
        `Batch ${stored.batch_no}.`,
      );
      const milled = await batch({ stage: "milled", rice_kg: 100 });
      await dispatch({
        batchId: milled.id,
        buyerId: clients[1].id,
        kg: 100,
        priceMinorPerKg: 4700,
        orRef: "  ",
      });
      expect((await outbound(clients[1].phone))[0].body).not.toMatch(
        /OR|receipt/,
      );
    });

    it("does not roll back a start when notification settings cannot be read", async () => {
      const entry = await queue();
      await queue({ client_id: clients[1].id });
      const read = failNotificationRead("facilities");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await start(entry.id);
      read.mockRestore();
      const { data, error } = await db()
        .from("queue_entries")
        .select("status")
        .eq("id", entry.id)
        .single();
      if (error) throw error;
      expect(data.status).toBe("serving");
      expect(saved.queue_entry_id).toBe(entry.id);
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("returns the saved purchase when its notification recipient cannot be read", async () => {
      const received = await batch();
      const read = failNotificationRead("clients");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await createPurchase(received.id);
      read.mockRestore();
      expect((await purchaseByBatch(received.id))!.id).toBe(saved.id);
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("returns the saved dispatch when notification details cannot be read", async () => {
      const milled = await batch({ stage: "milled", rice_kg: 100 });
      const read = failNotificationRead("dispatches");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await dispatch({
        batchId: milled.id,
        buyerId: clients[1].id,
        kg: 100,
        priceMinorPerKg: 4700,
        orRef: "OR-126",
      });
      read.mockRestore();
      const { data, error } = await db()
        .from("dispatches")
        .select("id")
        .eq("id", saved.id)
        .single();
      if (error) throw error;
      expect(data.id).toBe(saved.id);
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("keeps dispatch saved when the gateway fails and logs failed delivery", async () => {
      const milled = await batch({ stage: "milled", rice_kg: 100 });
      gatewaySend.mockRejectedValueOnce(new Error("Gateway unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const saved = await dispatch({
        batchId: milled.id,
        buyerId: clients[1].id,
        kg: 100,
        priceMinorPerKg: 4700,
        orRef: "OR-125",
      });
      const { data, error } = await db()
        .from("dispatches")
        .select("id")
        .eq("id", saved.id)
        .single();
      if (error) throw error;
      expect(data.id).toBe(saved.id);
      expect((await outbound(clients[1].phone))[0].status).toBe("failed");
    });
  },
);

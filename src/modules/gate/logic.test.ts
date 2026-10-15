import { describe, expect, it } from "vitest";
import { checkInSchema } from "./checkin-schema";
import {
  arrivalLabel,
  batchNo,
  batchOwnership,
  formatWait,
  nextBatchNo,
  queueLines,
  waitMinutes,
} from "./logic";
import type { QueueRow } from "./types";

const row = (overrides: Partial<QueueRow> = {}): QueueRow => ({
  id: "q1",
  facility_id: "f1",
  service: "drying",
  client_id: "c1",
  booking_id: null,
  offer_id: null,
  ownership: "custom",
  est_kg: 2500,
  checked_in_at: "2026-10-15T08:55:00+08:00",
  started_at: null,
  finished_at: null,
  status: "waiting",
  created_at: "",
  updated_at: "",
  client: { name: "Rodel Panes", phone: "+639172000001", kind: "farmer" },
  batch: null,
  ...overrides,
});

describe("batch numbers", () => {
  it("formats YYMMDD-NNN", () => {
    expect(batchNo("2026-10-15", 7)).toBe("261015-007");
  });
  it("starts each day at 001", () => {
    expect(nextBatchNo("2026-10-15", [])).toBe("261015-001");
    expect(nextBatchNo("2026-10-16", ["261015-004"])).toBe("261016-001");
  });
  it("continues the day's sequence numerically", () => {
    expect(nextBatchNo("2026-10-15", ["261015-002", "261015-010"])).toBe(
      "261015-011",
    );
    expect(nextBatchNo("2026-10-15", ["261015-999", "261015-1000"])).toBe(
      "261015-1001",
    );
  });
});

describe("batchOwnership", () => {
  it("derives from offers and bookings, else the check-in choice", () => {
    const entry = { offer_id: null, booking_id: null, ownership: null };
    expect(batchOwnership({ ...entry, offer_id: "o1" })).toBe("irpc");
    expect(batchOwnership({ ...entry, booking_id: "b1" })).toBe("custom");
    expect(batchOwnership({ ...entry, ownership: "irpc" })).toBe("irpc");
    expect(batchOwnership(entry)).toBe("custom");
  });
});

describe("queueLines", () => {
  it("splits by service, serving first, waiting first come first served", () => {
    const lines = queueLines([
      row({ id: "late", checked_in_at: "2026-10-15T09:50:00+08:00" }),
      row({ id: "early", checked_in_at: "2026-10-15T08:10:00+08:00" }),
      row({
        id: "serving",
        status: "serving",
        started_at: "2026-10-15T09:58:00+08:00",
      }),
      row({ id: "mill", service: "milling" }),
      row({ id: "gone", status: "left" }),
    ]);
    expect(lines.drying.serving.map((r) => r.id)).toEqual(["serving"]);
    expect(lines.drying.waiting.map((r) => r.id)).toEqual(["early", "late"]);
    expect(lines.milling.waiting.map((r) => r.id)).toEqual(["mill"]);
  });
});

describe("wait time", () => {
  it("counts whole minutes and formats hours", () => {
    const now = new Date("2026-10-15T10:20:30+08:00");
    expect(waitMinutes("2026-10-15T08:55:00+08:00", now)).toBe(85);
    expect(waitMinutes("2026-10-15T10:30:00+08:00", now)).toBe(0);
    expect(formatWait(25)).toBe("25 min");
    expect(formatWait(65)).toBe("1 h 5 min");
    expect(formatWait(120)).toBe("2 h");
  });
});

describe("arrivalLabel", () => {
  it("names how the client arrived", () => {
    expect(arrivalLabel({ booking_id: "b", offer_id: null })).toBe("Booking");
    expect(arrivalLabel({ booking_id: null, offer_id: "o" })).toBe("Offer");
    expect(arrivalLabel({ booking_id: null, offer_id: null })).toBe("Walk-in");
  });
});

describe("checkInSchema", () => {
  const input = {
    mode: "phone",
    phone: "0917 123 4567",
    service: "drying",
    ownership: "custom",
    estKg: null,
    name: "",
    kind: "farmer",
    municipality_id: null,
  };
  it("accepts a phone check-in without kg", () => {
    expect(checkInSchema.safeParse(input).success).toBe(true);
  });
  it.each([
    { phone: "12345" },
    { estKg: 0 },
    { estKg: 1.5 },
    { ownership: "sold" },
    { mode: "walkIn" },
  ])("rejects %o", (bad) => {
    expect(checkInSchema.safeParse({ ...input, ...bad }).success).toBe(false);
  });
  it("accepts a named walk-in", () => {
    expect(
      checkInSchema.safeParse({ ...input, mode: "walkIn", name: "Ana" })
        .success,
    ).toBe(true);
  });
});

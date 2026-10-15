import { describe, expect, it } from "vitest";
import { checkInSchema } from "./checkin-schema";
import {
  arrivalLabel,
  batchNo,
  batchOwnership,
  formatDay,
  formatWait,
  maskPhone,
  nextBatchNo,
  nextStage,
  normalizeRef,
  NOT_IN_LINE_REPLY,
  queueLines,
  queuePositions,
  queueStatusReply,
  recordDateNote,
  recoveryPct,
  refCheckInError,
  refLine,
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
  booking: null,
  offer: null,
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

describe("queuePositions", () => {
  const lines = queueLines([
    row({
      id: "a",
      client_id: "other",
      checked_in_at: "2026-10-15T08:00:00+08:00",
    }),
    row({
      id: "b",
      client_id: "c1",
      checked_in_at: "2026-10-15T08:30:00+08:00",
    }),
    row({
      id: "c",
      client_id: "c1",
      checked_in_at: "2026-10-15T09:30:00+08:00",
    }),
    row({
      id: "d",
      client_id: "c1",
      service: "milling",
      status: "serving",
      started_at: "2026-10-15T09:00:00+08:00",
    }),
    row({ id: "e", client_id: "c2", status: "done" }),
    row({ id: "f", client_id: "c3", service: "milling" }),
    row({
      id: "g",
      client_id: "c3",
      status: "serving",
      started_at: "2026-10-15T09:00:00+08:00",
    }),
  ]);

  it("gives the earliest waiting place per line, or serving", () => {
    expect(queuePositions(lines, "c1")).toEqual([
      { service: "drying", serving: false, position: 2 },
      { service: "milling", serving: true },
    ]);
  });

  it("prefers serving over a later waiting entry", () => {
    expect(queuePositions(lines, "c3")).toEqual([
      { service: "drying", serving: true },
      { service: "milling", serving: false, position: 1 },
    ]);
  });

  it("skips done and left entries", () => {
    expect(queuePositions(lines, "c2")).toEqual([]);
  });
});

describe("queueStatusReply", () => {
  const gsm7 = /^[A-Za-z0-9 @$_!"#%&'()*+,\-./:;<=>?\n]*$/;

  it("lists each line", () => {
    const reply = queueStatusReply([
      { service: "drying", serving: false, position: 3 },
      { service: "milling", serving: true },
    ]);
    expect(reply).toBe(
      "IRPC: Drying: you are #3 in line. Milling: being served now.",
    );
    expect(reply).toMatch(gsm7);
    expect(reply.length).toBeLessThanOrEqual(160);
  });

  it("is short when not in line", () => {
    expect(queueStatusReply([])).toBe(NOT_IN_LINE_REPLY);
    expect(NOT_IN_LINE_REPLY).toMatch(gsm7);
  });
});

describe("nextStage", () => {
  it("moves received forward through drying to stored", () => {
    expect(nextStage({ stage: "received" }, "start_drying")).toBe("drying");
    expect(nextStage({ stage: "drying" }, "finish_drying")).toBe("stored");
  });

  it("skips drying straight from received to stored", () => {
    expect(nextStage({ stage: "received" }, "skip_drying")).toBe("stored");
  });

  it("moves stored forward through milling to milled", () => {
    expect(nextStage({ stage: "stored" }, "start_milling")).toBe("milling");
    expect(nextStage({ stage: "milling" }, "finish_milling")).toBe("milled");
  });

  it("rejects an action that does not apply to the current stage", () => {
    expect(() => nextStage({ stage: "received" }, "start_milling")).toThrow();
    expect(() => nextStage({ stage: "stored" }, "start_drying")).toThrow();
    expect(() => nextStage({ stage: "drying" }, "skip_drying")).toThrow();
  });

  it("never moves backward or re-enters a finished stage", () => {
    expect(() => nextStage({ stage: "milled" }, "start_drying")).toThrow();
    expect(() => nextStage({ stage: "milled" }, "start_milling")).toThrow();
    expect(() => nextStage({ stage: "stored" }, "finish_drying")).toThrow();
  });
});

describe("recoveryPct", () => {
  it("is rice over mill-in as a percent, rounded to one decimal", () => {
    expect(recoveryPct(650, 1000)).toBe(65);
    expect(recoveryPct(673, 1000)).toBe(67.3);
    expect(recoveryPct(2, 3)).toBe(66.7);
  });

  it("is null when there is no mill-in weight yet", () => {
    expect(recoveryPct(null, null)).toBeNull();
    expect(recoveryPct(650, null)).toBeNull();
    expect(recoveryPct(650, 0)).toBeNull();
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
  it("shows the ref when the row has one", () => {
    expect(
      arrivalLabel(row({ booking_id: "b", booking: { ref: "K7P2QX" } })),
    ).toBe("K7P2QX");
    expect(arrivalLabel(row({ offer_id: "o", offer: { ref: "SELL06" } }))).toBe(
      "SELL06",
    );
  });
});

describe("ref check-in", () => {
  it("normalizes typed refs", () => {
    expect(normalizeRef(" k7p-2qx ")).toBe("K7P2QX");
    expect(normalizeRef("k7p 2qx")).toBe("K7P2QX");
  });
  it.each(["confirmed", "reschedule_proposed"] as const)(
    "lets a %s booking check in",
    (status) => {
      expect(refCheckInError({ kind: "booking", status })).toBeNull();
    },
  );
  it.each(["arrived", "cancelled", "no_show"] as const)(
    "stops a %s booking",
    (status) => {
      expect(refCheckInError({ kind: "booking", status })).toMatch(/booking/);
    },
  );
  it("lets only accepted offers check in", () => {
    expect(refCheckInError({ kind: "offer", status: "accepted" })).toBeNull();
    for (const status of [
      "offered",
      "declined",
      "arrived",
      "withdrawn",
    ] as const)
      expect(refCheckInError({ kind: "offer", status })).toMatch(/offer/);
  });
  it("takes the booking's service as custom and offers to drying as IRPC", () => {
    expect(refLine({ kind: "booking", service: "milling" })).toEqual({
      service: "milling",
      ownership: "custom",
    });
    expect(refLine({ kind: "offer" })).toEqual({
      service: "drying",
      ownership: "irpc",
    });
  });
  it("masks phones", () => {
    expect(maskPhone("+639163393390")).toBe("0916•••3390");
  });
  it("places the record date against today", () => {
    expect(formatDay("2026-10-15")).toBe("Thu, Oct 15");
    expect(recordDateNote("booking", "2026-10-15", "2026-10-15")).toBe(
      "Scheduled for today",
    );
    expect(recordDateNote("booking", "2026-10-16", "2026-10-15")).toBe(
      "Arrived 1 day early",
    );
    expect(recordDateNote("booking", "2026-10-12", "2026-10-15")).toBe(
      "Arrived 3 days late",
    );
    expect(recordDateNote("offer", "2026-10-20", "2026-10-15")).toBe(
      "Harvest date shown",
    );
  });
});

describe("checkInSchema", () => {
  const input = {
    mode: "phone",
    ref: "",
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
  it("needs only a full ref for booking and offer check-ins", () => {
    for (const mode of ["booking", "offer"]) {
      expect(
        checkInSchema.safeParse({ ...input, mode, ref: "k7p-2qx", phone: "" })
          .success,
      ).toBe(true);
      expect(
        checkInSchema.safeParse({ ...input, mode, ref: "K7P" }).success,
      ).toBe(false);
    }
  });
  it("accepts a named walk-in", () => {
    expect(
      checkInSchema.safeParse({ ...input, mode: "walkIn", name: "Ana" })
        .success,
    ).toBe(true);
  });
});

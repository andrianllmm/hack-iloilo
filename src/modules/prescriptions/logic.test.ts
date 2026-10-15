import { describe, expect, it } from "vitest";
import { isGsm7, SMS_MAX_CHARS } from "@/modules/sms/logic";
import {
  daySpan,
  fillIdle,
  type Candidate,
  type Rates,
  hashKey,
  moveBookings,
  templateNote,
  type DryerDay,
  type OpenBooking,
} from "./logic";

const CAP = 40_000;

/** Dryer days from Oct 18 with the given firm loads, kg. */
const dryer = (...loads: number[]): DryerDay[] =>
  loads.map((firmKg, i) => ({
    date: `2026-10-${18 + i}`,
    capacityKg: CAP,
    firmKg,
  }));

const booking = (
  ref: string,
  kg: number,
  date: string,
  flexDays: number,
  extra: Partial<OpenBooking> = {},
): OpenBooking => ({
  id: ref.toLowerCase(),
  ref,
  client: `Client ${ref}`,
  kg,
  scheduledDate: date,
  preferredDate: date,
  flexDays,
  status: "confirmed",
  proposedDate: null,
  ...extra,
});

describe("moveBookings", () => {
  it("clears a 30 t overflow with three flexible bookings, largest first", () => {
    // Oct 20 is 30 t over; Oct 21 has 12 t room, Oct 22 has 25 t, Oct 19 10 t.
    const days = dryer(40_000, 30_000, 70_000, 28_000, 15_000);
    const bookings = [
      booking("AAAAAA", 8_000, "2026-10-20", 2),
      booking("BBBBBB", 12_000, "2026-10-20", 3),
      booking("CCCCCC", 10_000, "2026-10-20", 1),
      booking("FIXED1", 20_000, "2026-10-20", 0),
    ];
    const [rx, ...rest] = moveBookings({
      days,
      bookings,
      today: "2026-10-18",
    });
    expect(rest).toEqual([]);
    expect(rx.title).toBe("Oct 20 is 30 t over");
    expect(rx.moves.map((m) => [m.ref, m.to])).toEqual([
      ["BBBBBB", "2026-10-21"], // 12 t, nearest later day fits exactly
      ["CCCCCC", "2026-10-19"], // 10 t, Oct 21 now full, Oct 19 fits
      ["AAAAAA", "2026-10-22"], // 8 t, ±2 reaches Oct 22
    ]);
    expect(rx.remainderKg).toBe(0);
    expect(rx.facts).toEqual({
      day: "Oct 20",
      overflow: "30 t",
      bookings_moved: 3,
      moved: "30 t",
      new_days: "Oct 19–22",
      remainder: "0 t",
    });
  });

  it("reports the remainder when flexible bookings can't clear it", () => {
    const days = dryer(39_000, 70_000, 39_000);
    const bookings = [
      booking("SMALL1", 1_000, "2026-10-19", 1),
      booking("BIGONE", 29_000, "2026-10-19", 1),
    ];
    const [rx] = moveBookings({ days, bookings, today: "2026-10-18" });
    expect(rx.moves.map((m) => m.ref)).toEqual(["SMALL1"]);
    expect(rx.remainderKg).toBe(29_000);
  });

  it("never moves into the past or off fixed bookings", () => {
    const days = dryer(0, 50_000, 40_000);
    const bookings = [booking("EARLY1", 10_000, "2026-10-19", 1)];
    expect(moveBookings({ days, bookings, today: "2026-10-19" })).toEqual([]);
  });

  it("counts bookings already asked to move on their proposed day", () => {
    const days = dryer(50_000, 30_000);
    const bookings = [
      booking("ASKED1", 10_000, "2026-10-18", 1, {
        status: "reschedule_proposed",
        proposedDate: "2026-10-19",
      }),
      booking("OTHER1", 5_000, "2026-10-18", 1),
    ];
    // The proposal already clears Oct 18 and fills Oct 19.
    expect(moveBookings({ days, bookings, today: "2026-10-18" })).toEqual([]);
  });

  it("states bookings already asked to move onto an overloaded day", () => {
    const days = dryer(40_000, 40_000);
    const bookings = [
      booking("ASKED1", 5_000, "2026-10-18", 1, {
        status: "reschedule_proposed",
        proposedDate: "2026-10-19",
      }),
      booking("FLEX01", 5_000, "2026-10-19", 2),
    ];
    const [rx] = moveBookings({ days, bookings, today: "2026-10-18" });
    expect(rx.title).toBe("Oct 19 is 5 t over");
    expect(rx.incomingKg).toBe(5_000);
    expect(rx.facts.already_asked_to_move_here).toBe("5 t");
  });

  it("gives the same key for the same inputs only", () => {
    const run = (kg: number) =>
      moveBookings({
        days: dryer(30_000, 50_000),
        bookings: [booking("AAAAAA", kg, "2026-10-19", 1)],
        today: "2026-10-18",
      })[0].key;
    expect(run(10_000)).toBe(run(10_000));
    expect(run(10_000)).not.toBe(run(9_000));
  });
});

describe("daySpan", () => {
  it("joins dates in one month or across months", () => {
    expect(daySpan(["2026-10-22"])).toBe("Oct 22");
    expect(daySpan(["2026-10-23", "2026-10-22"])).toBe("Oct 22–23");
    expect(daySpan(["2026-10-30", "2026-11-02"])).toBe("Oct 30–Nov 2");
  });
});

describe("hashKey", () => {
  it("is stable and order-sensitive", () => {
    expect(hashKey(["a", 1])).toBe(hashKey(["a", 1]));
    expect(hashKey(["a", 1])).not.toBe(hashKey([1, "a"]));
  });
});

describe("templateNote", () => {
  const rx = (bookings: OpenBooking[]) =>
    moveBookings({
      days: dryer(30_000, 70_000, 20_000),
      bookings,
      today: "2026-10-18",
    })[0];

  it("words a cleared overflow from the facts", () => {
    const p = rx([
      booking("AAAAAA", 20_000, "2026-10-19", 1),
      booking("BBBBBB", 10_000, "2026-10-19", 1),
    ]);
    expect(templateNote(p)).toBe(
      "Oct 19 is 30 t over. Moving 2 flexible bookings to Oct 18–20 clears it without turning anyone away.",
    );
  });

  it("states what is left over", () => {
    const p = rx([booking("AAAAAA", 20_000, "2026-10-19", 1)]);
    expect(templateNote(p)).toBe(
      "Oct 19 is 30 t over. Moving 1 flexible booking to Oct 20 leaves 10 t over.",
    );
  });
});

describe("fillIdle", () => {
  const rates: Rates = {
    dryingMinorPerKg: 160,
    millingMinorPerKg: 330,
    buyBaseMinorPerKg: 2100,
    buyReferenceMc: 25,
  };
  const candidate = (
    name: string,
    pastKg: number,
    municipality: string | null,
    extra: Partial<Candidate> = {},
  ): Candidate => ({
    clientId: name.toLowerCase(),
    name,
    phone: `+63917${String(pastKg).padStart(7, "0")}`,
    municipality,
    pastKg,
    kind: "farmer",
    hasOpenBooking: false,
    ...extra,
  });
  const candidates = [
    candidate("Ana", 5_000, "Pototan"),
    candidate("Ben", 12_000, "Dumangas"),
    candidate("Coop", 30_000, "Dumangas", { kind: "coop" }),
    candidate("Dina", 0, "Barotac Nuevo"),
    candidate("Eli", 0, null),
    candidate("Fe", 0, "Anilao"),
    candidate("Booked", 40_000, "Pototan", { hasOpenBooking: true }),
    candidate("Trader", 50_000, "Pototan", { kind: "trader" }),
    candidate("Buyer", 50_000, "Pototan", { kind: "buyer" }),
  ];

  it("texts farmers and co-ops with no open booking, by past volume then municipality", () => {
    const [rx, ...rest] = fillIdle({
      stretches: [{ from: "2026-10-17", to: "2026-10-19" }],
      candidates,
      rates,
      today: "2026-10-15",
    });
    expect(rest).toEqual([]);
    expect(rx.title).toBe("Oct 17–19 are idle");
    expect(rx.recipients.map((r) => r.name)).toEqual([
      "Coop",
      "Ben",
      "Ana",
      "Fe", // Anilao
      "Dina", // Barotac Nuevo
      "Eli", // no municipality last
    ]);
    expect(rx.facts).toEqual({
      days: "Oct 17–19",
      idle_days: 3,
      recipients: 6,
      municipalities: "Dumangas 2, Anilao 1, Barotac Nuevo 1, 2 more",
    });
  });

  it("drafts a GSM-7 text of at most 320 characters with today's rates", () => {
    const [rx] = fillIdle({
      stretches: [{ from: "2026-10-30", to: "2026-11-02" }],
      candidates,
      rates,
      today: "2026-10-15",
    });
    expect(rx.message).toBe(
      "IRPC: Our dryers have room Oct 30-Nov 2. Drying PHP 1.60/kg, milling PHP 3.30/kg. We buy palay at PHP 21.00/kg (25% MC). To book, text BOOK DRY <kg> <dd/mm>, e.g. BOOK DRY 5000 30/10.",
    );
    expect(isGsm7(rx.message)).toBe(true);
    expect(rx.message.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });

  it("starts a stretch tomorrow at the earliest and skips one that is over", () => {
    const rx = fillIdle({
      stretches: [
        { from: "2026-10-15", to: "2026-10-15" },
        { from: "2026-10-14", to: "2026-10-17" },
      ],
      candidates,
      rates,
      today: "2026-10-15",
    });
    expect(rx.map((p) => [p.from, p.to])).toEqual([
      ["2026-10-16", "2026-10-17"],
    ]);
  });

  it("gives no card without recipients", () => {
    expect(
      fillIdle({
        stretches: [{ from: "2026-10-17", to: "2026-10-19" }],
        candidates: [candidate("Booked", 1, null, { hasOpenBooking: true })],
        rates,
        today: "2026-10-15",
      }),
    ).toEqual([]);
  });
});

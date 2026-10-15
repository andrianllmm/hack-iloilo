import { describe, expect, it } from "vitest";
import {
  dateRange,
  dayPool,
  dryerDays,
  exact,
  headline,
  idleStretches,
} from "./logic";

const day = (load: Parameters<typeof dayPool>[0]["load"]) =>
  dayPool({
    date: "2026-10-20",
    pool: "dryer",
    load,
    capacityKg: 40_000,
    idleThresholdPct: 25,
  });

describe("dayPool", () => {
  it("flags overflow when firm load exceeds capacity", () => {
    const d = day({ confirmed: exact(38_000), offer: exact(12_000) });
    expect(d.overloaded).toBe(true);
    expect(d.overflowKg).toBe(10_000);
  });

  it("does not flag a day exactly at capacity", () => {
    const d = day({ confirmed: exact(40_000) });
    expect(d.overloaded).toBe(false);
    expect(d.overflowKg).toBe(0);
  });

  it("never flags overload from forecast alone", () => {
    const d = day({
      confirmed: exact(30_000),
      forecast: { low: 10_000, mid: 20_000, high: 30_000 },
    });
    expect(d.overloaded).toBe(false);
    expect(d.overflowKg).toBe(0);
  });

  it("marks idle when the high estimate is below the threshold", () => {
    expect(day({ confirmed: exact(9_999) }).idle).toBe(true);
    expect(day({ confirmed: exact(10_000) }).idle).toBe(false);
    expect(
      day({
        confirmed: exact(5_000),
        forecast: { low: 0, mid: 3_000, high: 6_000 },
      }).idle,
    ).toBe(false);
  });
});

describe("dryerDays", () => {
  it("sums bookings per day and fills empty days", () => {
    const days = dryerDays({
      from: "2026-10-19",
      to: "2026-10-21",
      bookings: [
        { scheduled_date: "2026-10-20", est_kg: 30_000 },
        { scheduled_date: "2026-10-20", est_kg: 20_000 },
        { scheduled_date: "2026-10-21", est_kg: 15_000 },
      ],
      capacityKg: 40_000,
      idleThresholdPct: 25,
    });
    expect(
      days.map((d) => [d.date, d.load.confirmed.mid, d.overflowKg]),
    ).toEqual([
      ["2026-10-19", 0, 0],
      ["2026-10-20", 50_000, 10_000],
      ["2026-10-21", 15_000, 0],
    ]);
    expect(days[0].idle).toBe(true);
  });
});

describe("dateRange", () => {
  it("includes both ends across a month boundary", () => {
    expect(dateRange("2026-10-31", "2026-11-02")).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("idleStretches and headline", () => {
  const days = dryerDays({
    from: "2026-10-28",
    to: "2026-11-03",
    bookings: [
      { scheduled_date: "2026-10-28", est_kg: 50_000 },
      { scheduled_date: "2026-11-02", est_kg: 20_000 },
    ],
    capacityKg: 40_000,
    idleThresholdPct: 25,
  });

  it("groups consecutive idle days across a month boundary", () => {
    expect(idleStretches(days)).toEqual([
      { from: "2026-10-29", to: "2026-11-01", days: 4 },
      { from: "2026-11-03", to: "2026-11-03", days: 1 },
    ]);
  });

  it("sums utilization and counts flagged days", () => {
    const h = headline(days);
    expect(h.expectedKg).toBe(70_000);
    expect(h.capacityKg).toBe(280_000);
    expect(h.utilizationPct).toBe(25);
    expect(h.overloaded.map((d) => d.date)).toEqual(["2026-10-28"]);
    expect(h.idleDays).toBe(5);
  });
});

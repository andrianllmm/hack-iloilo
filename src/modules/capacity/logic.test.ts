import { describe, expect, it } from "vitest";
import {
  dateRange,
  dayInputs,
  dayPool,
  dryingKwh,
  electricityBasis,
  exact,
  headline,
  idleStretches,
  plantStatus,
  poolDays,
  projectPools,
  type PoolSettings,
} from "./logic";

const settings: PoolSettings = {
  dryerKgPerDay: 40_000,
  millKgPerDay: 10_000,
  storageCapacityKg: 100_000,
  dryYieldPct: 90,
  idleThresholdPct: 25,
};

/** Projects pools over `from`–`to` with the given rows (date, kg). */
function project(input: {
  from: string;
  to: string;
  drying?: [string, number][];
  milling?: [string, number][];
  offers?: [string, number][];
  forecast?: [string, number, number, number][];
  startStockKg?: number;
  settings?: Partial<PoolSettings>;
}) {
  const rows = (r: [string, number][] = []) =>
    r.map(([date, kg]) => ({ date, kg }));
  return projectPools({
    days: dayInputs({
      from: input.from,
      to: input.to,
      drying: rows(input.drying),
      milling: rows(input.milling),
      offers: rows(input.offers),
      forecast: (input.forecast ?? []).map(([date, kgLow, kgMid, kgHigh]) => ({
        date,
        kgLow,
        kgMid,
        kgHigh,
      })),
    }),
    startStockKg: input.startStockKg ?? 0,
    settings: { ...settings, ...input.settings },
  });
}

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

describe("dryer pool", () => {
  it("sums bookings per day and fills empty days", () => {
    const days = poolDays(
      project({
        from: "2026-10-19",
        to: "2026-10-21",
        drying: [
          ["2026-10-20", 30_000],
          ["2026-10-20", 20_000],
          ["2026-10-21", 15_000],
        ],
      }),
      "dryer",
    );
    expect(
      days.map((d) => [d.date, d.load.confirmed.mid, d.overflowKg]),
    ).toEqual([
      ["2026-10-19", 0, 0],
      ["2026-10-20", 50_000, 10_000],
      ["2026-10-21", 15_000, 0],
    ]);
    expect(days[0].idle).toBe(true);
  });

  it("adds offers as firm load and the forecast as a range", () => {
    const [d] = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-20",
        drying: [["2026-10-20", 30_000]],
        offers: [["2026-10-20", 5_000]],
        forecast: [["2026-10-20", 4_000, 8_000, 12_000]],
      }),
      "dryer",
    );
    expect(d.load.offer).toEqual(exact(5_000));
    expect(d.load.forecast).toEqual({ low: 4_000, mid: 8_000, high: 12_000 });
    // 43 t expected on 40 t, but only 35 t is firm.
    expect(d.overloaded).toBe(false);
  });

  it("flags overload once offers push firm load past capacity", () => {
    const [d] = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-20",
        drying: [["2026-10-20", 30_000]],
        offers: [["2026-10-20", 12_000]],
      }),
      "dryer",
    );
    expect(d.overflowKg).toBe(2_000);
  });
});

describe("storage and mill pools", () => {
  it("stores dried IRPC palay and mills it the next day, oldest first", () => {
    const days = project({
      from: "2026-10-20",
      to: "2026-10-22",
      offers: [["2026-10-20", 20_000]],
      startStockKg: 5_000,
    });
    const storage = poolDays(days, "storage");
    const mill = poolDays(days, "mill");
    // Day 1: mill 5 t of starting stock, store 18 t from the offer.
    expect(storage[0].load.confirmed.mid).toBe(0);
    expect(storage[0].load.offer.mid).toBe(18_000);
    expect(mill[0].load.confirmed.mid).toBe(5_000);
    // Day 2: mill 10 t of the offer; day 3: the last 8 t.
    expect(storage.map((d) => d.load.offer.mid)).toEqual([18_000, 8_000, 0]);
    expect(mill.map((d) => d.load.offer.mid)).toEqual([0, 10_000, 8_000]);
  });

  it("leaves milling bookings first call on the mill", () => {
    const days = project({
      from: "2026-10-20",
      to: "2026-10-20",
      milling: [["2026-10-20", 7_000]],
      startStockKg: 50_000,
    });
    const [mill] = poolDays(days, "mill");
    const [storage] = poolDays(days, "storage");
    expect(mill.load.confirmed.mid).toBe(10_000);
    expect(storage.load.confirmed.mid).toBe(47_000);
  });

  it("dries IRPC palay only in the room bookings leave", () => {
    const [storage] = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-20",
        drying: [["2026-10-20", 35_000]],
        offers: [["2026-10-20", 10_000]],
      }),
      "storage",
    );
    expect(storage.load.offer.mid).toBe(4_500);
  });

  it("caps mill load at capacity even with stock waiting", () => {
    const mill = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-21",
        startStockKg: 80_000,
      }),
      "mill",
    );
    expect(mill.every((d) => d.load.confirmed.mid === 10_000)).toBe(true);
    expect(mill.some((d) => d.overloaded)).toBe(false);
  });

  it("flags storage overflow from firm stock", () => {
    const [storage] = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-20",
        offers: [["2026-10-20", 40_000]],
        startStockKg: 75_000,
        settings: { millKgPerDay: 0 },
      }),
      "storage",
    );
    expect(storage.load.confirmed.mid + storage.load.offer.mid).toBe(111_000);
    expect(storage.overflowKg).toBe(11_000);
  });

  it("never lets forecast stock alone overload storage", () => {
    const [storage] = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-20",
        forecast: [["2026-10-20", 20_000, 30_000, 40_000]],
        startStockKg: 90_000,
        settings: { millKgPerDay: 0 },
      }),
      "storage",
    );
    expect(storage.load.forecast).toEqual({
      low: 18_000,
      mid: 27_000,
      high: 36_000,
    });
    expect(storage.overloaded).toBe(false);
  });

  it("reports forecast mill load as a range on top of firm load", () => {
    const mill = poolDays(
      project({
        from: "2026-10-20",
        to: "2026-10-21",
        forecast: [["2026-10-20", 2_000, 4_000, 20_000]],
      }),
      "mill",
    );
    expect(mill[1].load.forecast).toEqual({
      low: 1_800,
      mid: 3_600,
      high: 10_000,
    });
    expect(mill[1].load.confirmed.mid).toBe(0);
  });
});

describe("dryingKwh", () => {
  // Two 10 t dryers and one 6 t dryer, 15 kW, 8-hour cycles, 16-hour days.
  const dryers = [
    { capacityKg: 6_000, cycleHours: 8, kw: 15 },
    { capacityKg: 10_000, cycleHours: 8, kw: 15 },
    { capacityKg: 10_000, cycleHours: 8, kw: 15 },
  ];

  it("charges a part load a full cycle", () => {
    expect(dryingKwh(1_000, dryers, 16)).toBe(120);
  });

  it("fills the largest dryers first, in whole cycles", () => {
    // 41 t: four 10 t cycles, then one 6 t cycle.
    expect(dryingKwh(41_000, dryers, 16)).toBe(600);
  });

  it("charges nothing for no load", () => {
    expect(dryingKwh(0, dryers, 16)).toBe(0);
  });
});

describe("electricityBasis", () => {
  it("uses dryer cycles and mill hours, and counts days either runs", () => {
    const days = project({
      from: "2026-10-20",
      to: "2026-10-22",
      drying: [
        ["2026-10-20", 1_000],
        ["2026-10-21", 60_000],
      ],
      milling: [["2026-10-21", 5_000]],
    });
    const basis = electricityBasis({
      days,
      dryers: [{ capacityKg: 10_000, cycleHours: 5, kw: 20 }],
      millKw: 50,
      hoursPerDay: 10,
    });
    // Dryer: one cycle (100 kWh), then both cycles the day allows (200 kWh).
    // Mill: half a day (250 kWh).
    expect(basis).toEqual({ machineKwh: 550, kg: 46_000, daysRun: 2 });
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
  const days = poolDays(
    project({
      from: "2026-10-28",
      to: "2026-11-03",
      drying: [
        ["2026-10-28", 50_000],
        ["2026-11-02", 20_000],
      ],
    }),
    "dryer",
  );

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

describe("plantStatus", () => {
  it("puts overload ahead of everything", () => {
    expect(plantStatus(day({ confirmed: exact(41_000) }))).toBe("over");
  });

  it("is near full from 85% expected load, forecast included", () => {
    expect(plantStatus(day({ confirmed: exact(33_999) }))).toBe("ok");
    expect(
      plantStatus(
        day({
          confirmed: exact(30_000),
          forecast: { low: 0, mid: 4_000, high: 8_000 },
        }),
      ),
    ).toBe("near");
  });

  it("is idle below the threshold", () => {
    expect(plantStatus(day({ confirmed: exact(5_000) }))).toBe("idle");
  });
});

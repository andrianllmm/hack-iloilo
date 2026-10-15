import { describe, expect, it } from "vitest";
import {
  assertForecastMetrics,
  byMunicipality,
  halfMonth,
  parseArrivalsCsv,
  peak,
  sumByDay,
  sumByWeek,
} from "./logic";

const HEADER = "psgc_code,date,kg_low,kg_mid,kg_high,source";

describe("parseArrivalsCsv", () => {
  it("parses rows", () => {
    const csv = `${HEADER}\n0603001000,2025-05-16,1,2,3,opa-2025\n0603001000,2026-05-16,4,5,6,demo-synthetic\n`;
    expect(parseArrivalsCsv(csv)).toEqual([
      {
        psgcCode: "0603001000",
        date: "2025-05-16",
        kgLow: 1,
        kgMid: 2,
        kgHigh: 3,
        source: "opa-2025",
      },
      {
        psgcCode: "0603001000",
        date: "2026-05-16",
        kgLow: 4,
        kgMid: 5,
        kgHigh: 6,
        source: "demo-synthetic",
      },
    ]);
  });

  it("rejects a wrong header", () => {
    expect(() => parseArrivalsCsv("a,b\n")).toThrow(/header/);
  });

  it.each([
    ["0603001000,2025-05-16,1,2,3,other", /source/],
    ["0603001000,16/05/2025,1,2,3,opa-2025", /date/],
    ["0603001000,2025-05-16,1.5,2,3,opa-2025", /whole kg/],
    ["0603001000,2025-05-16,3,2,1,opa-2025", /kg_low/],
    ["0603001000,2025-05-16,1,2,3", /6 columns/],
  ])("rejects %s", (row, error) => {
    expect(() => parseArrivalsCsv(`${HEADER}\n${row}`)).toThrow(error);
  });
});

describe("assertForecastMetrics", () => {
  const metrics = {
    trained_on: "2026-10-15",
    lags_half_months: [5, 6],
    lag_weights: [0.4, 0.6],
    lead_days: 76,
    mean_lag_days: 95.6,
    r2: { province_held_out: 0.86, municipality_half_month_held_out: 0.44 },
    band: { p10: -0.4, p90: 0.4 },
  };

  it("accepts the exported shape", () => {
    expect(() => assertForecastMetrics(metrics)).not.toThrow();
  });

  it("rejects missing accuracy", () => {
    expect(() => assertForecastMetrics({ ...metrics, r2: {} })).toThrow();
  });
});

const day = (date: string, kgMid: number) => ({
  date,
  kgLow: kgMid - 1,
  kgMid,
  kgHigh: kgMid + 1,
});

describe("sumByDay", () => {
  it("sums per day and fills missing days with zero", () => {
    expect(
      sumByDay(
        [day("2026-10-15", 5), day("2026-10-15", 3), day("2026-10-17", 2)],
        "2026-10-15",
        "2026-10-17",
      ),
    ).toEqual([
      { date: "2026-10-15", kgLow: 6, kgMid: 8, kgHigh: 10 },
      { date: "2026-10-16", kgLow: 0, kgMid: 0, kgHigh: 0 },
      { date: "2026-10-17", kgLow: 1, kgMid: 2, kgHigh: 3 },
    ]);
  });
});

describe("sumByWeek", () => {
  it("sums 7-day chunks, keeping a short last week", () => {
    const days = sumByDay(
      Array.from({ length: 9 }, (_, i) =>
        day(`2026-10-${String(15 + i).padStart(2, "0")}`, 2),
      ),
      "2026-10-15",
      "2026-10-23",
    );
    expect(sumByWeek(days)).toEqual([
      { from: "2026-10-15", to: "2026-10-21", kgLow: 7, kgMid: 14, kgHigh: 21 },
      { from: "2026-10-22", to: "2026-10-23", kgLow: 2, kgMid: 4, kgHigh: 6 },
    ]);
  });
});

describe("peak", () => {
  it("picks the highest mid estimate", () => {
    expect(peak([day("a", 1), day("b", 5), day("c", 3)])?.date).toBe("b");
  });

  it("is null when nothing is expected", () => {
    expect(peak([{ date: "a", kgLow: 0, kgMid: 0, kgHigh: 0 }])).toBeNull();
  });
});

describe("halfMonth", () => {
  it("splits on the 15th and ends on the month's last day", () => {
    expect(halfMonth("2026-10-15")).toEqual({
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(halfMonth("2028-02-20")).toEqual({
      from: "2028-02-16",
      to: "2028-02-29",
    });
  });
});

describe("byMunicipality", () => {
  it("totals per municipality with its peak half-month, largest first", () => {
    const rows = [
      { municipality: "Pototan", ...day("2026-10-14", 1) },
      { municipality: "Pototan", ...day("2026-10-20", 4) },
      { municipality: "Dingle", ...day("2026-10-02", 9) },
      { municipality: "Batad", ...day("2026-10-02", 0) },
    ];
    expect(byMunicipality(rows)).toEqual([
      {
        municipality: "Dingle",
        kgLow: 8,
        kgMid: 9,
        kgHigh: 10,
        peak: { from: "2026-10-01", to: "2026-10-15" },
      },
      {
        municipality: "Pototan",
        kgLow: 3,
        kgMid: 5,
        kgHigh: 7,
        peak: { from: "2026-10-16", to: "2026-10-31" },
      },
    ]);
  });
});

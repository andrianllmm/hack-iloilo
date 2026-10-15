import { describe, expect, it } from "vitest";
import { assertForecastMetrics, lagWeights, parseArrivalsCsv } from "./logic";

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

describe("lagWeights", () => {
  it("pairs lags with weights and days", () => {
    expect(
      lagWeights({ lags_half_months: [5, 6], lag_weights: [0.4, 0.6] }),
    ).toEqual([
      { halfMonths: 5, days: 76, weight: 0.4 },
      { halfMonths: 6, days: 91, weight: 0.6 },
    ]);
  });
});

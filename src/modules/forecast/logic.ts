// M8. Forecast: Expected arrivals from the offline-trained forecast. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

export const FORECAST_SOURCES = ["opa-2025", "demo-synthetic"] as const;
export type ForecastSource = (typeof FORECAST_SOURCES)[number];

export type ArrivalRow = {
  psgcCode: string;
  date: string;
  kgLow: number;
  kgMid: number;
  kgHigh: number;
  source: ForecastSource;
};

const HEADER = "psgc_code,date,kg_low,kg_mid,kg_high,source";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function kg(value: string, line: number): number {
  const n = Number(value);
  if (value === "" || !Number.isInteger(n) || n < 0) {
    throw new Error(`Line ${line}: "${value}" is not whole kg`);
  }
  return n;
}

/** Parses `data/forecast/out/arrivals.csv`. Throws on the first bad line. */
export function parseArrivalsCsv(text: string): ArrivalRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== HEADER) {
    throw new Error(`Expected header "${HEADER}", got "${lines[0]}"`);
  }
  return lines.slice(1).map((raw, i) => {
    const line = i + 2;
    const [psgcCode, date, low, mid, high, source, ...rest] = raw.split(",");
    if (rest.length || source === undefined) {
      throw new Error(`Line ${line}: expected 6 columns`);
    }
    if (!DATE.test(date)) throw new Error(`Line ${line}: bad date "${date}"`);
    if (!(FORECAST_SOURCES as readonly string[]).includes(source)) {
      throw new Error(`Line ${line}: unknown source "${source}"`);
    }
    const row = {
      psgcCode,
      date,
      kgLow: kg(low, line),
      kgMid: kg(mid, line),
      kgHigh: kg(high, line),
      source: source as ForecastSource,
    };
    if (row.kgLow > row.kgMid || row.kgMid > row.kgHigh) {
      throw new Error(`Line ${line}: expected kg_low ≤ kg_mid ≤ kg_high`);
    }
    return row;
  });
}

/** The parts of `metrics.json` the app shows. */
export type ForecastMetrics = {
  trained_on: string;
  data: string;
  lags_half_months: number[];
  lag_weights: number[];
  mean_lag_days: number;
  lead_days: number;
  r2: {
    province_held_out: number;
    municipality_half_month_held_out: number;
  };
  evaluation: string;
  band: { p10: number; p90: number; excludes: string };
  irpc_share: { source: string };
};

/** Throws unless `value` has the fields the forecast panel reads. */
export function assertForecastMetrics(
  value: unknown,
): asserts value is ForecastMetrics {
  const m = value as Partial<ForecastMetrics> | null;
  const ok =
    typeof m?.trained_on === "string" &&
    DATE.test(m.trained_on) &&
    Array.isArray(m.lags_half_months) &&
    Array.isArray(m.lag_weights) &&
    m.lags_half_months.length === m.lag_weights.length &&
    typeof m.lead_days === "number" &&
    typeof m.r2?.province_held_out === "number" &&
    typeof m.r2?.municipality_half_month_held_out === "number" &&
    typeof m.band?.p10 === "number" &&
    typeof m.band?.p90 === "number";
  if (!ok) throw new Error("metrics.json is missing forecast fields");
}

/** Lag weights paired with their lag in half-months and approx. days. */
export function lagWeights(
  m: Pick<ForecastMetrics, "lags_half_months" | "lag_weights">,
): { halfMonths: number; days: number; weight: number }[] {
  return m.lags_half_months.map((k, i) => ({
    halfMonths: k,
    // A half-month averages 365.25 / 24 days.
    days: Math.round((k * 365.25) / 24),
    weight: m.lag_weights[i],
  }));
}

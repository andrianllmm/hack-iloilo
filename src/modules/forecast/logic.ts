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

/** A real `YYYY-MM-DD` calendar date (rejects `2026-02-30`). */
function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

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
    if (!isDate(date)) throw new Error(`Line ${line}: bad date "${date}"`);
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
    isDate(m.trained_on) &&
    Array.isArray(m.lags_half_months) &&
    Array.isArray(m.lag_weights) &&
    m.lags_half_months.length === m.lag_weights.length &&
    typeof m.lead_days === "number" &&
    typeof m.mean_lag_days === "number" &&
    typeof m.r2?.province_held_out === "number" &&
    typeof m.r2?.municipality_half_month_held_out === "number" &&
    typeof m.band?.p10 === "number" &&
    typeof m.band?.p90 === "number";
  if (!ok) throw new Error("metrics.json is missing forecast fields");
}

/** Expected kg arriving, mid estimate with its p10–p90 range. */
export type KgRange = { kgLow: number; kgMid: number; kgHigh: number };

export type DayArrivals = KgRange & { date: string };

const DAY_MS = 86_400_000;
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

function add(a: KgRange, b: KgRange): KgRange {
  return {
    kgLow: a.kgLow + b.kgLow,
    kgMid: a.kgMid + b.kgMid,
    kgHigh: a.kgHigh + b.kgHigh,
  };
}

const ZERO: KgRange = { kgLow: 0, kgMid: 0, kgHigh: 0 };

/** Sums `rows` per day, one entry for every day from `from` to `to` (0 if none). */
export function sumByDay(
  rows: DayArrivals[],
  from: string,
  to: string,
): DayArrivals[] {
  const byDate = new Map<string, KgRange>();
  for (const r of rows) byDate.set(r.date, add(byDate.get(r.date) ?? ZERO, r));
  const days: DayArrivals[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) {
    days.push({ date: d, ...(byDate.get(d) ?? ZERO) });
  }
  return days;
}

/** Sums consecutive 7-day chunks of `days` (in date order), labelled by first and last day. */
export function sumByWeek(
  days: DayArrivals[],
): (KgRange & { from: string; to: string })[] {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      from: chunk[0].date,
      to: chunk[chunk.length - 1].date,
      ...chunk.reduce<KgRange>(add, ZERO),
    });
  }
  return weeks;
}

/** Sum of all ranges. */
export function total(ranges: KgRange[]): KgRange {
  return ranges.reduce<KgRange>(add, ZERO);
}

/** The entry with the highest mid estimate, or null if all are zero. */
export function peak<T extends KgRange>(ranges: T[]): T | null {
  let best: T | null = null;
  for (const r of ranges) if (r.kgMid > (best?.kgMid ?? 0)) best = r;
  return best;
}

/** Half-month of `date`: the 1st–15th or the 16th–end. */
export function halfMonth(date: string): { from: string; to: string } {
  const [y, m, d] = date.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  if (d <= 15) return { from: `${y}-${mm}-01`, to: `${y}-${mm}-15` };
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${mm}-16`, to: `${y}-${mm}-${last}` };
}

export type MunicipalityArrivals = KgRange & {
  municipality: string;
  /** Half-month with the most expected arrivals. */
  peak: { from: string; to: string } | null;
};

/** Totals and peak half-month per municipality, largest first; zero totals left out. */
export function byMunicipality(
  rows: (DayArrivals & { municipality: string })[],
): MunicipalityArrivals[] {
  const groups = new Map<string, Map<string, KgRange>>();
  for (const r of rows) {
    const halves = groups.get(r.municipality) ?? new Map<string, KgRange>();
    const key = halfMonth(r.date).from;
    halves.set(key, add(halves.get(key) ?? ZERO, r));
    groups.set(r.municipality, halves);
  }
  return [...groups]
    .map(([municipality, halves]) => {
      const top = peak([...halves].map(([from, kg]) => ({ from, ...kg })));
      return {
        municipality,
        ...total([...halves.values()]),
        peak: top ? halfMonth(top.from) : null,
      };
    })
    .filter((m) => m.kgMid > 0)
    .sort((a, b) => b.kgMid - a.kgMid);
}

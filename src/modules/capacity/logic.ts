// M9. Capacity: Load against capacity per day and pool. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { addDays, daysBetween } from "@/lib/dates";
import type { DayPool, Pool, Range, Source } from "./types";

export const sources = ["confirmed", "offer", "forecast"] as const;

/** Days the capacity page shows, today included. */
export const WINDOW_DAYS = 21;

const ZERO: Range = { low: 0, mid: 0, high: 0 };

/** A firm amount: low, mid and high are the same. */
export const exact = (kg: number): Range => ({ low: kg, mid: kg, high: kg });

/** Every date from `from` to `to`, both included. */
export function dateRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(n + 1, 0) }, (_, i) => addDays(from, i));
}

/**
 * One pool on one day. Overload uses firm load only (confirmed + offer, mid),
 * so a forecast alone never triggers it. Idle uses the sum of highs.
 */
export function dayPool(input: {
  date: string;
  pool: Pool;
  load?: Partial<Record<Source, Range>>;
  capacityKg: number;
  idleThresholdPct: number;
}): DayPool {
  const load = {
    confirmed: input.load?.confirmed ?? ZERO,
    offer: input.load?.offer ?? ZERO,
    forecast: input.load?.forecast ?? ZERO,
  };
  const firm = load.confirmed.mid + load.offer.mid;
  const overflowKg = Math.max(firm - input.capacityKg, 0);
  const highs = load.confirmed.high + load.offer.high + load.forecast.high;
  return {
    date: input.date,
    pool: input.pool,
    load,
    capacityKg: input.capacityKg,
    overloaded: overflowKg > 0,
    overflowKg,
    idle: highs < (input.idleThresholdPct / 100) * input.capacityKg,
  };
}

/** Booking fields the dryer pool reads. */
export type DryingBooking = { scheduled_date: string; est_kg: number };

/** Dryer pool per day from confirmed drying bookings. */
export function dryerDays(input: {
  from: string;
  to: string;
  bookings: DryingBooking[];
  capacityKg: number;
  idleThresholdPct: number;
}): DayPool[] {
  const byDate = new Map<string, number>();
  for (const b of input.bookings) {
    byDate.set(
      b.scheduled_date,
      (byDate.get(b.scheduled_date) ?? 0) + b.est_kg,
    );
  }
  return dateRange(input.from, input.to).map((date) =>
    dayPool({
      date,
      pool: "dryer",
      load: { confirmed: exact(byDate.get(date) ?? 0) },
      capacityKg: input.capacityKg,
      idleThresholdPct: input.idleThresholdPct,
    }),
  );
}

const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** `Thu, Oct 15` from a `YYYY-MM-DD` calendar date. */
export function dayLabel(date: string): string {
  return weekday.format(new Date(`${date}T00:00:00Z`));
}

const monthDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

/** `Oct 15` from a `YYYY-MM-DD` calendar date. */
export function shortDay(date: string): string {
  return monthDay.format(new Date(`${date}T00:00:00Z`));
}

/** Mid load across all sources. */
export function expectedKg(day: DayPool): number {
  return sources.reduce((sum, s) => sum + day.load[s].mid, 0);
}

/** Runs of consecutive idle days, in date order. */
export function idleStretches(
  days: DayPool[],
): { from: string; to: string; days: number }[] {
  const out: { from: string; to: string; days: number }[] = [];
  for (const d of days) {
    const last = out.at(-1);
    if (!d.idle) continue;
    if (last && addDays(last.to, 1) === d.date) {
      last.to = d.date;
      last.days++;
    } else {
      out.push({ from: d.date, to: d.date, days: 1 });
    }
  }
  return out;
}

/** Headline figures over the window. */
export function headline(days: DayPool[]): {
  expectedKg: number;
  capacityKg: number;
  /** Whole percent, or null with no capacity. */
  utilizationPct: number | null;
  overloaded: DayPool[];
  idleDays: number;
} {
  const expected = days.reduce((sum, d) => sum + expectedKg(d), 0);
  const capacity = days.reduce((sum, d) => sum + d.capacityKg, 0);
  return {
    expectedKg: expected,
    capacityKg: capacity,
    utilizationPct: capacity ? Math.round((expected / capacity) * 100) : null,
    overloaded: days.filter((d) => d.overloaded),
    idleDays: days.filter((d) => d.idle).length,
  };
}

// M8. Forecast: Expected arrivals from the offline-trained forecast. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import {
  assertForecastMetrics,
  sumByDay,
  type DayArrivals,
  type ForecastMetrics,
  type ForecastSource,
} from "./logic";

/** Metrics from the latest `pnpm import:forecast`, or null if never imported. */
export async function latestForecastMetrics(): Promise<ForecastMetrics | null> {
  const { data, error } = await db()
    .from("forecast_metrics")
    .select("metrics")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Forecast metrics: ${error.message}`);
  if (!data) return null;
  assertForecastMetrics(data.metrics);
  return data.metrics;
}

export type ArrivalRow = DayArrivals & {
  municipality: string;
  source: ForecastSource;
};

const PAGE = 1000;

/** Every forecast row from `from` to `to` (inclusive). Memoized per request. */
export const arrivalRows = cache(
  async (from: string, to: string): Promise<ArrivalRow[]> => {
    const rows: ArrivalRow[] = [];
    // PostgREST caps each response, so read in pages.
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await db()
        .from("forecast_arrivals")
        .select("date, kg_low, kg_mid, kg_high, source, municipalities(name)")
        .gte("date", from)
        .lte("date", to)
        .order("id")
        .range(start, start + PAGE - 1);
      if (error) throw new Error(`Forecast arrivals: ${error.message}`);
      for (const r of data) {
        rows.push({
          date: r.date,
          kgLow: r.kg_low,
          kgMid: r.kg_mid,
          kgHigh: r.kg_high,
          source: r.source,
          municipality: r.municipalities.name,
        });
      }
      if (data.length < PAGE) return rows;
    }
  },
);

/** Forecast kg per day from `from` to `to`, already × IRPC's share; 0 on days without rows. */
export async function expectedArrivals(
  from: string,
  to: string,
): Promise<{ date: string; kgLow: number; kgMid: number; kgHigh: number }[]> {
  return sumByDay(await arrivalRows(from, to), from, to);
}

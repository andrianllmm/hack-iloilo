// M8. Forecast: Expected arrivals from the offline-trained forecast. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { db } from "@/lib/supabase/admin";
import {
  assertForecastMetrics,
  FORECAST_SOURCES,
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

async function edgeDate(source: ForecastSource, ascending: boolean) {
  const { data, error } = await db()
    .from("forecast_arrivals")
    .select("date")
    .eq("source", source)
    .order("date", { ascending })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Forecast coverage: ${error.message}`);
  return data?.date ?? null;
}

/** Date span of imported arrivals per source; sources with no rows are left out. */
export async function forecastCoverage(): Promise<
  { source: ForecastSource; from: string; to: string }[]
> {
  const spans = await Promise.all(
    FORECAST_SOURCES.map(async (source) => ({
      source,
      from: await edgeDate(source, true),
      to: await edgeDate(source, false),
    })),
  );
  return spans.flatMap((s) =>
    s.from && s.to ? [{ source: s.source, from: s.from, to: s.to }] : [],
  );
}

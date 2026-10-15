// Loads the exported forecast (data/forecast/out) into the database (TRD M8).
// Usage: pnpm import:forecast [dir]. Reads Supabase keys from .env.local.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types.ts";
import {
  assertForecastMetrics,
  parseArrivalsCsv,
} from "../src/modules/forecast/logic.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local)",
  );
}
const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dir = process.argv[2] ?? join("data", "forecast", "out");
const rows = parseArrivalsCsv(
  await readFile(join(dir, "arrivals.csv"), "utf8"),
);
const metrics: unknown = JSON.parse(
  await readFile(join(dir, "metrics.json"), "utf8"),
);
assertForecastMetrics(metrics);

type Json =
  Database["public"]["Functions"]["import_forecast"]["Args"]["p_metrics"];

// One transaction: replaces each source's rows and records the metrics.
const { error } = await db.rpc("import_forecast", {
  p_arrivals: rows.map((r) => ({
    psgc_code: r.psgcCode,
    date: r.date,
    kg_low: r.kgLow,
    kg_mid: r.kgMid,
    kg_high: r.kgHigh,
    source: r.source,
  })),
  p_metrics: metrics as unknown as Json,
  p_trained_on: `${metrics.trained_on}T00:00:00+08:00`,
});
if (error) throw new Error(`Import failed, nothing written: ${error.message}`);

const bySource = Object.groupBy(rows, (r) => r.source);
for (const [source, list] of Object.entries(bySource)) {
  console.log(`${source}: ${list!.length} rows`);
}
console.log(`Metrics trained on ${metrics.trained_on}`);

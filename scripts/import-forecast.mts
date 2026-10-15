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

const BATCH = 1000;

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

const { data: municipalities, error } = await db
  .from("municipalities")
  .select("id, psgc_code");
if (error) throw new Error(`Municipalities: ${error.message}`);
const idByCode = new Map(municipalities.map((m) => [m.psgc_code, m.id]));
const unknown = [...new Set(rows.map((r) => r.psgcCode))].filter(
  (code) => !idByCode.has(code),
);
if (unknown.length) {
  throw new Error(`Unknown municipalities: ${unknown.join(", ")}`);
}

const records = rows.map((r) => ({
  municipality_id: idByCode.get(r.psgcCode)!,
  date: r.date,
  kg_low: r.kgLow,
  kg_mid: r.kgMid,
  kg_high: r.kgHigh,
  source: r.source,
}));
for (let i = 0; i < records.length; i += BATCH) {
  const { error } = await db
    .from("forecast_arrivals")
    .upsert(records.slice(i, i + BATCH), {
      onConflict: "source,municipality_id,date",
    });
  if (error) throw new Error(`Arrivals: ${error.message}`);
}

const { error: metricsError } = await db.from("forecast_metrics").insert({
  trained_on: `${metrics.trained_on}T00:00:00+08:00`,
  metrics:
    metrics as unknown as Database["public"]["Tables"]["forecast_metrics"]["Insert"]["metrics"],
});
if (metricsError) throw new Error(`Metrics: ${metricsError.message}`);

const bySource = Object.groupBy(rows, (r) => r.source);
for (const [source, list] of Object.entries(bySource)) {
  console.log(`${source}: ${list!.length} rows`);
}
console.log(`Metrics trained on ${metrics.trained_on}`);

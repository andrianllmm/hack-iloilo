// M7. Pricing and Cost: Prices, batch cost, electricity per kg. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { todayManila } from "@/lib/dates";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { purchaseCost } from "@/modules/buying/queries";
import { currentFacility } from "@/modules/setup/queries";
import { type BatchCost, batchCost as computeBatchCost } from "./logic";

export type Prices = Database["public"]["Tables"]["prices"]["Row"];

/**
 * The price row in effect on `date`: the latest `effective_date <= date`, and
 * among saves sharing that date, the most recently saved one.
 */
export async function priceOn(date: string): Promise<Prices> {
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("prices")
    .select()
    .eq("facility_id", facility.id)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    // PGRST116: the .single() query matched no row.
    if (error.code === "PGRST116") throw new Error(`No prices on ${date}`);
    throw new Error(`Prices on ${date}: ${error.message}`);
  }
  return data;
}

/** Hours between two timestamps, or 0 if either is missing (stage not run). */
function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

/**
 * A batch's direct cost and margin (TRD M7). Reads the batch's stage
 * timestamps and the rated power of the dryer and mill it used, the facility's
 * tariff and labor rate, and today's fees; nets dispatches against the M5
 * purchase cost for IRPC-owned palay. Manager-only — gate the caller.
 */
export async function batchCost(batchId: string): Promise<BatchCost> {
  const { data: batch, error } = await db()
    .from("batches")
    .select(
      "ownership, net_kg, mill_in_kg, dry_start, dry_end, mill_start, mill_end, dryer:machines!batches_dryer_id_fkey(rated_kw), mill:machines!batches_mill_id_fkey(rated_kw), dispatches(kg, price_minor_per_kg)",
    )
    .eq("id", batchId)
    .single();
  if (error) throw new Error(`Batch cost: ${error.message}`);

  const facility = await currentFacility();
  const prices = await priceOn(todayManila());
  const dispatchRevenueMinor = batch.dispatches.reduce(
    (sum, d) => sum + d.kg * d.price_minor_per_kg,
    0,
  );
  const purchaseCostMinor = await purchaseCost(batchId);

  return computeBatchCost({
    ownership: batch.ownership,
    dryHours: hoursBetween(batch.dry_start, batch.dry_end),
    millHours: hoursBetween(batch.mill_start, batch.mill_end),
    dryerRatedKw: batch.dryer?.rated_kw ?? 0,
    millRatedKw: batch.mill?.rated_kw ?? 0,
    tariffMinorPerKwh: facility.tariff_minor_per_kwh,
    laborMinorPerHour: facility.labor_minor_per_hour,
    netKg: batch.net_kg ?? 0,
    millInKg: batch.mill_in_kg ?? 0,
    dryingFeeMinorPerKg: prices.drying_fee_minor_per_kg,
    millingFeeMinorPerKg: prices.milling_fee_minor_per_kg,
    dispatchRevenueMinor,
    purchaseCostMinor,
  });
}

/** Every price save, newest first, for the history view. */
export async function listPrices(): Promise<Prices[]> {
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("prices")
    .select()
    .eq("facility_id", facility.id)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Prices: ${error.message}`);
  return data;
}

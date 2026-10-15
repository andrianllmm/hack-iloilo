// M7. Pricing and Cost: Prices, batch cost, electricity per kg. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { currentFacility } from "@/modules/setup/queries";

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

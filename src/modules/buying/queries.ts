// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { newRef } from "@/lib/ref";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { currentFacility } from "@/modules/setup/queries";
import type { CreateOfferInput } from "./logic";

export type Offer = Database["public"]["Tables"]["sell_offers"]["Row"];
export type OfferStatus = Database["public"]["Enums"]["sell_offer_status"];

/**
 * Create a sell offer in `offered` status with a fresh ref. Server-only (not a
 * server action) so it has no HTTP endpoint: the staff form authorizes in its
 * action before calling this, and the SMS `SELL` command (#41) reuses it the
 * same way. Offers are inert until a manager accepts.
 */
export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  const facility = await currentFacility();

  // ref is unique; retry the rare collision with a new one.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db()
      .from("sell_offers")
      .insert({
        facility_id: facility.id,
        ref: newRef(),
        client_id: input.clientId,
        booked_by_phone: input.bookedByPhone,
        variety_id: input.varietyId,
        est_kg: input.estKg,
        harvest_date: input.harvestDate,
      })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== "23505")
      throw new Error(`Create offer: ${error.message}`);
  }
  throw new Error("Create offer: could not allocate a unique ref.");
}

/** An offer joined with its client and variety, for the buying list. */
export type OfferListItem = Offer & {
  client: { name: string; phone: string } | null;
  variety: { code: string; name: string } | null;
};

/** The single offer with this ref, or null. Refs are globally unique. */
export async function findOfferByRef(ref: string): Promise<Offer | null> {
  const { data, error } = await db()
    .from("sell_offers")
    .select()
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`Offer by ref: ${error.message}`);
  return data;
}

/**
 * Accepted offers with a harvest date in `[from, to]`, by harvest date.
 * Used by capacity (#33) as expected arrivals.
 */
export async function acceptedOffersBetween(
  from: string,
  to: string,
): Promise<Offer[]> {
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("sell_offers")
    .select()
    .eq("facility_id", facility.id)
    .eq("status", "accepted")
    .gte("harvest_date", from)
    .lte("harvest_date", to)
    .order("harvest_date");
  if (error) throw new Error(`Accepted offers: ${error.message}`);
  return data;
}

/** Offers for the current facility by harvest date, optionally filtered by status. */
export async function listOffers(
  status?: OfferStatus,
): Promise<OfferListItem[]> {
  const facility = await currentFacility();
  let query = db()
    .from("sell_offers")
    .select("*, client:clients(name, phone), variety:varieties(code, name)")
    .eq("facility_id", facility.id);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("harvest_date");
  if (error) throw new Error(`Offers: ${error.message}`);
  return data;
}

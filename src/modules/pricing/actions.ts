"use server";

// M7. Pricing and Cost: Prices, batch cost, electricity per kg. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/admin";
import { requireRole } from "@/modules/accounts/auth";
import { currentFacility } from "@/modules/setup/queries";
import { parsePriceForm } from "./logic";

export type PriceFormState =
  | { ok: true; effectiveDate: string }
  | { ok: false; error: string }
  | undefined;

/**
 * Save the manager's prices for an effective date. Manager only.
 * Every save appends a row, so History shows each change; priceOn reads the
 * newest save on or before a date.
 */
export async function savePrice(
  _prev: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  await requireRole("manager");

  const parsed = parsePriceForm(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  const facility = await currentFacility();
  const { error } = await db().from("prices").insert({
    facility_id: facility.id,
    effective_date: v.effectiveDate,
    buy_base_minor_per_kg: v.buyBaseMinorPerKg,
    buy_rules: v.buyRules,
    drying_fee_minor_per_kg: v.dryingFeeMinorPerKg,
    milling_fee_minor_per_kg: v.millingFeeMinorPerKg,
    rice_minor_per_kg: v.riceMinorPerKg,
  });
  if (error) return { ok: false, error: `Save prices: ${error.message}` };

  revalidatePath("/prices");
  return { ok: true, effectiveDate: v.effectiveDate };
}

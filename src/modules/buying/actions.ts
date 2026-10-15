"use server";

// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/admin";
import { requireRole } from "@/modules/accounts/auth";
import { parseOfferForm } from "./logic";
import { createOffer } from "./queries";

export type OfferFormState =
  { ok: true; ref: string } | { ok: false; error: string } | undefined;

/** Form action for the staff offer form. Any signed-in staff may record an offer. */
export async function submitOffer(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  await requireRole();

  const parsed = parseOfferForm(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const offer = await createOffer(parsed.value);
  revalidatePath("/buying");
  return { ok: true, ref: offer.ref };
}

/** Accept or decline an offer. Manager only. Only an `offered` offer can be decided. */
export async function decideOffer(id: string, accept: boolean): Promise<void> {
  await requireRole("manager");
  const { error } = await db()
    .from("sell_offers")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id)
    .eq("status", "offered");
  if (error) throw new Error(`Decide offer: ${error.message}`);
  revalidatePath("/buying");
}

/** Withdraw an offer. Available to any signed-in staff. Only from `offered`. */
export async function withdrawOffer(id: string): Promise<void> {
  await requireRole();
  const { error } = await db()
    .from("sell_offers")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("status", "offered");
  if (error) throw new Error(`Withdraw offer: ${error.message}`);
  revalidatePath("/buying");
}

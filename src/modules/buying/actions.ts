"use server";

// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/admin";
import { requireRole } from "@/modules/accounts/auth";
import { applyOverride, parseOfferForm, parseOverrideForm } from "./logic";
import { createOffer, purchaseByBatch } from "./queries";

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

export type VoucherResult = { ok: true } | { ok: false; error: string };

/**
 * Sets (or clears) the voucher number on a batch's purchase, recorded after
 * the receiving is priced. Any signed-in staff may add it.
 */
export async function setVoucherRef(
  batchId: string,
  ref: string,
): Promise<VoucherResult> {
  await requireRole();
  const trimmed = ref.trim();
  const { error } = await db()
    .from("purchases")
    .update({ voucher_ref: trimmed === "" ? null : trimmed })
    .eq("batch_id", batchId);
  if (error) return { ok: false, error: "Couldn't save the voucher number." };
  revalidatePath(`/batches/${batchId}`);
  return { ok: true };
}

export type OverrideResult = { ok: true } | { ok: false; error: string };

/**
 * Overrides a purchase's price per kg with a required reason. Manager only.
 * The original computed price is preserved in `deductions`; the total is
 * recomputed as paid kg × the new price.
 */
export async function overridePrice(
  batchId: string,
  priceInput: string,
  reason: string,
): Promise<OverrideResult> {
  await requireRole("manager");

  const parsed = parseOverrideForm({ priceMinorPerKg: priceInput, reason });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const purchase = await purchaseByBatch(batchId);
  if (!purchase) return { ok: false, error: "No purchase to override." };

  const update = applyOverride(
    {
      paidKg: purchase.paid_kg,
      priceMinorPerKg: purchase.price_minor_per_kg,
      deductions: purchase.deductions as Record<string, number>,
    },
    parsed.value,
  );

  const { error } = await db()
    .from("purchases")
    .update({
      price_minor_per_kg: update.priceMinorPerKg,
      total_minor: update.totalMinor,
      deductions: update.deductions,
      override_reason: update.overrideReason,
    })
    .eq("batch_id", batchId);
  if (error) return { ok: false, error: "Couldn't save the override." };
  revalidatePath(`/batches/${batchId}`);
  return { ok: true };
}

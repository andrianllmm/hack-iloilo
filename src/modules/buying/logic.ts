// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { z } from "zod";
import { formatKg, formatMoneySms } from "@/lib/format";

type PurchasePrice = {
  paid_kg: number;
  price_minor_per_kg: number;
  total_minor: number;
};

/** Notify on the first save or when the farmer's displayed price details change. */
export function purchasePriceChanged(
  before: PurchasePrice | null,
  saved: PurchasePrice,
): boolean {
  return (
    !before ||
    before.paid_kg !== saved.paid_kg ||
    before.price_minor_per_kg !== saved.price_minor_per_kg ||
    before.total_minor !== saved.total_minor
  );
}

export function purchaseText(saved: PurchasePrice): string {
  return `IRPC: Palay purchase recorded. Paid weight: ${formatKg(saved.paid_kg)} at ${formatMoneySms(saved.price_minor_per_kg)}/kg. Total: ${formatMoneySms(saved.total_minor)}.`;
}

/** Validated input for a new sell offer. Weight is integer kg. */
export type CreateOfferInput = {
  clientId: string;
  varietyId: string | null;
  estKg: number;
  harvestDate: string;
  bookedByPhone: string;
};

// Matches clients.phone in the schema: E.164, 8–15 digits, no leading zero.
const phone = z.string().regex(/^\+[1-9][0-9]{7,14}$/);
// Calendar date in Manila, stored as `date`.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Invalid date");

// IDs are only checked for presence here; the foreign keys enforce that the
// client and variety actually exist. (Seed UUIDs are not RFC-version-compliant.)
const offerForm = z.object({
  clientId: z.string().min(1),
  // A blank select means "no variety yet".
  varietyId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  estKg: z.coerce.number().int().positive(),
  harvestDate: isoDate,
  bookedByPhone: phone,
});

export type ParseResult =
  { ok: true; value: CreateOfferInput } | { ok: false; error: string };

/** Parse and validate raw sell-offer form values from untrusted input. */
export function parseOfferForm(raw: Record<string, unknown>): ParseResult {
  const parsed = offerForm.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Check the offer details and try again." };
  }
  return { ok: true, value: parsed.data };
}

// --- SMS command parsing (M5). Still pure; the registry validates with the
// schema and the queries resolve the variety and harvest date server-side. ---

/** `QUOTE <mc>% [<kg>]`. MC is a percentage (`numeric(4,1)`), kg is whole kg. */
export const quoteSmsSchema = z.object({
  mc: z.number().positive().max(99.9),
  kg: z.number().int().positive().optional(),
});
export type QuoteSmsInput = z.infer<typeof quoteSmsSchema>;

/** Tokens after `QUOTE`: `<mc>%` and an optional `<kg>`. The `%` is optional. */
export function parseQuoteArgs(args: string[]): unknown {
  if (args.length < 1 || args.length > 2) return null;
  const [mcRaw, kgRaw] = args;
  const mcToken = mcRaw.replace(/%$/, "");
  if (!/^\d+(\.\d+)?$/.test(mcToken)) return null;
  if (kgRaw !== undefined && !/^\d+$/.test(kgRaw)) return null;
  return {
    mc: Number(mcToken),
    kg: kgRaw === undefined ? undefined : Number(kgRaw),
  };
}

/** `SELL <kg> <variety> <dd/mm>`. The variety code resolves to an id server-side. */
export const sellSmsSchema = z.object({
  estKg: z.number().int().positive(),
  varietyCode: z.string().min(1),
  dayMonth: z.string().regex(/^\d{1,2}\/\d{1,2}$/),
});
export type SellSmsInput = z.infer<typeof sellSmsSchema>;

/** Tokens after `SELL`: `<kg> <variety> <dd/mm>`, in that order. */
export function parseSellArgs(args: string[]): unknown {
  if (args.length !== 3) return null;
  const [kg, variety, dayMonth] = args;
  if (!/^\d+$/.test(kg)) return null;
  return { estKg: Number(kg), varietyCode: variety.toUpperCase(), dayMonth };
}

/**
 * The `VARIETIES` reply: the total count, the known variety codes in the order
 * given, and a reminder of the `SELL` format. The count is the full total even
 * when the list is cut, so a farmer can tell there are more than shown. If the
 * whole reply would exceed `maxChars` (the SMS limit, passed in to keep this
 * pure), the list is cut to the codes that fit with a trailing `…`.
 */
export function formatVarietiesSms(codes: string[], maxChars: number): string {
  if (codes.length === 0)
    return "IRPC rice varieties: none yet. To sell: SELL <kg> <variety> <dd/mm>";
  const prefix = `IRPC rice varieties (${codes.length}): `;
  const suffix = ". To sell: SELL <kg> <variety> <dd/mm>";

  const full = `${prefix}${codes.join(", ")}${suffix}`;
  if (full.length <= maxChars) return full;

  // Over the limit: keep as many codes as fit alongside a trailing ellipsis.
  const kept: string[] = [];
  for (const code of codes) {
    const candidate = `${prefix}${[...kept, code].join(", ")} …${suffix}`;
    if (candidate.length > maxChars) break;
    kept.push(code);
  }
  return `${prefix}${kept.join(", ")} …${suffix}`;
}

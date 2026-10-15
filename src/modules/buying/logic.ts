// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { z } from "zod";

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

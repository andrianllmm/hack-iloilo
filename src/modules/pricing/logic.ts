// M7. Pricing and Cost: Prices, batch cost, electricity per kg. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { z } from "zod";

/** The MC adjustment rule. Only the TRD default exists until IRPC confirms. */
export type McRule = "proportional";

/** Deduction factors, sack weight and the MC rule, stored as `prices.buy_rules`. */
export type BuyRules = {
  damaged: number;
  immature: number;
  foreign: number;
  sack_kg: number;
  mc_rule: McRule;
};

/** Validated price row from the manager's form. Money is integer centavos. */
export type PriceInput = {
  effectiveDate: string;
  buyBaseMinorPerKg: number;
  dryingFeeMinorPerKg: number;
  millingFeeMinorPerKg: number;
  riceMinorPerKg: number;
  buyRules: BuyRules;
};

// Not set in the form: sack weight per TRD, and the only confirmed MC rule.
const SACK_KG = 0.1;
const MC_RULE: McRule = "proportional";

// Calendar date in Manila, stored as `date`.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Invalid date");

// A required number field: reject a blank so an empty input never reads as 0.
const number = z.string().trim().min(1).pipe(z.coerce.number());

// Peso amount typed by the manager, stored as integer centavos.
const pesos = number
  .pipe(z.number().nonnegative())
  .transform((p) => Math.round(p * 100));

// A kg deduction factor: a fraction of the affected weight, 0..1.
const factor = number.pipe(z.number().min(0).max(1));

const priceForm = z.object({
  effectiveDate: isoDate,
  buyBase: pesos,
  damaged: factor,
  immature: factor,
  foreign: factor,
  rice: pesos,
  drying: pesos,
  milling: pesos,
});

export type PriceParseResult =
  { ok: true; value: PriceInput } | { ok: false; error: string };

// Field labels for error messages, keyed by the form field name.
const FIELD_LABELS: Record<string, string> = {
  effectiveDate: "effective date",
  buyBase: "palay buying base",
  damaged: "damaged deduction",
  immature: "immature deduction",
  foreign: "foreign deduction",
  rice: "rice selling price",
  drying: "drying fee",
  milling: "milling fee",
};

/** Parse and validate raw price-form values from untrusted input. */
export function parsePriceForm(raw: Record<string, unknown>): PriceParseResult {
  const parsed = priceForm.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const label = typeof field === "string" ? FIELD_LABELS[field] : undefined;
    return {
      ok: false,
      error: label
        ? `Check the ${label} and try again.`
        : "Check the price details and try again.",
    };
  }
  const v = parsed.data;
  return {
    ok: true,
    value: {
      effectiveDate: v.effectiveDate,
      buyBaseMinorPerKg: v.buyBase,
      dryingFeeMinorPerKg: v.drying,
      millingFeeMinorPerKg: v.milling,
      riceMinorPerKg: v.rice,
      buyRules: {
        damaged: v.damaged,
        immature: v.immature,
        foreign: v.foreign,
        sack_kg: SACK_KG,
        mc_rule: MC_RULE,
      },
    },
  };
}

/**
 * The price row in effect on `today`, from rows sorted newest effective date
 * first: the first row with `effective_date <= today`. Shared by the page
 * prefill and the History "In effect" tag.
 */
export function livePrice<T extends { effective_date: string }>(
  rows: T[],
  today: string,
): T | undefined {
  return rows.find((p) => p.effective_date <= today);
}

/** Inputs for the shared electricity cost basis. Energy in kWh, money in centavos. */
export type ElectricityInput = {
  /** Metered machine energy over the run, in kWh. */
  machineKwh: number;
  /** Palay throughput the cost is spread over, in kg. */
  kg: number;
  /** Days the facility ran, for the base-load term. */
  daysRun: number;
  /** Facility base load drawn whenever it runs, in kW. */
  baseLoadKw: number;
  /** Operating hours per day, for the base-load term. */
  hoursPerDay: number;
  /** Electricity tariff, in centavos per kWh. */
  tariffMinorPerKwh: number;
};

/**
 * Electricity cost per kg, in centavos. Base load is added over the whole run,
 * not split per batch (TRD M7). M9's headline and M10's full-load plan share this.
 */
export function electricityPerKg({
  machineKwh,
  kg,
  daysRun,
  baseLoadKw,
  hoursPerDay,
  tariffMinorPerKwh,
}: ElectricityInput): number {
  if (kg <= 0) {
    throw new Error("electricityPerKg: kg must be positive");
  }
  const totalKwh = machineKwh + baseLoadKw * hoursPerDay * daysRun;
  return Math.round((totalKwh * tariffMinorPerKwh) / kg);
}

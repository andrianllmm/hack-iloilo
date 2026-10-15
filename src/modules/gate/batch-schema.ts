import { z } from "zod";

/** A `timestamptz` picked at the gate (Manila, with offset). */
const timestamp = z.iso.datetime({ offset: true });

/** Whole kilograms on the scale. */
const kg = z
  .number("Enter the weight in kg.")
  .int("Enter whole kilograms.")
  .positive("Enter more than 0 kg.");

/** Moisture content, `numeric(4,1)` between 0 and 100. */
const mc = z
  .number("Enter the moisture content.")
  .min(0, "Moisture can't be negative.")
  .max(100, "Moisture can't exceed 100%.");

/** Start drying: which dryer and when it went in. */
export const startDryingSchema = z.object({
  dryer_id: z.guid("Choose a dryer."),
  dry_start: timestamp,
});
export type StartDryingInput = z.infer<typeof startDryingSchema>;

/** Finish drying: when it came out, moisture out, and dried weight. */
export const finishDryingSchema = z.object({
  dry_end: timestamp,
  mc_out: mc,
  dried_kg: kg,
});
export type FinishDryingInput = z.infer<typeof finishDryingSchema>;

/** Start milling: which mill and when it started. */
export const startMillingSchema = z.object({
  mill_id: z.guid("Choose a mill."),
  mill_start: timestamp,
});
export type StartMillingInput = z.infer<typeof startMillingSchema>;

/** Finish milling: when it ended, weights in and out, and by-products. */
export const finishMillingSchema = z
  .object({
    mill_end: timestamp,
    mill_in_kg: kg,
    rice_kg: kg,
    bran_kg: z
      .number()
      .int("Enter whole kilograms.")
      .nonnegative("Weight can't be negative.")
      .nullable(),
    husk_kg: z
      .number()
      .int("Enter whole kilograms.")
      .nonnegative("Weight can't be negative.")
      .nullable(),
  })
  .refine((value) => value.rice_kg <= value.mill_in_kg, {
    path: ["rice_kg"],
    message: "Rice can't weigh more than what went into the mill.",
  });
export type FinishMillingInput = z.infer<typeof finishMillingSchema>;

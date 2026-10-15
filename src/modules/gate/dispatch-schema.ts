import { z } from "zod";

/**
 * Records one dispatch from a batch: a sale to a buyer, or a pickup by the
 * owner (price 0, buyer set to the owner). The caller checks the kg against
 * what's left; the schema only validates the shape.
 */
export const dispatchSchema = z.object({
  buyerId: z.guid("Choose a buyer."),
  kg: z
    .number("Enter the weight in kg.")
    .int("Enter whole kilograms.")
    .positive("Enter more than 0 kg."),
  priceMinorPerKg: z
    .number("Enter the price per kg.")
    .int()
    .nonnegative("Price can't be negative."),
  orRef: z.string().trim().max(50, "Keep the receipt number short.").nullable(),
});
export type DispatchInput = z.infer<typeof dispatchSchema>;

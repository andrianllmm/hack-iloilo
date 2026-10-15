import { z } from "zod";
import { buyerTypes, normalizePhone } from "@/modules/accounts/logic";
import { isRealDate } from "./logic";

/**
 * Public rice request from /buy. The pickup range (today to 30 days ahead) is
 * checked on the server against Manila today, as on /sell.
 */
export const webOrderSchema = z.object({
  name: z.string().trim().min(1, "Enter your name or your store's name."),
  phone: z
    .string()
    .refine(
      (value) => normalizePhone(value) !== null,
      "Enter a valid Philippine mobile number.",
    ),
  buyerType: z.enum(buyerTypes, "Choose what kind of buyer you are."),
  kg: z.coerce
    .number("Enter the kg of rice.")
    .int("Enter whole kilograms.")
    .positive("Enter more than 0 kg."),
  pickupDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a pickup date.")
    .refine(isRealDate, "Choose a real date."),
});
export type WebOrderFormValues = z.input<typeof webOrderSchema>;
export type WebOrderInput = z.output<typeof webOrderSchema>;

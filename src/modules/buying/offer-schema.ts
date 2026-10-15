import { z } from "zod";
import { normalizePhone } from "@/modules/accounts/logic";
import { offerForm } from "./logic";

/**
 * Public web sell offer: the staff offer schema, with the seller's own name,
 * phone and municipality in place of a picked client. Past harvest dates are
 * checked on the server against Manila today.
 */
export const webOfferSchema = offerForm
  .omit({ clientId: true, bookedByPhone: true })
  .extend({
    name: z.string().trim().min(1, "Enter your name."),
    phone: z
      .string()
      .refine(
        (value) => normalizePhone(value) !== null,
        "Enter a valid Philippine mobile number.",
      ),
    municipalityId: z.string().min(1, "Choose your municipality."),
  });
export type WebOfferFormValues = z.input<typeof webOfferSchema>;
export type WebOfferInput = z.output<typeof webOfferSchema>;

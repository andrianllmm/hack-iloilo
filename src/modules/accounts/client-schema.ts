import { z } from "zod";
import { buyerTypes, clientKinds, normalizePhone } from "./logic";
export const clientSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the client's name."),
    phone: z
      .string()
      .refine(
        (value) => normalizePhone(value) !== null,
        "Enter a valid Philippine mobile number.",
      ),
    kind: z.enum(clientKinds),
    municipality_id: z.guid().nullable(),
    coop_id: z.guid().nullable(),
    buyer_type: z.enum(buyerTypes).nullable(),
  })
  .refine((value) => value.kind !== "coop" || value.coop_id === null, {
    path: ["coop_id"],
    message: "A co-op cannot belong to another co-op.",
  })
  .refine((value) => value.kind === "buyer" || value.buyer_type === null, {
    path: ["buyer_type"],
    message: "Only buyers have a buyer type.",
  });
export type ClientInput = z.infer<typeof clientSchema>;
/** Staff entry also requires a buyer's type; SMS and gate registration don't ask for it. */
export const clientFormSchema = clientSchema.refine(
  (value) => value.kind !== "buyer" || value.buyer_type !== null,
  { path: ["buyer_type"], message: "Choose the buyer type." },
);

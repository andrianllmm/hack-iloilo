import { z } from "zod";
import { clientKinds, normalizePhone } from "./logic";
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
  })
  .refine((value) => value.kind !== "coop" || value.coop_id === null, {
    path: ["coop_id"],
    message: "A co-op cannot belong to another co-op.",
  });
export type ClientInput = z.infer<typeof clientSchema>;

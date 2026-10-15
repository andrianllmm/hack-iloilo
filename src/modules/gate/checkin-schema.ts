import { z } from "zod";
import { clientKinds, normalizePhone } from "@/modules/accounts/logic";
import { ownerships, services } from "./logic";

/** Gate check-in by phone, or as a walk-in registered on the spot. */
export const checkInSchema = z
  .object({
    mode: z.enum(["phone", "walkIn"]),
    phone: z
      .string()
      .refine(
        (value) => normalizePhone(value) !== null,
        "Enter a valid Philippine mobile number.",
      ),
    service: z.enum(services, "Choose drying or milling."),
    ownership: z.enum(ownerships, "Choose custom service or selling to IRPC."),
    estKg: z
      .number("Enter the estimated kg.")
      .int("Enter whole kilograms.")
      .positive("Enter more than 0 kg.")
      .nullable(),
    name: z.string().trim(),
    kind: z.enum(clientKinds),
    municipality_id: z.guid().nullable(),
  })
  .refine((value) => value.mode !== "walkIn" || value.name.length > 0, {
    path: ["name"],
    message: "Enter the client's name.",
  });
export type CheckInInput = z.infer<typeof checkInSchema>;

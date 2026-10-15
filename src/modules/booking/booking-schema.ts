import { z } from "zod";
import { MAX_FLEX_DAYS, services } from "./logic";

/** Staff booking form. Past dates are checked on the server against Manila today. */
export const bookingSchema = z.object({
  clientId: z.guid("Choose a client."),
  service: z.enum(services, "Choose drying or milling."),
  estKg: z
    .number("Enter the estimated kg.")
    .int("Enter whole kilograms.")
    .positive("Enter more than 0 kg."),
  preferredDate: z.iso.date("Choose a preferred date."),
  flexDays: z
    .number("Enter flex days.")
    .int("Enter whole days.")
    .min(0, "Flex days can't be negative.")
    .max(MAX_FLEX_DAYS, `Flex days can be at most ${MAX_FLEX_DAYS}.`),
});
export type BookingInput = z.infer<typeof bookingSchema>;

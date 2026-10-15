// M4. Booking: SMS commands and GSM-7 templates.

import { registerCommand } from "@/modules/sms/registry";
import { bookingSmsSchema, cancelSmsSchema } from "./booking-schema";
import { parseBookingArgs } from "./logic";
import { bookBySms, cancelBySms } from "./queries";

export const BOOKING_CONFIRMATION =
  "IRPC: Booking confirmed. Ref {ref}: {service}, {kg} kg on {date}. Cancel: CANCEL {ref}.";

registerCommand({
  keywords: ["BOOK"],
  schema: bookingSmsSchema,
  parse: parseBookingArgs,
  handle: bookBySms,
});

registerCommand({
  keywords: ["CANCEL"],
  schema: cancelSmsSchema,
  parse: (args) => (args.length === 1 ? { ref: args[0].toUpperCase() } : null),
  handle: cancelBySms,
});

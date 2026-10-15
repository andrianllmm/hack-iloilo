// M4. Booking: SMS commands and GSM-7 templates.

import { todayManila } from "@/lib/dates";
import { parseDayMonth } from "@/modules/sms/logic";
import { registerCommand } from "@/modules/sms/registry";
import { bookingSmsSchema, cancelSmsSchema } from "./booking-schema";
import { describeBookingRequest, parseBookingArgs } from "./logic";
import { bookBySms, cancelBySms } from "./queries";

export const BOOKING_CONFIRMATION =
  "IRPC: Booking confirmed. Ref {ref}: {service}, {kg} kg on {date}. Cancel: CANCEL {ref}.";

registerCommand({
  keywords: ["BOOK"],
  usage: "BOOK DRY 1000 20/10 +2 (DRY or MILL, kg, day/month, flex days)",
  schema: bookingSmsSchema,
  parse: parseBookingArgs,
  handle: bookBySms,
  ai: {
    description:
      "Book a drying or milling slot. flexDays: how many days earlier or later the client can come (0 if not stated).",
    summary: (cmd) =>
      describeBookingRequest({
        ...cmd,
        date: parseDayMonth(cmd.dayMonth, todayManila()),
      }),
  },
});

registerCommand({
  keywords: ["CANCEL"],
  usage: "CANCEL <ref>",
  schema: cancelSmsSchema,
  parse: (args) => (args.length === 1 ? { ref: args[0].toUpperCase() } : null),
  handle: cancelBySms,
  ai: {
    description: "Cancel a booking by its 6-character ref.",
    summary: ({ ref }) => `cancel booking ${ref}`,
  },
});

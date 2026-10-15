// M4. Booking: SMS commands and GSM-7 templates.

import { todayManila } from "@/lib/dates";
import { parseDayMonth } from "@/modules/sms/logic";
import { onPromptAnswer, registerCommand } from "@/modules/sms/registry";
import {
  bookingSmsSchema,
  cancelSmsSchema,
  moveSmsSchema,
} from "./booking-schema";
import {
  describeBookingRequest,
  parseBookingArgs,
  parseMoveArgs,
} from "./logic";
import { answerReschedule, bookBySms, cancelBySms, moveBySms } from "./queries";

export const BOOKING_CONFIRMATION =
  "IRPC: Booking confirmed. Ref {ref}: {service}, {kg} kg on {date}. Cancel: CANCEL {ref}.";
export const RESCHEDULE_QUESTION =
  "IRPC: {date} is full. Move your {service} booking {ref} ({kg} kg) to {newDate}? Reply YES {ref} or NO {ref}.";
export const RESCHEDULE_MOVED =
  "IRPC: Booking {ref} moved to {date}. Thank you!";
export const RESCHEDULE_KEPT = "IRPC: Booking {ref} stays on {date}.";
export const BOOKING_MOVED =
  "IRPC: Booking {ref} moved to {date}: {service}, {kg} kg. Cancel: CANCEL {ref}.";

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

registerCommand({
  keywords: ["MOVE"],
  usage: "MOVE <ref> <dd/mm> [+days]",
  schema: moveSmsSchema,
  parse: parseMoveArgs,
  handle: moveBySms,
});

onPromptAnswer("reschedule", answerReschedule);

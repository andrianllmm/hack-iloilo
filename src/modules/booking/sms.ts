// M4. Booking: SMS commands and GSM-7 templates.

import { onPromptAnswer, registerCommand } from "@/modules/sms/registry";
import {
  bookingSmsSchema,
  cancelSmsSchema,
  moveSmsSchema,
} from "./booking-schema";
import { parseBookingArgs, parseMoveArgs } from "./logic";
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

registerCommand({
  keywords: ["MOVE"],
  schema: moveSmsSchema,
  parse: parseMoveArgs,
  handle: moveBySms,
});

onPromptAnswer("reschedule", answerReschedule);

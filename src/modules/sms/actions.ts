"use server";

// M3. SMS: Sending, receiving and parsing texts; command registry. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { requireRole } from "@/modules/accounts/auth";
import { normalizePhone } from "@/modules/accounts/logic";
import { handleInbound } from "./queries";

const inboundSchema = z.object({
  phone: z.string(),
  body: z.string().trim().min(1, "Type a message.").max(1000),
});

export type SimulateResult =
  { status: "sent"; phone: string } | { status: "error"; message: string };

/** Simulator: texts `body` from `phone` as if through the gateway. */
export async function simulateInbound(input: unknown): Promise<SimulateResult> {
  await requireRole();
  if (env().SMS_GATEWAY === "smsgate")
    return {
      status: "error",
      message: "The simulator is off while the SMS gateway is on.",
    };
  const parsed = inboundSchema.safeParse(input);
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone)
    return {
      status: "error",
      message: "Enter a valid Philippine mobile number.",
    };

  await handleInbound({ phone, body: parsed.data.body });
  revalidatePath("/sms");
  return { status: "sent", phone };
}

"use server";

// M10. Prescriptions: Suggested actions computed from capacity. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { requireRole } from "@/modules/accounts/auth";
import { proposeReschedule } from "@/modules/booking/queries";
import { send } from "@/modules/sms/queries";
import { prescriptions, saveDecision } from "./queries";
import type { Decision } from "./types";

export type DecideResult =
  { status: "ok" } | { status: "error"; message: string };

/**
 * Accepts or dismisses a suggestion. Manager only. The suggestion is
 * recomputed from its key, so a stale card can't act on old numbers.
 */
export async function decidePrescription(
  key: string,
  decision: Decision,
): Promise<DecideResult> {
  const staff = await requireRole("manager");
  try {
    const prescription = (await prescriptions()).find((p) => p.key === key);
    if (!prescription || prescription.decision)
      return {
        status: "error",
        message: "This suggestion has changed. Refresh to see the latest.",
      };
    const saved = await saveDecision({
      prescription,
      status: decision,
      staffId: staff.id,
    });
    if (!saved)
      return { status: "error", message: "Someone already decided this." };
    if (decision === "accepted" && prescription.kind === "move_bookings") {
      for (const m of prescription.moves)
        await proposeReschedule(m.bookingId, m.to);
    }
    if (decision === "accepted" && prescription.kind === "fill_idle") {
      // `send()` logs a failed send instead of throwing, so one bad number
      // doesn't stop the rest.
      for (const r of prescription.recipients)
        await send(r.phone, prescription.message);
    }
    revalidatePath("/capacity");
    revalidatePath("/suggestions");
    revalidatePath("/bookings");
    revalidatePath("/sms");
    return { status: "ok" };
  } catch (error) {
    console.error("Unable to save the decision", error);
    return {
      status: "error",
      message: "Unable to save the decision. Please try again.",
    };
  }
}

// M10. Prescriptions: Suggested actions computed from capacity. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { addDays, todayManila } from "@/lib/dates";
import { db } from "@/lib/supabase/admin";
import { bookingList } from "@/modules/booking/queries";
import { WINDOW_DAYS } from "@/modules/capacity/logic";
import { capacityByDay, type DayPool } from "@/modules/capacity/queries";
import { moveBookings, type OpenBooking } from "./logic";
import type { Decision, Prescription } from "./types";
export type { Prescription } from "./types";

/**
 * Suggestions over the capacity window, recomputed on each call, with any
 * saved decision. Only decisions are stored. Pass the window's `capacityByDay`
 * when the caller already has it.
 */
export async function prescriptions(
  capacity?: DayPool[],
): Promise<Prescription[]> {
  const today = todayManila();
  const to = addDays(today, WINDOW_DAYS - 1);
  const [days, rows] = await Promise.all([
    capacity ?? capacityByDay(today, to),
    bookingList(today, to),
  ]);
  const bookings: OpenBooking[] = rows.flatMap((b) =>
    b.service === "drying" &&
    (b.status === "confirmed" || b.status === "reschedule_proposed")
      ? [
          {
            id: b.id,
            ref: b.ref,
            client: b.client.name,
            kg: b.est_kg,
            scheduledDate: b.scheduled_date,
            preferredDate: b.preferred_date,
            flexDays: b.flex_days,
            status: b.status,
            proposedDate: b.proposed_date,
          },
        ]
      : [],
  );
  const suggested = moveBookings({
    days: days
      .filter((d) => d.pool === "dryer")
      .map((d) => ({
        date: d.date,
        capacityKg: d.capacityKg,
        firmKg: d.load.confirmed.mid + d.load.offer.mid,
      })),
    bookings,
    today,
  });
  const decisions = await decisionsByKey(suggested.map((s) => s.key));
  return suggested.map((s) => ({
    ...s,
    decision: decisions.get(s.key) ?? null,
  }));
}

async function decisionsByKey(keys: string[]): Promise<Map<string, Decision>> {
  if (!keys.length) return new Map();
  const { data, error } = await db()
    .from("prescription_decisions")
    .select("key, status")
    .in("key", keys);
  if (error) throw error;
  return new Map(data.map((d) => [d.key, d.status]));
}

/**
 * Saves a decision. False if the key was already decided, so a card is acted
 * on once.
 */
export async function saveDecision(input: {
  prescription: Prescription;
  status: Decision;
  staffId: string;
}): Promise<boolean> {
  const { error } = await db().from("prescription_decisions").insert({
    kind: input.prescription.kind,
    key: input.prescription.key,
    status: input.status,
    decided_by: input.staffId,
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

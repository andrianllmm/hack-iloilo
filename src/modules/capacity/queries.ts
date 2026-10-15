// M9. Capacity: Load against capacity per day and pool. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { bookingList, bookingsBetween } from "@/modules/booking/queries";
import type { BookingRow } from "@/modules/booking/types";
import { capacitySettings } from "@/modules/setup/queries";
import { dryerDays } from "./logic";
import type { DayPool } from "./types";
export type { DayPool, Pool, Range, Source } from "./types";

/** Load against capacity per day and pool, `from` to `to` inclusive. Recomputed on each call. */
export async function capacityByDay(
  from: string,
  to: string,
): Promise<DayPool[]> {
  const [settings, bookings] = await Promise.all([
    capacitySettings(),
    bookingsBetween(from, to, "drying"),
  ]);
  return dryerDays({
    from,
    to,
    bookings,
    capacityKg: settings.dryerKgPerDay,
    idleThresholdPct: settings.facility.idle_threshold_pct,
  });
}

/** The idle threshold the page states, in percent of capacity. */
export async function idleThresholdPct(): Promise<number> {
  const { facility } = await capacitySettings();
  return facility.idle_threshold_pct;
}

/** Open drying bookings with their clients, for the day panel. */
export async function dryingBookings(
  from: string,
  to: string,
): Promise<BookingRow[]> {
  const rows = await bookingList(from, to);
  return rows.filter(
    (r) =>
      r.service === "drying" &&
      (r.status === "confirmed" || r.status === "reschedule_proposed"),
  );
}

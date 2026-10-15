// M9. Capacity: Load against capacity per day and pool. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { bookingList, bookingsBetween } from "@/modules/booking/queries";
import type { Booking, BookingRow } from "@/modules/booking/types";
import {
  acceptedOffersBetween,
  listOffers,
  type OfferListItem,
} from "@/modules/buying/queries";
import { expectedArrivals } from "@/modules/forecast/queries";
import { storageStockOn } from "@/modules/gate/queries";
import { capacitySettings } from "@/modules/setup/queries";
import { dayInputs, projectPools } from "./logic";
import type { DayPool } from "./types";
export type { DayPool, Pool, Range, Source } from "./types";

/** Load against capacity per day and pool, `from` to `to` inclusive. Storage starts from today's stock. Recomputed on each call. */
export async function capacityByDay(
  from: string,
  to: string,
): Promise<DayPool[]> {
  const [settings, bookings, offers, forecast, startStockKg] =
    await Promise.all([
      capacitySettings(),
      bookingsBetween(from, to),
      acceptedOffersBetween(from, to),
      expectedArrivals(from, to),
      storageStockOn(from),
    ]);
  const booked = (service: Booking["service"]) =>
    bookings
      .filter((b) => b.service === service)
      .map((b) => ({ date: b.scheduled_date, kg: b.est_kg }));
  return projectPools({
    days: dayInputs({
      from,
      to,
      drying: booked("drying"),
      milling: booked("milling"),
      offers: offers.map((o) => ({ date: o.harvest_date, kg: o.est_kg })),
      forecast,
    }),
    startStockKg,
    settings: {
      dryerKgPerDay: settings.dryerKgPerDay,
      millKgPerDay: settings.millKgPerDay,
      storageCapacityKg: settings.facility.storage_capacity_kg,
      dryYieldPct: settings.facility.dry_yield_pct,
      idleThresholdPct: settings.facility.idle_threshold_pct,
    },
  });
}

/** The idle threshold the page states, in percent of capacity. */
export async function idleThresholdPct(): Promise<number> {
  const { facility } = await capacitySettings();
  return facility.idle_threshold_pct;
}

/** Open drying and milling bookings with their clients, for the day panel. */
export async function openBookings(
  from: string,
  to: string,
): Promise<BookingRow[]> {
  const rows = await bookingList(from, to);
  return rows.filter(
    (r) => r.status === "confirmed" || r.status === "reschedule_proposed",
  );
}

/** Accepted offers harvested in `[from, to]` with their clients, for the day panel. */
export async function acceptedOffers(
  from: string,
  to: string,
): Promise<OfferListItem[]> {
  const rows = await listOffers("accepted");
  return rows.filter((o) => o.harvest_date >= from && o.harvest_date <= to);
}

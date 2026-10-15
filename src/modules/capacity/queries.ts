// M9. Capacity: Load against capacity per day and pool. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { addDays } from "@/lib/dates";
import { bookingList, bookingsBetween } from "@/modules/booking/queries";
import type { Booking, BookingRow } from "@/modules/booking/types";
import {
  acceptedOffersBetween,
  listOffers,
  type OfferListItem,
} from "@/modules/buying/queries";
import { expectedArrivals } from "@/modules/forecast/queries";
import { driedKgByDay, storageStockOn } from "@/modules/gate/queries";
import { electricityPerKg } from "@/modules/pricing/logic";
import { capacitySettings } from "@/modules/setup/queries";
import {
  dayInputs,
  electricityBasis,
  poolDays,
  projectPools,
  type SeasonDay,
  seasonDays,
} from "./logic";
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

/**
 * Electricity per kg dried or milled over `days`, base load included, in
 * centavos (M7 `electricityPerKg`). Null when nothing runs. Managers only.
 */
export async function electricityHeadline(
  days: DayPool[],
): Promise<{ minorPerKg: number; daysRun: number } | null> {
  const { facility, machines } = await capacitySettings();
  const active = machines.filter((m) => m.active);
  const basis = electricityBasis({
    days,
    dryers: active.flatMap((m) =>
      m.type === "dryer" && m.capacity_kg && m.cycle_hours
        ? [
            {
              capacityKg: m.capacity_kg,
              cycleHours: m.cycle_hours,
              kw: m.rated_kw,
            },
          ]
        : [],
    ),
    millKw: active
      .filter((m) => m.type === "mill")
      .reduce((sum, m) => sum + m.rated_kw, 0),
    hoursPerDay: facility.operating_hours_per_day,
  });
  if (basis.kg <= 0) return null;
  return {
    minorPerKg: electricityPerKg({
      ...basis,
      baseLoadKw: facility.base_load_kw,
      hoursPerDay: facility.operating_hours_per_day,
      tariffMinorPerKwh: facility.tariff_minor_per_kwh,
    }),
    daysRun: basis.daysRun,
  };
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

/** Dryer days for the season heatmap: batch records before `today`, the plan from `today`. */
export async function dryerSeason(
  from: string,
  to: string,
  today: string,
): Promise<SeasonDay[]> {
  const [records, plan, settings] = await Promise.all([
    driedKgByDay(from, addDays(today, -1)),
    capacityByDay(today, to),
    capacitySettings(),
  ]);
  return seasonDays({
    from,
    to,
    today,
    records,
    planned: poolDays(plan, "dryer"),
    capacityKg: settings.dryerKgPerDay,
  });
}

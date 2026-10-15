import { addDays, todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { WINDOW_DAYS } from "../logic";
import {
  acceptedOffers,
  capacityByDay,
  idleThresholdPct,
  openBookings,
} from "../queries";
import {
  CapacityView,
  type PanelBooking,
  type PanelOffer,
} from "./capacity-view";

export async function CapacityLoader() {
  await requireRole();
  const today = todayManila();
  const range = { from: today, to: addDays(today, WINDOW_DAYS - 1) };
  let data;
  try {
    data = await Promise.all([
      capacityByDay(range.from, range.to),
      openBookings(range.from, range.to),
      acceptedOffers(range.from, range.to),
      idleThresholdPct(),
    ]);
  } catch (error) {
    console.error("Unable to load capacity", error);
  }
  const bookings: Record<string, PanelBooking[]> = {};
  for (const b of data?.[1] ?? []) {
    (bookings[b.scheduled_date] ??= []).push({
      id: b.id,
      ref: b.ref,
      service: b.service,
      client: b.client.name,
      estKg: b.est_kg,
      flexDays: b.flex_days,
      reschedule: b.status === "reschedule_proposed",
    });
  }
  for (const list of Object.values(bookings)) {
    list.sort((a, b) => b.estKg - a.estKg);
  }
  const offers: Record<string, PanelOffer[]> = {};
  for (const o of data?.[2] ?? []) {
    (offers[o.harvest_date] ??= []).push({
      id: o.id,
      ref: o.ref,
      client: o.client?.name ?? "Unknown client",
      variety: o.variety?.code ?? null,
      estKg: o.est_kg,
    });
  }
  return (
    <CapacityView
      days={data?.[0] ?? null}
      bookings={bookings}
      offers={offers}
      idleThresholdPct={data?.[3] ?? 0}
      range={range}
      today={today}
    />
  );
}

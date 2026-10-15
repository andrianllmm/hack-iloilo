import { addDays, todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { poolDays, WINDOW_DAYS } from "../logic";
import { capacityByDay, dryingBookings, idleThresholdPct } from "../queries";
import { CapacityView, type PanelBooking } from "./capacity-view";

export async function CapacityLoader() {
  await requireRole();
  const today = todayManila();
  const range = { from: today, to: addDays(today, WINDOW_DAYS - 1) };
  let data;
  try {
    data = await Promise.all([
      capacityByDay(range.from, range.to),
      dryingBookings(range.from, range.to),
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
      client: b.client.name,
      estKg: b.est_kg,
      flexDays: b.flex_days,
      reschedule: b.status === "reschedule_proposed",
    });
  }
  for (const list of Object.values(bookings)) {
    list.sort((a, b) => b.estKg - a.estKg);
  }
  return (
    <CapacityView
      days={data ? poolDays(data[0], "dryer") : null}
      bookings={bookings}
      idleThresholdPct={data?.[2] ?? 0}
      range={range}
      today={today}
    />
  );
}

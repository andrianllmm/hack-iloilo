// M4. Booking: Future drying and milling slots. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { addDays } from "@/lib/dates";
import type { Booking, BookingRow, BookingStatus, Service } from "./types";

export const services = ["drying", "milling"] as const;
export const bookingStatuses = [
  "confirmed",
  "reschedule_proposed",
  "arrived",
  "cancelled",
  "no_show",
] as const;
export const serviceLabels: Record<Service, string> = {
  drying: "Drying",
  milling: "Milling",
};
export const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  reschedule_proposed: "Reschedule proposed",
  arrived: "Arrived",
  cancelled: "Cancelled",
  no_show: "No-show",
};
export const MAX_FLEX_DAYS = 7;
/** Days shown by default on the bookings page, today included. */
export const DEFAULT_RANGE_DAYS = 16;

export function defaultRange(today: string): { from: string; to: string } {
  return { from: today, to: addDays(today, DEFAULT_RANGE_DAYS) };
}

export type BookingFilters = {
  service: Service | "all";
  status: BookingStatus | "all";
  search: string;
};
export type BookingGroup = {
  date: string;
  service: Service;
  count: number;
  totalKg: number;
  rows: BookingRow[];
};

function matchesSearch(row: BookingRow, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  if (row.ref.toLowerCase().includes(query)) return true;
  if (row.client.name.toLowerCase().includes(query)) return true;
  if (!/^[+\d\s()-]+$/.test(query)) return false;
  const digits = query.replace(/\D/g, "");
  if (!digits) return false;
  // `0917…` and `+63917…` find the same E.164 phone.
  const phone = digits.startsWith("0") ? `63${digits.slice(1)}` : digits;
  return [row.client.phone, row.booked_by_phone].some((value) =>
    value.replace(/\D/g, "").includes(phone),
  );
}

/** Filtered bookings grouped by scheduled day and service, with day totals. */
export function groupBookings(
  rows: BookingRow[],
  filters: BookingFilters,
): BookingGroup[] {
  const groups = new Map<string, BookingGroup>();
  for (const row of rows) {
    if (filters.service !== "all" && row.service !== filters.service) continue;
    if (filters.status !== "all" && row.status !== filters.status) continue;
    if (!matchesSearch(row, filters.search)) continue;
    const key = `${row.scheduled_date}|${row.service}`;
    const group = groups.get(key) ?? {
      date: row.scheduled_date,
      service: row.service,
      count: 0,
      totalKg: 0,
      rows: [],
    };
    group.count += 1;
    group.totalKg += row.est_kg;
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.service.localeCompare(b.service),
  );
}

/**
 * Who made the booking: staff at the gate, the client by SMS, or someone
 * booking `FOR` the client (named when their phone belongs to a client).
 */
export function bookedByLabel(
  row: BookingRow,
  namesByPhone: ReadonlyMap<string, string> = new Map(),
): string {
  if (row.channel === "staff") return "Staff · walk-in";
  if (row.booked_by_phone === row.client.phone) return "Self · SMS";
  return `${namesByPhone.get(row.booked_by_phone) ?? row.booked_by_phone} · FOR`;
}

const isClientOrBooker = (
  booking: Pick<Booking, "booked_by_phone">,
  clientPhone: string,
  phone: string,
) => phone === clientPhone || phone === booking.booked_by_phone;

/** Only confirmed bookings cancel; by SMS only the client or booker may. */
export function canCancel(
  booking: Pick<Booking, "status" | "booked_by_phone">,
  clientPhone: string,
  byPhone?: string,
): "ok" | "forbidden" | "not_cancellable" {
  if (byPhone !== undefined && !isClientOrBooker(booking, clientPhone, byPhone))
    return "forbidden";
  return booking.status === "confirmed" ? "ok" : "not_cancellable";
}

/**
 * The date a reschedule answer leaves the booking on: YES takes the proposed
 * date, NO keeps the scheduled one. Only the client or booker may answer.
 */
export function rescheduleAnswer(
  booking: Pick<
    Booking,
    "status" | "booked_by_phone" | "scheduled_date" | "proposed_date"
  >,
  clientPhone: string,
  byPhone: string,
  yes: boolean,
):
  | { status: "forbidden" }
  | { status: "not_open" }
  | { status: "ok"; date: string } {
  if (!isClientOrBooker(booking, clientPhone, byPhone))
    return { status: "forbidden" };
  if (booking.status !== "reschedule_proposed" || !booking.proposed_date)
    return { status: "not_open" };
  return {
    status: "ok",
    date: yes ? booking.proposed_date : booking.scheduled_date,
  };
}

// Calendar dates are rendered at UTC midnight so the host time zone never shifts them.
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** `Tue, Oct 20` */
export function formatDay(date: string): string {
  return dayFormat.format(utc(date));
}

/** `Oct 20` */
export function formatShortDate(date: string): string {
  return shortFormat.format(utc(date));
}

/** `Oct 15 – 31`, `Oct 25 – Nov 10` */
export function formatRange(from: string, to: string): string {
  return shortFormat.formatRange(utc(from), utc(to));
}

/** Strict keyword arguments; invalid shapes are rejected by the SMS schema. */
export function parseBookingArgs(args: string[]): unknown {
  if (args.length < 3 || args.length > 4) return null;
  const [service, kg, dayMonth, flex] = args;
  if (!/^\d+$/.test(kg) || (flex !== undefined && !/^[±+]\d+$/.test(flex)))
    return null;
  return {
    service: { DRY: "drying", MILL: "milling" }[service.toUpperCase()],
    estKg: Number(kg),
    dayMonth,
    flexDays: flex === undefined ? 0 : Number(flex.slice(1)),
  };
}

// M6. Gate and Batches: Queue, batch record, dispatch. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { daysBetween } from "@/lib/dates";
import type {
  Batch,
  BatchOwnership,
  BookingStatus,
  OfferStatus,
  QueueEntry,
  QueueRow,
  RefKind,
  Service,
} from "./types";

export const services = ["drying", "milling"] as const;
export const ownerships = ["custom", "irpc"] as const;
export const serviceLabels: Record<Service, string> = {
  drying: "Drying",
  milling: "Milling",
};
export const ownershipLabels: Record<BatchOwnership, string> = {
  custom: "Custom service",
  irpc: "Selling to IRPC",
};

export const stageLabels: Record<Batch["stage"], string> = {
  received: "Received",
  drying: "Drying",
  stored: "Stored",
  milling: "Milling",
  milled: "Milled",
  dispatched: "Dispatched",
};

/** `YYMMDD-NNN` from a Manila `YYYY-MM-DD` date and the day's sequence. */
export function batchNo(date: string, seq: number): string {
  const [y, m, d] = date.split("-");
  return `${y.slice(2)}${m}${d}-${String(seq).padStart(3, "0")}`;
}

/** `YYMMDD-` prefix shared by a day's batch numbers. */
export function batchPrefix(date: string): string {
  return batchNo(date, 0).slice(0, 7);
}

/**
 * The next batch number today from the numbers already issued. Compared as
 * numbers, since `-1000` sorts before `-999` as text.
 */
export function nextBatchNo(today: string, issued: string[]): string {
  const prefix = batchPrefix(today);
  const seqs = issued
    .filter((no) => no.startsWith(prefix))
    .map((no) => Number(no.slice(prefix.length)))
    .filter(Number.isInteger);
  return batchNo(today, Math.max(0, ...seqs) + 1);
}

/** Offers are IRPC-bought, bookings are custom; otherwise what the encoder chose. */
export function batchOwnership(
  entry: Pick<QueueEntry, "offer_id" | "booking_id" | "ownership">,
): BatchOwnership {
  if (entry.offer_id) return "irpc";
  if (entry.booking_id) return "custom";
  return entry.ownership ?? "custom";
}

export type QueueLine = { serving: QueueRow[]; waiting: QueueRow[] };

/** One line per service: serving by start time, waiting first come first served. */
export function queueLines(rows: QueueRow[]): Record<Service, QueueLine> {
  const lines: Record<Service, QueueLine> = {
    drying: { serving: [], waiting: [] },
    milling: { serving: [], waiting: [] },
  };
  for (const row of rows) {
    if (row.status === "serving") lines[row.service].serving.push(row);
    else if (row.status === "waiting") lines[row.service].waiting.push(row);
  }
  for (const line of Object.values(lines)) {
    line.serving.sort((a, b) =>
      (a.started_at ?? "").localeCompare(b.started_at ?? ""),
    );
    line.waiting.sort(
      (a, b) =>
        Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at) ||
        a.id.localeCompare(b.id),
    );
  }
  return lines;
}

/** Whole minutes waited, never negative. */
export function waitMinutes(since: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / 60_000));
}

/** `25 min`, `1 h 5 min`, `2 h` */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** How the client reached the gate, for the queue row: the ref when there is one. */
export function arrivalLabel(
  entry: Pick<QueueEntry, "booking_id" | "offer_id"> &
    Partial<Pick<QueueRow, "booking" | "offer">>,
): string {
  if (entry.booking_id) return entry.booking?.ref ?? "Booking";
  if (entry.offer_id) return entry.offer?.ref ?? "Offer";
  return "Walk-in";
}

export const REF_LENGTH = 6;
export const refKindLabels: Record<RefKind, string> = {
  booking: "Booking",
  offer: "Offer",
};

/** `k7p-2qx ` → `K7P2QX`: refs are typed by hand, so drop case, spaces and dashes. */
export function normalizeRef(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const bookingBlocked: Record<
  Exclude<BookingStatus, "confirmed" | "reschedule_proposed">,
  string
> = {
  arrived: "This booking has already checked in.",
  cancelled: "This booking was cancelled.",
  no_show: "This booking was marked as a no-show.",
};

const offerBlocked: Record<Exclude<OfferStatus, "accepted">, string> = {
  offered: "This offer hasn't been accepted yet.",
  declined: "This offer was declined.",
  arrived: "This offer has already checked in.",
  withdrawn: "This offer was withdrawn.",
};

/**
 * Why a booking or offer can't check in, or null when it can. Only
 * `confirmed`/`reschedule_proposed` bookings and `accepted` offers may.
 */
export function refCheckInError(
  record:
    | { kind: "booking"; status: BookingStatus }
    | { kind: "offer"; status: OfferStatus },
): string | null {
  if (record.kind === "booking")
    return record.status === "confirmed" ||
      record.status === "reschedule_proposed"
      ? null
      : bookingBlocked[record.status];
  return record.status === "accepted" ? null : offerBlocked[record.status];
}

/** Bookings keep their service and are custom; offers are palay IRPC buys and dry first. */
export function refLine(
  record: { kind: "booking"; service: Service } | { kind: "offer" },
): { service: Service; ownership: BatchOwnership } {
  return record.kind === "booking"
    ? { service: record.service, ownership: "custom" }
    : { service: "drying", ownership: "irpc" };
}

/** `+639163393390` → `0916•••3390` */
export function maskPhone(phone: string): string {
  const local = phone.startsWith("+63") ? `0${phone.slice(3)}` : phone;
  return local.length > 8 ? `${local.slice(0, 4)}•••${local.slice(-4)}` : local;
}

// Calendar dates are rendered at UTC midnight so the host time zone never shifts them.
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** `Thu, Oct 15` from a `YYYY-MM-DD` calendar date. */
export function formatDay(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** How a booking's scheduled day or an offer's harvest day sits against today. */
export function recordDateNote(
  kind: RefKind,
  date: string,
  today: string,
): string {
  if (kind === "offer") return "Harvest date shown";
  const offset = daysBetween(today, date);
  if (offset === 0) return "Scheduled for today";
  return offset > 0
    ? `Arrived ${days(offset)} early`
    : `Arrived ${days(-offset)} late`;
}

// M6. Gate and Batches: Queue, batch record, dispatch. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import type {
  Batch,
  BatchOwnership,
  QueueEntry,
  QueueRow,
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

/** How the client reached the gate, for the queue row. */
export function arrivalLabel(
  entry: Pick<QueueEntry, "booking_id" | "offer_id">,
): string {
  if (entry.booking_id) return "Booking";
  if (entry.offer_id) return "Offer";
  return "Walk-in";
}

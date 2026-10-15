// M10. Prescriptions: Suggested actions computed from capacity. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { addDays, daysBetween } from "@/lib/dates";
import { formatTonnes } from "@/lib/format";
import type { Move, MoveBookingsPrescription, Prescription } from "./types";

/** 53-bit hash (cyrb53) as hex: stable across runs and machines. */
export function hashKey(value: unknown): string {
  const str = JSON.stringify(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const monthDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

/** `Oct 20` from a `YYYY-MM-DD` calendar date. */
export function shortDay(date: string): string {
  return monthDay.format(new Date(`${date}T00:00:00Z`));
}

/** `Oct 22` or `Oct 22–23` / `Oct 30–Nov 2` for a set of dates. */
export function daySpan(dates: string[]): string {
  const sorted = [...new Set(dates)].sort();
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return "";
  if (first === last) return shortDay(first);
  const [m1] = shortDay(first).split(" ");
  const [m2, d2] = shortDay(last).split(" ");
  return `${shortDay(first)}–${m1 === m2 ? d2 : `${m2} ${d2}`}`;
}

/** Dryer capacity and firm load (confirmed + offer) on one day. */
export type DryerDay = { date: string; capacityKg: number; firmKg: number };

/** An open drying booking, as the move rule reads it. */
export type OpenBooking = {
  id: string;
  ref: string;
  client: string;
  kg: number;
  scheduledDate: string;
  preferredDate: string;
  flexDays: number;
  status: "confirmed" | "reschedule_proposed";
  /** Where an earlier accepted card proposed to move it. */
  proposedDate: string | null;
};

/**
 * For each overloaded dryer day, moves flexible confirmed bookings, largest
 * first, to the nearest day within their flex window (around the preferred
 * date, not before `today`) that has room, until the overflow clears. Ties go
 * to the later day, since palay is rarely ready early. Bookings already asked
 * to move count on their proposed day (`incomingKg`), so the overflow can
 * be above what the capacity chart shows. Days with nothing to move get no card.
 */
export function moveBookings(input: {
  days: DryerDay[];
  bookings: OpenBooking[];
  today: string;
}): Omit<MoveBookingsPrescription, "decision">[] {
  const room = new Map(
    input.days.map((d) => [d.date, d.capacityKg - d.firmKg]),
  );
  const shift = (date: string | null, kg: number) => {
    const r = date === null ? undefined : room.get(date);
    if (date !== null && r !== undefined) room.set(date, r + kg);
  };
  const incoming = new Map<string, number>();
  for (const b of input.bookings) {
    if (b.status !== "reschedule_proposed" || !b.proposedDate) continue;
    shift(b.scheduledDate, b.kg);
    shift(b.proposedDate, -b.kg);
    incoming.set(b.proposedDate, (incoming.get(b.proposedDate) ?? 0) + b.kg);
  }

  const out: Omit<MoveBookingsPrescription, "decision">[] = [];
  for (const day of [...input.days].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const overflowKg = -(room.get(day.date) ?? 0);
    if (overflowKg <= 0) continue;
    const candidates = input.bookings
      .filter(
        (b) =>
          b.status === "confirmed" &&
          b.flexDays > 0 &&
          b.scheduledDate === day.date,
      )
      .sort((a, b) => b.kg - a.kg || a.ref.localeCompare(b.ref));

    const moves: Move[] = [];
    let left = overflowKg;
    for (const b of candidates) {
      if (left <= 0) break;
      const to = nearestWithRoom(b, room, input.today);
      if (!to) continue;
      shift(to, -b.kg);
      shift(day.date, b.kg);
      left -= b.kg;
      moves.push({
        bookingId: b.id,
        ref: b.ref,
        client: b.client,
        from: day.date,
        to,
        kg: b.kg,
      });
    }
    if (!moves.length) continue;

    const remainderKg = Math.max(left, 0);
    const movedKg = moves.reduce((sum, m) => sum + m.kg, 0);
    const incomingKg = incoming.get(day.date) ?? 0;
    out.push({
      kind: "move_bookings",
      key: hashKey([
        "move_bookings",
        day.date,
        overflowKg,
        moves.map((m) => [m.bookingId, m.to, m.kg]),
      ]),
      title: `${shortDay(day.date)} is ${formatTonnes(overflowKg)} over`,
      facts: {
        day: shortDay(day.date),
        overflow: formatTonnes(overflowKg),
        bookings_moved: moves.length,
        moved: formatTonnes(movedKg),
        new_days: daySpan(moves.map((m) => m.to)),
        remainder: formatTonnes(remainderKg),
        ...(incomingKg && {
          already_asked_to_move_here: formatTonnes(incomingKg),
        }),
      },
      date: day.date,
      moves,
      remainderKg,
      incomingKg,
    });
  }
  return out;
}

/** Nearest day in the booking's flex window with room for all of it. */
function nearestWithRoom(
  b: OpenBooking,
  room: Map<string, number>,
  today: string,
): string | null {
  const lo = addDays(b.preferredDate, -b.flexDays);
  const hi = addDays(b.preferredDate, b.flexDays);
  const reach = Math.max(
    Math.abs(daysBetween(b.scheduledDate, lo)),
    Math.abs(daysBetween(b.scheduledDate, hi)),
  );
  for (let dist = 1; dist <= reach; dist++) {
    for (const date of [
      addDays(b.scheduledDate, dist),
      addDays(b.scheduledDate, -dist),
    ]) {
      if (date < lo || date > hi || date < today) continue;
      if ((room.get(date) ?? -1) >= b.kg) return date;
    }
  }
  return null;
}

/** The card's plain-language note on why and what it gains, from its facts only. */
export function templateNote(p: Omit<Prescription, "decision">): string {
  const f = p.facts;
  switch (p.kind) {
    case "move_bookings": {
      const n = Number(f.bookings_moved);
      const moving = `Moving ${n} flexible ${n === 1 ? "booking" : "bookings"} to ${f.new_days}`;
      return p.remainderKg === 0
        ? `${f.day} is ${f.overflow} over. ${moving} clears it without turning anyone away.`
        : `${f.day} is ${f.overflow} over. ${moving} leaves ${f.remainder} over.`;
    }
  }
}

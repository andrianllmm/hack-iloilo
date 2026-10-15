// Calendar dates are `YYYY-MM-DD` strings in Asia/Manila (UTC+8, no DST).

const MANILA_TZ = "Asia/Manila";
// Fixed because Manila observes no DST.
const MANILA_OFFSET = "+08:00";

const manilaDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Any ISO timestamp as Manila `{ date: "YYYY-MM-DD", time: "HH:mm" }`. */
export function splitManila(iso: string | Date): {
  date: string;
  time: string;
} {
  const p = Object.fromEntries(
    manilaDateTime.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

/** Manila date and time as a `timestamptz`-ready ISO string. */
export function joinManila(date: string, time: string): string {
  return `${date}T${time}:00${MANILA_OFFSET}`;
}

/** Today's date in Manila. */
export function todayManila(now: Date = new Date()): string {
  return splitManila(now).date;
}

const DAY_MS = 86_400_000;

// Date arithmetic runs on UTC midnights, so the host time zone never matters.
const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** `date` moved by `n` days (negative goes back). */
export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

// Calendar dates are `YYYY-MM-DD` strings in Asia/Manila (UTC+8, no DST).

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Manila. */
export function todayManila(now: Date = new Date()): string {
  return manilaDate.format(now);
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

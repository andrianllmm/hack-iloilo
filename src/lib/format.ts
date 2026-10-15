// Display formatters. Weight is integer kg; money is integer centavos (`_minor`).

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** `1,234 kg` */
export function formatKg(kg: number): string {
  return `${grouped.format(kg)} kg`;
}

/** `56 t`, `3.1 t` */
export function formatTonnes(kg: number): string {
  return `${grouped.format(kg / 1000)} t`;
}

// Integer math, so centavos never pick up float error.
function money(minor: number, symbol: string): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const pesos = grouped.format(Math.floor(abs / 100));
  const centavos = String(abs % 100).padStart(2, "0");
  return `${sign}${symbol}${pesos}.${centavos}`;
}

/** `₱1,234.56` for the UI. */
export function formatMoney(minor: number): string {
  return money(minor, "₱");
}

/** `PHP 1,234.56` for SMS (`₱` is not GSM-7). */
export function formatMoneySms(minor: number): string {
  return money(minor, "PHP ");
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** `May 16, 2025` from a `YYYY-MM-DD` calendar date. */
export function formatDate(date: string): string {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

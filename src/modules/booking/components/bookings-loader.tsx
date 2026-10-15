import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { defaultRange } from "../logic";
import { bookingClients, bookingList } from "../queries";
import { BookingsView } from "./bookings-view";

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function BookingsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole();
  const params = await searchParams;
  const today = todayManila();
  const range =
    isDate(params.from) && isDate(params.to) && params.from <= params.to
      ? { from: params.from, to: params.to }
      : defaultRange(today);
  let data;
  try {
    data = await Promise.all([
      bookingList(range.from, range.to),
      bookingClients(),
    ]);
  } catch (error) {
    console.error("Unable to load bookings", error);
  }
  return (
    <BookingsView
      bookings={data?.[0] ?? null}
      clients={data?.[1] ?? []}
      range={range}
      today={today}
    />
  );
}

import { describe, expect, it } from "vitest";
import { bookingSchema } from "./booking-schema";
import {
  bookedByLabel,
  canCancel,
  defaultRange,
  formatDay,
  formatRange,
  formatShortDate,
  groupBookings,
  type BookingFilters,
} from "./logic";
import type { BookingRow } from "./types";

const row = (overrides: Partial<BookingRow> = {}): BookingRow => ({
  id: "b1",
  facility_id: "f1",
  ref: "K7P2QX",
  service: "drying",
  client_id: "c1",
  booked_by_phone: "+639171234567",
  channel: "sms",
  est_kg: 5000,
  preferred_date: "2026-10-20",
  flex_days: 0,
  scheduled_date: "2026-10-20",
  status: "confirmed",
  created_at: "",
  updated_at: "",
  client: { name: "Rodel Panes", phone: "+639171234567", kind: "farmer" },
  ...overrides,
});
const all: BookingFilters = { service: "all", status: "all", search: "" };

describe("groupBookings", () => {
  const rows = [
    row({ id: "a", scheduled_date: "2026-10-21", est_kg: 3000 }),
    row({ id: "b", est_kg: 12000 }),
    row({ id: "c", est_kg: 2500 }),
    row({ id: "d", service: "milling", est_kg: 4000 }),
  ];

  it("groups by day and service with total kg, sorted by date", () => {
    expect(
      groupBookings(rows, all).map(({ date, service, count, totalKg }) => ({
        date,
        service,
        count,
        totalKg,
      })),
    ).toEqual([
      { date: "2026-10-20", service: "drying", count: 2, totalKg: 14500 },
      { date: "2026-10-20", service: "milling", count: 1, totalKg: 4000 },
      { date: "2026-10-21", service: "drying", count: 1, totalKg: 3000 },
    ]);
  });

  it("filters by service and status", () => {
    const mixed = [...rows, row({ id: "e", status: "cancelled" })];
    expect(
      groupBookings(mixed, { ...all, service: "milling" }).flatMap((g) =>
        g.rows.map((r) => r.id),
      ),
    ).toEqual(["d"]);
    expect(
      groupBookings(mixed, { ...all, status: "cancelled" }).flatMap((g) =>
        g.rows.map((r) => r.id),
      ),
    ).toEqual(["e"]);
  });

  it.each(["k7p2", "rodel", "0917 123", "+63917123", "4567"])(
    "finds by ref, name or phone: %s",
    (search) => {
      expect(groupBookings([row()], { ...all, search })).toHaveLength(1);
    },
  );

  it("finds by the booker's phone", () => {
    const booked = row({ booked_by_phone: "+639179990000" });
    expect(groupBookings([booked], { ...all, search: "0917999" })).toHaveLength(
      1,
    );
    expect(groupBookings([booked], { ...all, search: "nobody" })).toEqual([]);
  });
});

describe("bookedByLabel", () => {
  it("labels staff, self and FOR bookings", () => {
    expect(bookedByLabel(row({ channel: "staff" }))).toBe("Staff · walk-in");
    expect(bookedByLabel(row())).toBe("Self · SMS");
    const forRow = row({ booked_by_phone: "+639171000001" });
    expect(
      bookedByLabel(forRow, new Map([["+639171000001", "Amamaros Co-op"]])),
    ).toBe("Amamaros Co-op · FOR");
    expect(bookedByLabel(forRow)).toBe("+639171000001 · FOR");
  });
});

describe("canCancel", () => {
  const booking = { status: "confirmed" as const, booked_by_phone: "+6392" };
  it("lets staff cancel only confirmed bookings", () => {
    expect(canCancel(booking, "+6391")).toBe("ok");
    expect(canCancel({ ...booking, status: "arrived" }, "+6391")).toBe(
      "not_cancellable",
    );
  });
  it("lets only the client or booker cancel by phone", () => {
    expect(canCancel(booking, "+6391", "+6391")).toBe("ok");
    expect(canCancel(booking, "+6391", "+6392")).toBe("ok");
    expect(canCancel(booking, "+6391", "+6393")).toBe("forbidden");
  });
});

describe("defaultRange", () => {
  it("runs from today for 16 days", () => {
    expect(defaultRange("2026-10-15")).toEqual({
      from: "2026-10-15",
      to: "2026-10-31",
    });
  });
});

describe("bookingSchema", () => {
  const input = {
    clientId: "c1000000-0000-0000-0000-000000000001",
    service: "drying",
    estKg: 5000,
    preferredDate: "2026-10-20",
    flexDays: 3,
  };
  it("accepts a valid booking", () => {
    expect(bookingSchema.safeParse(input).success).toBe(true);
  });
  it.each([
    { estKg: 0 },
    { estKg: 12.5 },
    { flexDays: -1 },
    { flexDays: 8 },
    { preferredDate: "20/10" },
    { service: "storage" },
  ])("rejects %o", (bad) => {
    expect(bookingSchema.safeParse({ ...input, ...bad }).success).toBe(false);
  });
});

describe("date labels", () => {
  it("formats days and ranges", () => {
    expect(formatDay("2026-10-20")).toBe("Tue, Oct 20");
    expect(formatShortDate("2026-10-20")).toBe("Oct 20");
    expect(formatRange("2026-10-15", "2026-10-31")).toMatch(/^Oct 15\s–\s31$/);
  });
});

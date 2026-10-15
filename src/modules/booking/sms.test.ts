import { describe, expect, it } from "vitest";
import { bookingSmsSchema } from "./booking-schema";
import { parseBookingArgs } from "./logic";

const parse = (text: string) =>
  bookingSmsSchema.safeParse(parseBookingArgs(text.split(" ")));

describe("booking SMS arguments", () => {
  it("accepts drying, milling and optional flexibility", () => {
    expect(parse("dry 5000 20/10").data).toEqual({
      service: "drying",
      estKg: 5000,
      dayMonth: "20/10",
      flexDays: 0,
    });
    expect(parse("MILL 1 1/1 ±7").data).toEqual({
      service: "milling",
      estKg: 1,
      dayMonth: "1/1",
      flexDays: 7,
    });
    expect(parse("DRY 5000 20/10 +3").data?.flexDays).toBe(3);
  });

  it.each([
    "DRY 0 20/10",
    "DRY -1 20/10",
    "DRY 1.5 20/10",
    "DRY 1e3 20/10",
    "DRY 5000 20/10 ±8",
    "DRY 5000 20/10 -3",
    "DRY 5000 20/10 3",
    "DRY 5000 20/10 ±1.5",
    "OTHER 5000 20/10",
    "DRY 5000 2026-10-20",
    "DRY 5000",
    "DRY 5000 20/10 ±1 extra",
    "DRY 99999999999999999999 20/10",
  ])("rejects invalid arguments: %s", (text) => {
    expect(parse(text).success).toBe(false);
  });
});

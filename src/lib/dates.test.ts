import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  joinManila,
  splitManila,
  todayManila,
} from "./dates";

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("daysBetween", () => {
  it("counts calendar days from one date to another", () => {
    expect(daysBetween("2026-10-15", "2026-11-03")).toBe(19);
    expect(daysBetween("2026-11-03", "2026-10-15")).toBe(-19);
    expect(daysBetween("2026-10-15", "2026-10-15")).toBe(0);
  });
});

describe("todayManila", () => {
  it("is already tomorrow in Manila after 16:00 UTC", () => {
    expect(todayManila(new Date("2026-10-15T16:30:00Z"))).toBe("2026-10-16");
  });
});

describe("splitManila", () => {
  it("reads a UTC timestamp as Manila wall time", () => {
    expect(splitManila("2026-10-15T17:30:00Z")).toEqual({
      date: "2026-10-16",
      time: "01:30",
    });
  });

  it("round-trips joinManila", () => {
    expect(splitManila(joinManila("2026-10-15", "08:15"))).toEqual({
      date: "2026-10-15",
      time: "08:15",
    });
  });
});

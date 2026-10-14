import { describe, expect, it } from "vitest";

import { joinManila, splitManila } from "./date-time-picker";

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

import { describe, expect, it } from "vitest";
import { canCancel, estimateMinor, orderStatusTones } from "./logic";

describe("canCancel", () => {
  it("allows cancelling until pickup or a decision closes it", () => {
    const open = Object.keys(orderStatusTones).filter((s) =>
      canCancel(s as keyof typeof orderStatusTones),
    );
    expect(open).toEqual(["requested", "accepted"]);
  });
});

describe("estimateMinor", () => {
  it("is kg × today's price in centavos", () => {
    expect(estimateMinor(2000, 4700)).toBe(9_400_000);
  });
});

import { describe, expect, it } from "vitest";
import {
  canCancel,
  estimateMinor,
  exceedsFree,
  freeKg,
  orderStatusTones,
} from "./logic";

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

describe("freeKg", () => {
  it("is on hand minus accepted, negative when over-promised", () => {
    expect(freeKg(1200, 500)).toBe(700);
    expect(freeKg(1200, 4000)).toBe(-2800);
  });
});

describe("exceedsFree", () => {
  it("flags an open request bigger than the free rice", () => {
    expect(exceedsFree({ kg: 800, status: "requested" }, 700)).toBe(true);
    expect(exceedsFree({ kg: 700, status: "requested" }, 700)).toBe(false);
  });

  it("ignores requests already decided", () => {
    expect(exceedsFree({ kg: 800, status: "accepted" }, 0)).toBe(false);
  });
});

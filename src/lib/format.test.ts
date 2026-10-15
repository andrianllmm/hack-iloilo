import { describe, expect, it } from "vitest";
import { formatKg, formatMoney, formatMoneySms, formatTonnes } from "./format";

describe("formatMoney", () => {
  it("shows pesos and centavos with the peso sign", () => {
    expect(formatMoney(123456)).toBe("₱1,234.56");
    expect(formatMoney(2_350_000_00)).toBe("₱2,350,000.00");
    expect(formatMoney(5)).toBe("₱0.05");
    expect(formatMoney(-12345)).toBe("-₱123.45");
  });
});

describe("formatMoneySms", () => {
  it("uses PHP since ₱ is not GSM-7", () => {
    expect(formatMoneySms(123456)).toBe("PHP 1,234.56");
    expect(formatMoneySms(-5)).toBe("-PHP 0.05");
  });
});

describe("formatKg", () => {
  it("groups thousands", () => {
    expect(formatKg(1234567)).toBe("1,234,567 kg");
    expect(formatKg(0)).toBe("0 kg");
  });
});

describe("formatTonnes", () => {
  it("shows tonnes with at most one decimal", () => {
    expect(formatTonnes(1_100_000)).toBe("1,100 t");
    expect(formatTonnes(56_000)).toBe("56 t");
    expect(formatTonnes(3_140)).toBe("3.1 t");
    expect(formatTonnes(30_960)).toBe("31 t");
  });
});

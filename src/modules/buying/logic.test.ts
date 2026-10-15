import { describe, expect, it } from "vitest";
import {
  applyOverride,
  formatVarietiesSms,
  parseOfferForm,
  parseOverrideForm,
  parseQuoteArgs,
  parseSellArgs,
  quoteSmsSchema,
  sellSmsSchema,
} from "./logic";

const valid = {
  clientId: "c3000000-0000-0000-0000-000000000001",
  varietyId: "11111111-1111-1111-1111-111111111111",
  estKg: "3000",
  harvestDate: "2026-11-25",
  bookedByPhone: "+639171234567",
};

describe("parseOfferForm", () => {
  it("accepts valid input and coerces kg to a positive integer", () => {
    const result = parseOfferForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.estKg).toBe(3000);
      expect(result.value.clientId).toBe(valid.clientId);
      expect(result.value.varietyId).toBe(valid.varietyId);
      expect(result.value.harvestDate).toBe("2026-11-25");
      expect(result.value.bookedByPhone).toBe("+639171234567");
    }
  });

  it("treats a blank variety as null", () => {
    const result = parseOfferForm({ ...valid, varietyId: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.varietyId).toBeNull();
  });

  it.each(["0", "-100", "abc", "10.5", ""])(
    "rejects a non-positive, non-integer kg: %s",
    (estKg) => {
      expect(parseOfferForm({ ...valid, estKg }).ok).toBe(false);
    },
  );

  it.each(["", "25/11/2026", "2026-13-01", "not-a-date"])(
    "rejects a bad harvest date: %s",
    (harvestDate) => {
      expect(parseOfferForm({ ...valid, harvestDate }).ok).toBe(false);
    },
  );

  it.each(["", "09171234567", "+0171234567", "+63 917 123 4567"])(
    "rejects a phone that is not E.164: %s",
    (bookedByPhone) => {
      expect(parseOfferForm({ ...valid, bookedByPhone }).ok).toBe(false);
    },
  );

  it("rejects a missing client id", () => {
    expect(parseOfferForm({ ...valid, clientId: "" }).ok).toBe(false);
  });
});

describe("parseQuoteArgs", () => {
  it("parses mc with a trailing % and an optional kg", () => {
    expect(parseQuoteArgs(["23%", "5000"])).toEqual({ mc: 23, kg: 5000 });
  });

  it("parses mc without a % sign", () => {
    expect(parseQuoteArgs(["23"])).toEqual({ mc: 23, kg: undefined });
  });

  it("parses a decimal mc", () => {
    expect(parseQuoteArgs(["14.5%"])).toEqual({ mc: 14.5, kg: undefined });
  });

  it.each([
    [[]],
    [["23%", "5000", "extra"]],
    [["abc"]],
    [["%"]],
    [["23%", "5.5"]],
    [["23%", "-100"]],
  ])("rejects malformed args: %j", (args) => {
    expect(parseQuoteArgs(args)).toBeNull();
  });

  it("feeds the schema a value it accepts", () => {
    const parsed = parseQuoteArgs(["23%", "5000"]);
    expect(quoteSmsSchema.safeParse(parsed).success).toBe(true);
  });

  it("lets the schema reject a non-positive or out-of-range mc", () => {
    expect(quoteSmsSchema.safeParse(parseQuoteArgs(["0"])).success).toBe(false);
    expect(quoteSmsSchema.safeParse(parseQuoteArgs(["100"])).success).toBe(
      false,
    );
  });
});

describe("parseSellArgs", () => {
  it("parses kg, variety (uppercased) and dd/mm", () => {
    expect(parseSellArgs(["3000", "rc222", "25/10"])).toEqual({
      estKg: 3000,
      varietyCode: "RC222",
      dayMonth: "25/10",
    });
  });

  it.each([
    [["3000", "RC222"]],
    [["3000", "RC222", "25/10", "extra"]],
    [["3.5", "RC222", "25/10"]],
    [["abc", "RC222", "25/10"]],
  ])("rejects the wrong number or shape of args: %j", (args) => {
    expect(parseSellArgs(args)).toBeNull();
  });

  it("feeds the schema a value it accepts", () => {
    const parsed = parseSellArgs(["3000", "RC222", "25/10"]);
    expect(sellSmsSchema.safeParse(parsed).success).toBe(true);
  });

  it("lets the schema reject a malformed dd/mm", () => {
    const parsed = { estKg: 3000, varietyCode: "RC222", dayMonth: "25-10" };
    expect(sellSmsSchema.safeParse(parsed).success).toBe(false);
  });
});

describe("formatVarietiesSms", () => {
  const codes = ["RC160", "RC216", "RC222"];

  it("leads with the count and lists every code in the given order", () => {
    const reply = formatVarietiesSms(codes, 320);
    expect(reply).toBe(
      "IRPC mga variety sang humay (3): RC160, RC216, RC222. Para magbaligya: SELL <kg> <variety> <dd/mm>",
    );
  });

  it("stays within the character limit", () => {
    expect(formatVarietiesSms(codes, 320).length).toBeLessThanOrEqual(320);
  });

  it("keeps the full count even when the list is truncated", () => {
    const max =
      "IRPC mga variety sang humay (3): RC160, RC216 .... Para magbaligya: SELL <kg> <variety> <dd/mm>"
        .length;
    const reply = formatVarietiesSms(codes, max);
    expect(reply.length).toBeLessThanOrEqual(max);
    expect(reply).toContain("(3)");
    expect(reply).toContain("...");
    expect(reply).toContain("RC160");
    expect(reply).not.toContain("RC222");
  });

  it("handles an empty list", () => {
    expect(formatVarietiesSms([], 320)).toBe(
      "IRPC: Wala pa sang nalista nga variety sang humay. Para magbaligya: SELL <kg> <variety> <dd/mm>",
    );
  });
});

describe("parseOverrideForm", () => {
  it("accepts a pesos price and a reason, converting to centavos", () => {
    const result = parseOverrideForm({
      priceMinorPerKg: "21.50",
      reason: "Loyal supplier",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priceMinorPerKg).toBe(2150);
      expect(result.value.reason).toBe("Loyal supplier");
    }
  });

  it("rejects a blank or whitespace-only reason", () => {
    expect(parseOverrideForm({ priceMinorPerKg: "21", reason: "" }).ok).toBe(
      false,
    );
    expect(parseOverrideForm({ priceMinorPerKg: "21", reason: "   " }).ok).toBe(
      false,
    );
  });

  it.each(["", "-1", "abc"])("rejects an invalid price: %s", (price) => {
    expect(
      parseOverrideForm({ priceMinorPerKg: price, reason: "any" }).ok,
    ).toBe(false);
  });
});

describe("applyOverride", () => {
  const deductions = { damaged: 10, immature: 5, foreign: 0, sack: 20 };

  it("recomputes the total and keeps the computed price as the original", () => {
    const result = applyOverride(
      { paidKg: 8000, priceMinorPerKg: 2100, deductions },
      { priceMinorPerKg: 2200, reason: "Premium quality" },
    );
    expect(result.priceMinorPerKg).toBe(2200);
    expect(result.totalMinor).toBe(8000 * 2200);
    expect(result.overrideReason).toBe("Premium quality");
    expect(result.deductions.original_minor_per_kg).toBe(2100);
    expect(result.deductions.damaged).toBe(10);
  });

  it("preserves the true original across repeated overrides", () => {
    const result = applyOverride(
      {
        paidKg: 8000,
        priceMinorPerKg: 2200,
        deductions: { ...deductions, original_minor_per_kg: 2100 },
      },
      { priceMinorPerKg: 2300, reason: "Second override" },
    );
    expect(result.deductions.original_minor_per_kg).toBe(2100);
  });
});

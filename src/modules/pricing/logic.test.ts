import { describe, expect, it } from "vitest";
import { electricityPerKg, parsePriceForm } from "./logic";

describe("electricityPerKg", () => {
  // (machine kWh + base kW × hours × days) × tariff ÷ kg, in centavos per kg.
  // Tariff is centavos per kWh (₱12.00/kWh = 1200).
  it("ignores base load when base_load_kw is 0", () => {
    // (1000 + 0) × 1200 ÷ 10000 = 120 centavos/kg (₱1.20)
    const perKg = electricityPerKg({
      machineKwh: 1000,
      kg: 10000,
      daysRun: 5,
      baseLoadKw: 0,
      hoursPerDay: 16,
      tariffMinorPerKwh: 1200,
    });
    expect(perKg).toBe(120);
  });

  it("adds the base load over the days run", () => {
    // base energy = 20 × 16 × 5 = 1600 kWh; total = 1000 + 1600 = 2600 kWh
    // 2600 × 1200 ÷ 10000 = 312 centavos/kg (₱3.12)
    const perKg = electricityPerKg({
      machineKwh: 1000,
      kg: 10000,
      daysRun: 5,
      baseLoadKw: 20,
      hoursPerDay: 16,
      tariffMinorPerKwh: 1200,
    });
    expect(perKg).toBe(312);
  });

  it("rounds to whole centavos", () => {
    // 1000 × 1200 ÷ 7000 = 171.43 → 171 centavos
    const perKg = electricityPerKg({
      machineKwh: 1000,
      kg: 7000,
      daysRun: 1,
      baseLoadKw: 0,
      hoursPerDay: 16,
      tariffMinorPerKwh: 1200,
    });
    expect(perKg).toBe(171);
  });
});

const validPriceForm = {
  effectiveDate: "2026-10-15",
  buyBase: "21.00",
  damaged: "0.25",
  immature: "0.10",
  foreign: "1.0",
  rice: "47",
  drying: "1.60",
  milling: "3.30",
};

describe("parsePriceForm", () => {
  it("converts peso inputs to integer centavos and assembles buy_rules", () => {
    const result = parsePriceForm(validPriceForm);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.effectiveDate).toBe("2026-10-15");
      expect(result.value.buyBaseMinorPerKg).toBe(2100);
      expect(result.value.riceMinorPerKg).toBe(4700);
      expect(result.value.dryingFeeMinorPerKg).toBe(160);
      expect(result.value.millingFeeMinorPerKg).toBe(330);
      expect(result.value.buyRules).toEqual({
        damaged: 0.25,
        immature: 0.1,
        foreign: 1,
        sack_kg: 0.1,
        mc_rule: "proportional",
      });
    }
  });

  it.each(["", "2026-13-01", "15/10/2026"])(
    "rejects a bad effective date: %s",
    (effectiveDate) => {
      expect(parsePriceForm({ ...validPriceForm, effectiveDate }).ok).toBe(
        false,
      );
    },
  );

  it.each(["-1", "abc", ""])("rejects a bad peso amount: %s", (buyBase) => {
    expect(parsePriceForm({ ...validPriceForm, buyBase }).ok).toBe(false);
  });

  it.each(["-0.1", "1.5", "abc"])(
    "rejects a deduction factor outside 0..1: %s",
    (damaged) => {
      expect(parsePriceForm({ ...validPriceForm, damaged }).ok).toBe(false);
    },
  );
});

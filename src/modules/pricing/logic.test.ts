import { describe, expect, it } from "vitest";
import {
  electricityPerKg,
  parsePriceForm,
  type PriceRule,
  priceReceiving,
  quote,
} from "./logic";

// Matches seed 07_pricing: ₱21/kg base at 25% MC, TRD deduction factors.
const samplePrices: PriceRule = {
  buy_base_minor_per_kg: 2100,
  buy_reference_mc: 25,
  buy_rules: {
    damaged: 0.25,
    immature: 0.1,
    foreign: 1,
    sack_kg: 0.1,
    mc_rule: "proportional",
  },
};

describe("quote", () => {
  // IRPC sample Receiving Report: 8,763 kg at ₱21/kg = ₱184,023.00.
  it("prices the IRPC sample at reference MC", () => {
    const q = quote(samplePrices, 25, 8763);
    expect(q.minorPerKg).toBe(2100);
    expect(q.totalMinor).toBe(18_402_300);
  });

  it("raises the price below reference MC (drier palay)", () => {
    // 2100 × (100 − 20) ÷ (100 − 25) = 2100 × 80 ÷ 75 = 2240
    expect(quote(samplePrices, 20).minorPerKg).toBe(2240);
  });

  it("lowers the price above reference MC (wetter palay)", () => {
    // 2100 × (100 − 30) ÷ (100 − 25) = 2100 × 70 ÷ 75 = 1960
    expect(quote(samplePrices, 30).minorPerKg).toBe(1960);
  });

  it("omits the total when no kilos are given", () => {
    expect(quote(samplePrices, 25).totalMinor).toBeUndefined();
  });

  it("never prices below zero at extreme MC", () => {
    expect(quote(samplePrices, 100).minorPerKg).toBe(0);
    expect(quote(samplePrices, 120).minorPerKg).toBe(0);
  });
});

describe("priceReceiving", () => {
  const base = {
    netKg: 10000,
    mc: 25,
    damagedPct: 0,
    immaturePct: 0,
    foreignPct: 0,
    bags: 0,
  };

  // IRPC sample with no deductions: 8,763 kg at ₱21/kg = ₱184,023.00.
  it("matches the IRPC sample when there is nothing to deduct", () => {
    const r = priceReceiving(samplePrices, { ...base, netKg: 8763 });
    expect(r.paidKg).toBe(8763);
    expect(r.minorPerKg).toBe(2100);
    expect(r.totalMinor).toBe(18_402_300);
    expect(r.deductions).toEqual({
      damaged: 0,
      immature: 0,
      foreign: 0,
      sack: 0,
    });
  });

  it("deducts a quarter of the damaged weight", () => {
    // 10000 × 4% × 0.25 = 100 kg
    const r = priceReceiving(samplePrices, { ...base, damagedPct: 4 });
    expect(r.deductions.damaged).toBe(100);
    expect(r.paidKg).toBe(9900);
  });

  it("deducts a tenth of the immature weight", () => {
    // 10000 × 5% × 0.10 = 50 kg
    const r = priceReceiving(samplePrices, { ...base, immaturePct: 5 });
    expect(r.deductions.immature).toBe(50);
    expect(r.paidKg).toBe(9950);
  });

  it("deducts all of the foreign matter", () => {
    // 10000 × 2% × 1.0 = 200 kg
    const r = priceReceiving(samplePrices, { ...base, foreignPct: 2 });
    expect(r.deductions.foreign).toBe(200);
    expect(r.paidKg).toBe(9800);
  });

  it("deducts the sack weight per bag", () => {
    // 100 bags × 0.1 kg = 10 kg
    const r = priceReceiving(samplePrices, { ...base, bags: 100 });
    expect(r.deductions.sack).toBe(10);
    expect(r.paidKg).toBe(9990);
  });

  it("combines every deduction and prices the paid weight", () => {
    const r = priceReceiving(samplePrices, {
      netKg: 10000,
      mc: 25,
      damagedPct: 4,
      immaturePct: 5,
      foreignPct: 2,
      bags: 100,
    });
    // 100 + 50 + 200 + 10 = 360 kg deducted; 9640 kg paid at ₱21.
    expect(r.paidKg).toBe(9640);
    expect(r.totalMinor).toBe(20_244_000);
  });

  it("rounds each deduction to whole kilos", () => {
    // 8763 × 3% × 0.25 = 65.7225 → 66 kg
    const r = priceReceiving(samplePrices, {
      ...base,
      netKg: 8763,
      damagedPct: 3,
    });
    expect(r.deductions.damaged).toBe(66);
    expect(r.paidKg).toBe(8697);
  });
});

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

  it("throws when kg is 0 instead of returning Infinity", () => {
    expect(() =>
      electricityPerKg({
        machineKwh: 1000,
        kg: 0,
        daysRun: 1,
        baseLoadKw: 0,
        hoursPerDay: 16,
        tariffMinorPerKwh: 1200,
      }),
    ).toThrow();
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

  it("names the failing field in the error", () => {
    const result = parsePriceForm({ ...validPriceForm, drying: "-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("drying fee");
  });
});

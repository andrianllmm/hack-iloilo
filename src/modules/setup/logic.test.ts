import { describe, expect, it } from "vitest";
import {
  type CapacityMachine,
  dailyCapacity,
  parseFacilityForm,
  parseMachineForm,
} from "./logic";

const dryer = (capacity_kg: number, active = true): CapacityMachine => ({
  type: "dryer",
  capacity_kg,
  cycle_hours: 8,
  kg_per_hour: null,
  active,
});
const mill = (kg_per_hour: number, active = true): CapacityMachine => ({
  type: "mill",
  capacity_kg: null,
  cycle_hours: null,
  kg_per_hour,
  active,
});

// Seed: 16 h/day, 8 h cycles, 5 × 10 t + 1 × 6 t dryers, one 3.1 t/h mill.
const seedFacility = { operating_hours_per_day: 16 };
const seedMachines = [
  ...Array.from({ length: 5 }, () => dryer(10_000)),
  dryer(6_000),
  mill(3_100),
];

describe("dailyCapacity", () => {
  it("computes the seed's dryer and mill kg/day", () => {
    expect(dailyCapacity(seedFacility, seedMachines)).toEqual({
      dryerKgPerDay: 112_000, // 56 t × 2 loads
      millKgPerDay: 49_600,
    });
  });

  it("excludes inactive machines", () => {
    const machines = [
      ...seedMachines,
      dryer(10_000, false),
      mill(5_000, false),
    ];
    expect(dailyCapacity(seedFacility, machines)).toEqual({
      dryerKgPerDay: 112_000,
      millKgPerDay: 49_600,
    });
  });

  it("counts only whole drying cycles", () => {
    expect(
      dailyCapacity({ operating_hours_per_day: 15 }, [dryer(10_000)])
        .dryerKgPerDay,
    ).toBe(10_000);
  });

  it("is zero with no machines", () => {
    expect(dailyCapacity(seedFacility, [])).toEqual({
      dryerKgPerDay: 0,
      millKgPerDay: 0,
    });
  });
});

const facilityRaw = {
  storageT: "1100",
  hours: "16",
  baseLoadKw: "20",
  tariff: "12.00",
  labor: "625",
  dryYieldPct: "89",
  idleThresholdPct: "30",
  notifyAheadN: "3",
};

describe("parseFacilityForm", () => {
  it("converts to column units", () => {
    expect(parseFacilityForm(facilityRaw)).toEqual({
      ok: true,
      value: {
        storage_capacity_kg: 1_100_000,
        operating_hours_per_day: 16,
        base_load_kw: 20,
        tariff_minor_per_kwh: 1200,
        labor_minor_per_hour: 62_500,
        dry_yield_pct: 89,
        idle_threshold_pct: 30,
        notify_ahead_n: 3,
      },
    });
  });

  it("rejects a blank or out-of-range field", () => {
    expect(parseFacilityForm({ ...facilityRaw, tariff: "" })).toEqual({
      ok: false,
      error: "Check the electricity tariff and try again.",
    });
    expect(parseFacilityForm({ ...facilityRaw, hours: "25" }).ok).toBe(false);
    expect(parseFacilityForm({ ...facilityRaw, notifyAheadN: "1.5" }).ok).toBe(
      false,
    );
  });
});

describe("parseMachineForm", () => {
  it("parses a dryer and drops mill fields", () => {
    expect(
      parseMachineForm({
        type: "dryer",
        code: " d7 ",
        loadT: "8",
        cycleHours: "7.5",
        millTph: "3",
        ratedKw: "15",
      }),
    ).toEqual({
      ok: true,
      value: {
        id: undefined,
        type: "dryer",
        code: "D7",
        capacity_kg: 8000,
        cycle_hours: 7.5,
        kg_per_hour: null,
        rated_kw: 15,
      },
    });
  });

  it("parses a mill and keeps its id", () => {
    const id = "6f1c2a4e-1b2c-4d3e-8f90-123456789abc";
    expect(
      parseMachineForm({
        id,
        type: "mill",
        code: "M1",
        loadT: "",
        cycleHours: "",
        millTph: "3.1",
        ratedKw: "75",
      }),
    ).toEqual({
      ok: true,
      value: {
        id,
        type: "mill",
        code: "M1",
        capacity_kg: null,
        cycle_hours: null,
        kg_per_hour: 3100,
        rated_kw: 75,
      },
    });
  });

  it("requires the fields for the machine type", () => {
    expect(
      parseMachineForm({ type: "dryer", code: "D7", loadT: "8", ratedKw: "0" }),
    ).toEqual({ ok: false, error: "Check the cycle hours and try again." });
    expect(
      parseMachineForm({ type: "mill", code: "M2", ratedKw: "0" }),
    ).toEqual({ ok: false, error: "Check the mill throughput and try again." });
  });
});

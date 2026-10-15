// M1. Setup: IRPC settings, machines, varieties, municipalities, seed data. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { z } from "zod";

/** Facility fields `dailyCapacity` reads. */
export type CapacityFacility = { operating_hours_per_day: number };

/** Machine fields `dailyCapacity` reads. */
export type CapacityMachine = {
  type: "dryer" | "mill";
  capacity_kg: number | null;
  cycle_hours: number | null;
  kg_per_hour: number | null;
  active: boolean;
};

export type DailyCapacity = { dryerKgPerDay: number; millKgPerDay: number };

/**
 * Daily dryer and mill throughput from active machines.
 * Dryer = Σ `capacity_kg` × ⌊hours ÷ `cycle_hours`⌋ (only whole loads finish);
 * mill = Σ `kg_per_hour` × hours. Rounded down to whole kg.
 */
export function dailyCapacity(
  facility: CapacityFacility,
  machines: CapacityMachine[],
): DailyCapacity {
  const hours = facility.operating_hours_per_day;
  let dryer = 0;
  let mill = 0;
  for (const m of machines) {
    if (!m.active) continue;
    if (m.type === "dryer" && m.capacity_kg && m.cycle_hours) {
      dryer += m.capacity_kg * Math.floor(hours / m.cycle_hours);
    } else if (m.type === "mill" && m.kg_per_hour) {
      mill += m.kg_per_hour * hours;
    }
  }
  return { dryerKgPerDay: Math.floor(dryer), millKgPerDay: Math.floor(mill) };
}

// A required number field: reject a blank so an empty input never reads as 0.
const number = z.string().trim().min(1).pipe(z.coerce.number());
const nonNegative = number.pipe(z.number().nonnegative());
const positive = number.pipe(z.number().positive());
// One decimal place, matching numeric(4,1) columns.
const tenths = (n: number) => Math.round(n * 10) / 10;
const hundredths = (n: number) => Math.round(n * 100) / 100;
// Tonnes typed by the manager, stored as integer kg.
const tonnesToKg = (t: number) => Math.round(t * 1000);
// Pesos typed by the manager, stored as integer centavos.
const pesosToMinor = (p: number) => Math.round(p * 100);
const pct = number.pipe(z.number().min(0).max(100)).transform(hundredths);

const facilityForm = z.object({
  storageT: nonNegative.transform(tonnesToKg),
  hours: number.pipe(z.number().positive().max(24)).transform(tenths),
  baseLoadKw: nonNegative.transform(hundredths),
  tariff: nonNegative.transform(pesosToMinor),
  labor: nonNegative.transform(pesosToMinor),
  dryYieldPct: pct,
  idleThresholdPct: pct,
  notifyAheadN: number.pipe(z.number().int().nonnegative()),
});

/** Validated facility settings, in column units. */
export type FacilityInput = {
  storage_capacity_kg: number;
  operating_hours_per_day: number;
  base_load_kw: number;
  tariff_minor_per_kwh: number;
  labor_minor_per_hour: number;
  dry_yield_pct: number;
  idle_threshold_pct: number;
  notify_ahead_n: number;
};

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

const FACILITY_LABELS: Record<string, string> = {
  storageT: "storage capacity",
  hours: "operating hours",
  baseLoadKw: "base load",
  tariff: "electricity tariff",
  labor: "labor cost",
  dryYieldPct: "dry yield",
  idleThresholdPct: "idle threshold",
  notifyAheadN: "notify-ahead count",
};

function firstError(
  issues: z.core.$ZodIssue[],
  labels: Record<string, string>,
  fallback: string,
): string {
  const field = issues[0]?.path[0];
  const label = typeof field === "string" ? labels[field] : undefined;
  return label ? `Check the ${label} and try again.` : fallback;
}

/** Parse and validate raw facility-form values from untrusted input. */
export function parseFacilityForm(
  raw: Record<string, unknown>,
): ParseResult<FacilityInput> {
  const parsed = facilityForm.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(
        parsed.error.issues,
        FACILITY_LABELS,
        "Check the settings and try again.",
      ),
    };
  }
  const v = parsed.data;
  return {
    ok: true,
    value: {
      storage_capacity_kg: v.storageT,
      operating_hours_per_day: v.hours,
      base_load_kw: v.baseLoadKw,
      tariff_minor_per_kwh: v.tariff,
      labor_minor_per_hour: v.labor,
      dry_yield_pct: v.dryYieldPct,
      idle_threshold_pct: v.idleThresholdPct,
      notify_ahead_n: v.notifyAheadN,
    },
  };
}

// Blank optional fields (the other machine type's inputs) parse as undefined.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    schema.optional(),
  );

const machineForm = z
  .object({
    id: optional(z.uuid()),
    type: z.enum(["dryer", "mill"]),
    code: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .transform((c) => c.toUpperCase()),
    loadT: optional(positive.transform(tonnesToKg)),
    cycleHours: optional(
      number.pipe(z.number().positive().max(99.9)).transform(tenths),
    ),
    millTph: optional(positive.transform(tonnesToKg)),
    ratedKw: nonNegative.transform(hundredths),
  })
  .superRefine((v, ctx) => {
    const missing = (path: string) =>
      ctx.addIssue({ code: "custom", path: [path], message: "Required" });
    if (v.type === "dryer") {
      if (v.loadT === undefined) missing("loadT");
      if (v.cycleHours === undefined) missing("cycleHours");
    } else if (v.millTph === undefined) {
      missing("millTph");
    }
  });

/** Validated machine row, in column units. `id` is absent for a new machine. */
export type MachineInput = {
  id?: string;
  type: "dryer" | "mill";
  code: string;
  capacity_kg: number | null;
  cycle_hours: number | null;
  kg_per_hour: number | null;
  rated_kw: number;
};

const MACHINE_LABELS: Record<string, string> = {
  type: "machine type",
  code: "machine code",
  loadT: "load size",
  cycleHours: "cycle hours",
  millTph: "mill throughput",
  ratedKw: "rated kW",
};

/** Parse and validate raw machine-form values from untrusted input. */
export function parseMachineForm(
  raw: Record<string, unknown>,
): ParseResult<MachineInput> {
  const parsed = machineForm.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(
        parsed.error.issues,
        MACHINE_LABELS,
        "Check the machine details and try again.",
      ),
    };
  }
  const v = parsed.data;
  const dryer = v.type === "dryer";
  return {
    ok: true,
    value: {
      id: v.id,
      type: v.type,
      code: v.code,
      // Null the other type's fields so the row matches the table check.
      capacity_kg: dryer ? (v.loadT ?? null) : null,
      cycle_hours: dryer ? (v.cycleHours ?? null) : null,
      kg_per_hour: dryer ? null : (v.millTph ?? null),
      rated_kw: v.ratedKw,
    },
  };
}

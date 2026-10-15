// M1. Setup: IRPC settings, machines, varieties, municipalities, seed data. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { type DailyCapacity, dailyCapacity } from "./logic";

export type Facility = Database["public"]["Tables"]["facilities"]["Row"];
export type Variety = Database["public"]["Tables"]["varieties"]["Row"];
export type Machine = Database["public"]["Tables"]["machines"]["Row"];
export type MachineType = Database["public"]["Enums"]["machine_type"];

/** All rice varieties, ordered by code, for pickers. */
export async function listVarieties(): Promise<Variety[]> {
  const { data, error } = await db().from("varieties").select().order("code");
  if (error) throw new Error(`Varieties: ${error.message}`);
  return data;
}

/** The variety with this code (case-insensitive), or null. Used by SMS `SELL`. */
export async function findVarietyByCode(code: string): Promise<Variety | null> {
  const { data, error } = await db()
    .from("varieties")
    .select()
    .ilike("code", code)
    .maybeSingle();
  if (error) throw new Error(`Variety by code: ${error.message}`);
  return data;
}

/** Active machines of one type (dryers or the mill), ordered by code. */
export async function listMachines(type: MachineType): Promise<Machine[]> {
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("machines")
    .select()
    .eq("facility_id", facility.id)
    .eq("type", type)
    .eq("active", true)
    .order("code");
  if (error) throw new Error(`Machines: ${error.message}`);
  return data;
}

/** The single IRPC facility. Memoized per request; never hard-code its id. */
export const currentFacility = cache(async (): Promise<Facility> => {
  const { data, error } = await db()
    .from("facilities")
    .select()
    .order("created_at")
    .limit(1)
    .single();
  if (error) throw new Error(`No facility: ${error.message}`);
  return data;
});

export type CapacitySettings = {
  facility: Facility;
  machines: Machine[];
} & DailyCapacity;

/** The facility, all its machines (active or not) and its daily capacity. */
export async function capacitySettings(): Promise<CapacitySettings> {
  const facility = await currentFacility();
  const { data: machines, error } = await db()
    .from("machines")
    .select()
    .eq("facility_id", facility.id)
    .order("type")
    .order("code");
  if (error) throw new Error(`Machines: ${error.message}`);
  return { facility, machines, ...dailyCapacity(facility, machines) };
}

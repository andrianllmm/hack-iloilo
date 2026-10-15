"use server";

// M1. Setup: IRPC settings, machines, varieties, municipalities, seed data. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { requireRole } from "@/modules/accounts/auth";
import { parseFacilityForm, parseMachineForm } from "./logic";
import { currentFacility } from "./queries";

export type SettingsFormState =
  { ok: true; message: string } | { ok: false; error: string } | undefined;

/** Save the facility's capacity, cost and planning settings. Manager only. */
export async function saveFacility(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireRole("manager");

  const parsed = parseFacilityForm(Object.fromEntries(formData));
  if (!parsed.ok) return parsed;

  const facility = await currentFacility();
  const { error } = await db()
    .from("facilities")
    .update(parsed.value)
    .eq("id", facility.id);
  if (error) return { ok: false, error: `Save settings: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/** Add a machine, or edit one when the form carries an id. Manager only. */
export async function saveMachine(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireRole("manager");

  const parsed = parseMachineForm(Object.fromEntries(formData));
  if (!parsed.ok) return parsed;
  const { id, ...row } = parsed.value;

  const facility = await currentFacility();
  const { error } = id
    ? await db()
        .from("machines")
        .update(row)
        .eq("id", id)
        .eq("facility_id", facility.id)
    : await db()
        .from("machines")
        .insert({ ...row, facility_id: facility.id });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? `Machine code ${row.code} is already used.`
          : `Save machine: ${error.message}`,
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `Machine ${row.code} saved.` };
}

const activeInput = z.object({ id: z.uuid(), active: z.boolean() });

/** Activate or deactivate a machine. Manager only. */
export async function setMachineActive(
  id: string,
  active: boolean,
): Promise<SettingsFormState> {
  await requireRole("manager");

  const parsed = activeInput.safeParse({ id, active });
  if (!parsed.success) return { ok: false, error: "Unknown machine." };

  const facility = await currentFacility();
  const { error } = await db()
    .from("machines")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id)
    .eq("facility_id", facility.id);
  if (error) return { ok: false, error: `Update machine: ${error.message}` };

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: active ? "Machine activated." : "Machine deactivated.",
  };
}

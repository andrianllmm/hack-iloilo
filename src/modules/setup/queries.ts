// M1. Setup: IRPC settings, machines, varieties, municipalities, seed data. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type Facility = Database["public"]["Tables"]["facilities"]["Row"];

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

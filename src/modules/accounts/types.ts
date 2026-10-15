import type { Database } from "@/lib/supabase/database.types";
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientKind = Client["kind"];
export type ClientDefaults = Partial<
  Pick<Client, "name" | "kind" | "municipality_id" | "coop_id">
>;
export type Municipality = Pick<
  Database["public"]["Tables"]["municipalities"]["Row"],
  "id" | "name"
>;

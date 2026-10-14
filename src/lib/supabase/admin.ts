import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client for all data access (RLS has no public policies).
 * Server-side only; check the staff role before calling from actions.
 */
export function db() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  client ??= createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}

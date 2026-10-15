import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"] & {
  email: string;
};

/** The signed-in staff member, or null. Memoized per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await db()
    .from("staff")
    .select()
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return data ? { ...data, email: user.email ?? "" } : null;
});

/**
 * Returns the signed-in staff member, redirecting to /login if there is none.
 * With a role, also requires that role (managers pass every check).
 */
export async function requireRole(role?: StaffRole): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (role === "manager" && staff.role !== "manager") redirect("/capacity");
  return staff;
}

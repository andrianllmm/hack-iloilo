import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole, type StaffRole } from "@/modules/accounts/auth";

async function Gate({
  role,
  children,
}: {
  role: StaffRole;
  children: React.ReactNode;
}) {
  await requireRole(role);
  return children;
}

/**
 * Renders children only for the given role. The session read streams behind
 * Suspense, as Cache Components requires.
 */
export function RoleGate({
  role,
  children,
}: {
  role: StaffRole;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Gate role={role}>{children}</Gate>
    </Suspense>
  );
}

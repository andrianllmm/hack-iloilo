import { cn } from "cn";
import type { Prescription } from "../types";
import { PrescriptionCard } from "./prescription-card";

/** Undecided suggestions as cards. Render for managers only. */
export function PrescriptionList({
  prescriptions,
  className,
}: {
  prescriptions: Prescription[];
  className?: string;
}) {
  const open = prescriptions.filter((p) => !p.decision);
  if (!open.length) return null;
  return (
    <div className={cn("grid gap-4", className)}>
      {open.map((p) => (
        <PrescriptionCard key={p.key} prescription={p} />
      ))}
    </div>
  );
}

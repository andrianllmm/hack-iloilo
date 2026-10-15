import { Badge } from "@/components/ui/badge";
import { formatTonnes } from "@/lib/format";
import { cn } from "cn";
import { expectedKg } from "../logic";
import type { DayPool } from "../types";

/** Dot + word, so status never relies on colour alone. */
function StatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "warning" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant={tone === "destructive" ? "destructive" : "secondary"}
      className={cn(
        "h-6 gap-1.5 rounded-md px-2 font-semibold",
        tone === "neutral" && "text-muted-foreground",
        tone === "warning" &&
          "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

export function DayBadge({ day }: { day: DayPool }) {
  if (day.overloaded) {
    return (
      <StatusBadge tone="destructive">
        {formatTonnes(day.overflowKg)} over
      </StatusBadge>
    );
  }
  if (day.idle) return <StatusBadge tone="warning">Idle</StatusBadge>;
  const pct = day.capacityKg
    ? Math.round((expectedKg(day) / day.capacityKg) * 100)
    : null;
  return (
    <StatusBadge tone="neutral">{pct === null ? "—" : `${pct}%`}</StatusBadge>
  );
}

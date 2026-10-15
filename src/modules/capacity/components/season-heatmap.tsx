import { Card, CardContent } from "@/components/ui/card";
import { formatTonnes } from "@/lib/format";
import { cn } from "cn";
import {
  dayLabel,
  type HeatLevel,
  heatLevel,
  type SeasonDay,
  seasonMonths,
} from "../logic";

// One hue, light to dark; overloaded takes the status colour.
const shades: Record<HeatLevel, string> = {
  0: "bg-muted",
  1: "bg-primary/20",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
  over: "bg-destructive",
};

const levelLabels: [HeatLevel, string][] = [
  [0, "0%"],
  [1, "< 25%"],
  [2, "25–50%"],
  [3, "50–85%"],
  [4, "≥ 85%"],
  ["over", "Overloaded"],
];

// Expected days are hatched and dashed, so past vs future never relies on colour.
const hatch =
  "bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--background)_3px_5px)] outline-1 -outline-offset-1 outline-dashed outline-foreground/40";

const monthName = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

const dayNumbers = Array.from({ length: 31 }, (_, i) => i + 1);

function describe(day: SeasonDay): string {
  const what = day.kind === "record" ? "dried (batches)" : "expected";
  const pct = day.pct === null ? "" : ` (${day.pct}%)`;
  const over = day.overloaded ? ", overloaded" : "";
  return `${dayLabel(day.date)}: ${formatTonnes(day.kg)} ${what} of ${formatTonnes(day.capacityKg)}${pct}${over}`;
}

/** Dryer utilization per day by month: batch records before today, the plan from today. */
export function SeasonHeatmap({
  days,
  today,
}: {
  days: SeasonDay[];
  today: string;
}) {
  const months = seasonMonths(days);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Dryer season</h2>
          <p className="text-sm text-muted-foreground">
            Share of daily dryer capacity. Before today from batch records; from
            today, bookings, accepted offers and the forecast (mid).
          </p>
        </div>

        <div className="overflow-x-auto">
          <div
            role="grid"
            aria-label="Dryer utilization by day"
            className="grid min-w-[40rem] grid-cols-[4.5rem_repeat(31,minmax(0,1fr))] gap-0.5"
          >
            <div />
            {dayNumbers.map((n) => (
              <div
                key={n}
                className="text-center text-[10px] text-muted-foreground tabular-nums"
              >
                {n % 5 === 1 ? n : ""}
              </div>
            ))}
            {months.map(({ month, days }) => (
              <div key={month} role="row" className="contents">
                <div
                  role="rowheader"
                  className="pr-2 text-xs font-medium whitespace-nowrap"
                >
                  {monthName.format(new Date(`${month}-01T00:00:00Z`))}
                </div>
                {days.map((day) => (
                  <div
                    key={day.date}
                    role="gridcell"
                    title={describe(day)}
                    aria-label={describe(day)}
                    aria-current={day.date === today ? "date" : undefined}
                    className={cn(
                      "aspect-square rounded-sm",
                      shades[heatLevel(day)],
                      day.kind === "expected" && hatch,
                      day.date === today &&
                        "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                    )}
                  />
                ))}
                {/* Pad short months so the next row starts at day 1. */}
                {dayNumbers.slice(days.length).map((n) => (
                  <div key={n} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-primary/70" />
            Recorded
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm bg-primary/70", hatch)} />
            Expected
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm ring-2 ring-foreground" />
            Today
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {levelLabels.map(([level, label]) => (
              <span key={level} className="flex items-center gap-1">
                <span className={cn("size-3 rounded-sm", shades[level])} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

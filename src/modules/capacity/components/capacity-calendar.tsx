"use client";

import { useEffect } from "react";
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarHeader,
  CalendarProvider,
  type CalendarState,
  type Feature,
  monthsForLocale,
  useCalendarMonth,
  useCalendarYear,
} from "@/components/kibo-ui/calendar";
import { formatTonnes } from "@/lib/format";
import { cn } from "cn";
import { dayLabel, expectedKg } from "../logic";
import type { DayPool } from "../types";
import { DayBadge } from "./day-badge";

// Kibo matches features by local calendar day, so build local dates.
const localDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const months = monthsForLocale("en-US");

function MonthLabel() {
  const [month] = useCalendarMonth();
  const [year] = useCalendarYear();
  return (
    <span className="font-semibold">
      {months[month]} {year}
    </span>
  );
}

/** Opens on the window's first month; the atoms are global, so reset on mount. */
function useStartMonth(date: string) {
  const [, setMonth] = useCalendarMonth();
  const [, setYear] = useCalendarYear();
  useEffect(() => {
    setYear(Number(date.slice(0, 4)));
    setMonth((Number(date.slice(5, 7)) - 1) as CalendarState["month"]);
  }, [date, setMonth, setYear]);
}

/** Month calendar of dryer load per day. Clicking a day selects it. */
export function CapacityCalendar({
  days,
  today,
  onSelect,
}: {
  days: DayPool[];
  today: string;
  onSelect: (date: string) => void;
}) {
  useStartMonth(days[0]?.date ?? "");
  const byId = new Map(days.map((d) => [d.date, d]));
  const features: Feature[] = days.map((d) => ({
    id: d.date,
    name: dayLabel(d.date),
    startAt: localDate(d.date),
    endAt: localDate(d.date),
    status: { id: "dryer", name: "Dryer", color: "" },
  }));

  return (
    // Cells are square by default; keep them compact on wide screens.
    <CalendarProvider className="[&_.aspect-square]:aspect-auto [&_.aspect-square]:min-h-24">
      <CalendarDate>
        <MonthLabel />
        <CalendarDatePagination />
      </CalendarDate>
      <CalendarHeader className="border-t" />
      <CalendarBody features={features}>
        {({ feature }) => {
          const day = byId.get(feature.id);
          if (!day) return null;
          return (
            <button
              key={feature.id}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-label={`${feature.name}: ${formatTonnes(expectedKg(day))} of ${formatTonnes(day.capacityKg)}`}
              aria-current={day.date === today ? "date" : undefined}
              // Stretch the click target over the whole cell.
              className={cn(
                "flex flex-col items-start gap-1 text-left after:absolute after:inset-0 after:content-[''] hover:after:bg-muted/50 focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50",
                day.date === today &&
                  "after:ring-2 after:ring-primary after:ring-inset",
              )}
            >
              {day.date === today && (
                <span className="absolute top-1 right-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Today
                </span>
              )}
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatTonnes(expectedKg(day))}
              </span>
              <DayBadge day={day} />
            </button>
          );
        }}
      </CalendarBody>
    </CalendarProvider>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTonnes } from "@/lib/format";
import { dayLabel, expectedKg, headline, shortDay } from "../logic";
import type { DayPool } from "../types";
import { CapacityCalendar } from "./capacity-calendar";
import { LoadChart, loadConfig, shownSources } from "./load-chart";

/** A booking as the day panel lists it. */
export type PanelBooking = {
  id: string;
  ref: string;
  client: string;
  estKg: number;
  flexDays: number;
  reschedule: boolean;
};

const plainTonnes = (kg: number) =>
  (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 });

const span = (from: string, to: string) =>
  from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;

/** Capacity page: pool tabs, headline tiles, stacked load chart, day grid and day panel. */
export function CapacityView({
  days,
  bookings,
  idleThresholdPct,
  range,
  today,
  suggestions,
}: {
  days: DayPool[] | null;
  bookings: Record<string, PanelBooking[]>;
  idleThresholdPct: number;
  range: { from: string; to: string };
  today: string;
  /** Suggested actions per date, shown in the day panel (M10). */
  suggestions?: Record<string, React.ReactNode>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const day = days?.find((d) => d.date === selected);

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Capacity</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {span(range.from, range.to)}
            <Badge>Today, {shortDay(today)}</Badge>
          </p>
        </div>
        <Tabs value="dryer">
          <TabsList aria-label="Pool">
            {[
              ["overall", "Overall"],
              ["dryer", "Dryer"],
              ["storage", "Storage"],
              ["mill", "Mill"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                disabled={value !== "dryer"}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {days === null ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Capacity couldn&apos;t load</EmptyTitle>
            <EmptyDescription>
              Check the connection and try again.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            {pending ? "Retrying…" : "Retry"}
          </Button>
        </Empty>
      ) : (
        <>
          <Headline days={days} idleThresholdPct={idleThresholdPct} />

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <h2 className="flex-1 font-semibold">Dryer load</h2>
                {shownSources(days).map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="size-3 shrink-0"
                      style={{ background: loadConfig[s].color }}
                    />
                    {loadConfig[s].label}
                  </span>
                ))}
              </div>
              <LoadChart days={days} today={today} onSelect={setSelected} />
            </CardContent>
          </Card>

          <Card className="py-0">
            <CapacityCalendar
              days={days}
              today={today}
              onSelect={setSelected}
            />
          </Card>
        </>
      )}

      <Sheet
        open={day !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent>
          {day && (
            <DayPanel
              day={day}
              bookings={bookings[day.date] ?? []}
              suggestions={suggestions?.[day.date]}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Headline({
  days,
  idleThresholdPct,
}: {
  days: DayPool[];
  idleThresholdPct: number;
}) {
  const h = headline(days);
  const first = h.overloaded[0];
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Tile
        label="Dryer use"
        value={h.utilizationPct === null ? "—" : `${h.utilizationPct}%`}
        note={`${plainTonnes(h.expectedKg)} of ${formatTonnes(h.capacityKg)}`}
      />
      <Tile
        label="Overloaded days"
        value={String(h.overloaded.length)}
        note={
          first
            ? `Next: ${shortDay(first.date)}, ${formatTonnes(first.overflowKg)} over`
            : "None"
        }
      />
      <Tile
        label="Idle days"
        value={String(h.idleDays)}
        note={`Under ${idleThresholdPct}% full`}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <span className="text-sm font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </CardContent>
    </Card>
  );
}

function DayPanel({
  day,
  bookings,
  suggestions,
}: {
  day: DayPool;
  bookings: PanelBooking[];
  suggestions?: React.ReactNode;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{dayLabel(day.date)}</SheetTitle>
        <SheetDescription>
          Dryer: {formatTonnes(expectedKg(day))} of{" "}
          {formatTonnes(day.capacityKg)}
          {day.overloaded && (
            <span className="font-medium text-destructive">
              {" "}
              · {formatTonnes(day.overflowKg)} over
            </span>
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Bookings ({bookings.length})</h3>
          {bookings.length ? (
            <ul className="divide-y rounded-lg border">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{b.client}</span>
                    <span className="text-xs text-muted-foreground">
                      {b.ref} ·{" "}
                      {b.flexDays
                        ? `can move ${b.flexDays} ${b.flexDays === 1 ? "day" : "days"}`
                        : "fixed date"}
                      {b.reschedule && " · asked to move"}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {formatTonnes(b.estKg)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No bookings.</p>
          )}
        </section>
        {suggestions}
      </div>
    </>
  );
}

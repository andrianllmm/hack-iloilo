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
import {
  dayLabel,
  expectedKg,
  headline,
  idleStretches,
  poolDays,
  shortDay,
  sources,
} from "../logic";
import type { DayPool, Pool } from "../types";
import { CapacityCalendar } from "./capacity-calendar";
import { DayBadge } from "./day-badge";
import {
  formatRange,
  LoadChart,
  loadConfig,
  shownSources,
  sourceLabels,
} from "./load-chart";

const pools: Pool[] = ["dryer", "storage", "mill"];

const poolNames: Record<Pool, string> = {
  dryer: "Dryer",
  storage: "Storage",
  mill: "Mill",
};

/** A booking as the day panel lists it. */
export type PanelBooking = {
  id: string;
  ref: string;
  service: "drying" | "milling";
  client: string;
  estKg: number;
  flexDays: number;
  reschedule: boolean;
};

/** An accepted offer as the day panel lists it, by harvest date. */
export type PanelOffer = {
  id: string;
  ref: string;
  client: string;
  variety: string | null;
  estKg: number;
};

const plainTonnes = (kg: number) =>
  (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 });

const span = (from: string, to: string) =>
  from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;

/** Capacity page: pool tabs, headline tiles, stacked load chart, day grid and day panel. */
export function CapacityView({
  days: allDays,
  bookings,
  offers,
  idleThresholdPct,
  range,
  today,
  suggestions,
}: {
  /** Every pool, as `capacityByDay` returns it. */
  days: DayPool[] | null;
  bookings: Record<string, PanelBooking[]>;
  offers: Record<string, PanelOffer[]>;
  idleThresholdPct: number;
  range: { from: string; to: string };
  today: string;
  /** Suggested actions per date, shown in the day panel (M10). */
  suggestions?: Record<string, React.ReactNode>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pool, setPool] = useState<Pool>("dryer");
  const [selected, setSelected] = useState<string | null>(null);
  const days = allDays && poolDays(allDays, pool);
  const selectedDays = allDays?.filter((d) => d.date === selected) ?? [];
  const config = loadConfig(pool);

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
        <Tabs value={pool} onValueChange={(v) => setPool(v as Pool)}>
          <TabsList aria-label="Pool">
            {pools.map((p) => (
              <TabsTrigger key={p} value={p}>
                {poolNames[p]}
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
          <Headline
            pool={pool}
            days={days}
            idleThresholdPct={idleThresholdPct}
          />

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <h2 className="flex-1 font-semibold">{poolNames[pool]} load</h2>
                {shownSources(days).map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="size-3 shrink-0"
                      style={{ background: config[s].color }}
                    />
                    {config[s].label}
                  </span>
                ))}
              </div>
              <LoadChart
                pool={pool}
                days={days}
                today={today}
                onSelect={setSelected}
              />
              <IdleNote days={days} />
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
        open={selectedDays.length > 0}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent>
          {selected && selectedDays.length > 0 && (
            <DayPanel
              date={selected}
              days={selectedDays}
              bookings={bookings[selected] ?? []}
              offers={offers[selected] ?? []}
              suggestions={suggestions?.[selected]}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Headline({
  pool,
  days,
  idleThresholdPct,
}: {
  pool: Pool;
  days: DayPool[];
  idleThresholdPct: number;
}) {
  const h = headline(days);
  const first = h.overloaded[0];
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Tile
        label={`${poolNames[pool]} use`}
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

/** Idle stretches in words, under the chart. */
function IdleNote({ days }: { days: DayPool[] }) {
  const stretches = idleStretches(days);
  if (!stretches.length) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Idle:{" "}
      {stretches
        .map(
          (s) =>
            `${span(s.from, s.to)} (${s.days} ${s.days === 1 ? "day" : "days"})`,
        )
        .join(", ")}
    </p>
  );
}

function DayPanel({
  date,
  days,
  bookings,
  offers,
  suggestions,
}: {
  date: string;
  /** This date in every pool. */
  days: DayPool[];
  bookings: PanelBooking[];
  offers: PanelOffer[];
  suggestions?: React.ReactNode;
}) {
  const overloaded = days.filter((d) => d.overloaded);
  return (
    <>
      <SheetHeader>
        <SheetTitle>{dayLabel(date)}</SheetTitle>
        <SheetDescription>
          {overloaded.length
            ? overloaded
                .map(
                  (d) =>
                    `${poolNames[d.pool]} ${formatTonnes(d.overflowKg)} over`,
                )
                .join(" · ")
            : "Within capacity"}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Load</h3>
          <ul className="divide-y rounded-lg border">
            {days.map((d) => (
              <li key={d.pool} className="flex flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{poolNames[d.pool]}</span>
                  <DayBadge day={d} />
                </div>
                <span className="text-sm tabular-nums">
                  {formatTonnes(expectedKg(d))} of {formatTonnes(d.capacityKg)}
                </span>
                {sources.map(
                  (s) =>
                    d.load[s].high > 0 && (
                      <span
                        key={s}
                        className="flex justify-between gap-3 text-xs text-muted-foreground"
                      >
                        {sourceLabels[d.pool][s]}
                        <span className="tabular-nums">
                          {formatRange(d.load[s])}
                        </span>
                      </span>
                    ),
                )}
              </li>
            ))}
          </ul>
        </section>
        {(["drying", "milling"] as const).map((service) => (
          <BookingList
            key={service}
            title={
              service === "drying" ? "Drying bookings" : "Milling bookings"
            }
            bookings={bookings.filter((b) => b.service === service)}
          />
        ))}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Accepted offers harvesting ({offers.length})
          </h3>
          {offers.length ? (
            <ul className="divide-y rounded-lg border">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{o.client}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.ref}
                      {o.variety && ` · ${o.variety}`}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {formatTonnes(o.estKg)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No offers.</p>
          )}
        </section>
        {suggestions}
      </div>
    </>
  );
}

function BookingList({
  title,
  bookings,
}: {
  title: string;
  bookings: PanelBooking[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">
        {title} ({bookings.length})
      </h3>
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
  );
}

"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatTonnes } from "@/lib/format";
import { dayLabel, idleStretches, sources } from "../logic";
import type { DayPool, Pool, Range, Source } from "../types";

const colors: Record<Source, string> = {
  confirmed: "var(--chart-2)",
  offer: "var(--chart-3)",
  forecast: "var(--chart-5)",
};

/** What each source means in each pool. */
export const sourceLabels: Record<Pool, Record<Source, string>> = {
  dryer: {
    confirmed: "Bookings",
    offer: "Accepted offers",
    forecast: "Forecast",
  },
  storage: {
    confirmed: "In storage now",
    offer: "Dried offers",
    forecast: "Dried forecast",
  },
  mill: {
    confirmed: "Bookings and stock",
    offer: "Stock from offers",
    forecast: "Stock from forecast",
  },
};

/** Chart colours and labels for one pool. */
export function loadConfig(pool: Pool) {
  return Object.fromEntries(
    sources.map((s) => [s, { label: sourceLabels[pool][s], color: colors[s] }]),
  ) as Record<Source, { label: string; color: string }> satisfies ChartConfig;
}

/** Sources with load in the window; at least the first, so the chart is never empty. */
export function shownSources(days: DayPool[]): readonly Source[] {
  const shown = sources.filter((s) => days.some((d) => d.load[s].high > 0));
  return shown.length ? shown : ["confirmed"];
}

type Row = Record<Source, number> & {
  date: string;
  /** `+10 t` on an overloaded day, else empty. */
  overflow: string;
  day: DayPool;
};

const tonnes = (kg: number) => kg / 1000;

/** `3.1 t`, or `3.1 t (1.8–4.6)` when low and high differ. */
export function formatRange(r: Range): string {
  if (r.low === r.high) return formatTonnes(r.mid);
  const t = (kg: number) =>
    (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${formatTonnes(r.mid)} (${t(r.low)}–${t(r.high)})`;
}

const month = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

function LoadTooltip({
  active,
  payload,
  pool,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  pool: Pool;
}) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  const { day } = row;
  return (
    <div className="grid gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{dayLabel(day.date)}</div>
      {sources.map(
        (s) =>
          day.load[s].high > 0 && (
            <div key={s} className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {sourceLabels[pool][s]}
              </span>
              <span className="tabular-nums">{formatRange(day.load[s])}</span>
            </div>
          ),
      )}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Capacity</span>
        <span className="tabular-nums">{formatTonnes(day.capacityKg)}</span>
      </div>
      {day.overloaded && (
        <div className="font-medium text-destructive">
          {formatTonnes(day.overflowKg)} over capacity
        </div>
      )}
    </div>
  );
}

/** One line above the stack; recharts' default label wraps to the bar width. */
function OverflowLabel({
  x,
  y,
  width,
  value,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: unknown;
}) {
  if (!value) return null;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 8}
      textAnchor="middle"
      className="fill-destructive text-xs font-semibold"
    >
      {String(value)}
    </text>
  );
}

/** Day number (today filled in), with the month under the first day and each 1st. */
function DateTick({
  x,
  y,
  payload,
  index,
  today,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  index?: number;
  today: string;
}) {
  if (!payload) return null;
  const date = payload.value;
  const dayOfMonth = Number(date.slice(8));
  const showMonth = index === 0 || dayOfMonth === 1;
  const isToday = date === today;
  return (
    <g transform={`translate(${x},${y})`}>
      {isToday && <circle cy={8} r={10} className="fill-primary" />}
      <text
        dy={12}
        textAnchor="middle"
        className={
          isToday
            ? "fill-primary-foreground text-xs font-semibold"
            : "fill-muted-foreground text-xs"
        }
      >
        {dayOfMonth}
      </text>
      {showMonth && (
        <text
          dy={30}
          textAnchor="middle"
          className="fill-foreground text-xs font-semibold"
        >
          {month.format(new Date(`${date}T00:00:00Z`))}
        </text>
      )}
    </g>
  );
}

/** Load per day stacked by source, with the capacity line and idle stretches. Clicking a day selects it. */
export function LoadChart({
  pool,
  days,
  today,
  onSelect,
}: {
  pool: Pool;
  days: DayPool[];
  today: string;
  onSelect: (date: string) => void;
}) {
  const data: Row[] = days.map((day) => ({
    date: day.date,
    confirmed: tonnes(day.load.confirmed.mid),
    offer: tonnes(day.load.offer.mid),
    forecast: tonnes(day.load.forecast.mid),
    overflow: day.overloaded ? `+${formatTonnes(day.overflowKg)}` : "",
    day,
  }));
  const series = shownSources(days);
  const capacityT = tonnes(days[0]?.capacityKg ?? 0);

  return (
    <ChartContainer
      config={loadConfig(pool)}
      className="aspect-auto h-80 w-full"
    >
      <BarChart
        data={data}
        margin={{ top: 24, left: 0, right: 0, bottom: 8 }}
        barCategoryGap="30%"
        className="cursor-pointer"
        onClick={(state) => {
          const row = data[Number(state.activeTooltipIndex)];
          if (row) onSelect(row.date);
        }}
      >
        {idleStretches(days).map((s) => (
          <ReferenceArea
            key={s.from}
            x1={s.from}
            x2={s.to}
            fill="var(--muted)"
            fillOpacity={1}
            label={{
              value: "Idle",
              position: "insideTop",
              className: "fill-muted-foreground text-xs font-semibold",
            }}
          />
        ))}
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          interval={0}
          height={40}
          tick={(props) => <DateTick {...props} today={today} />}
        />
        <YAxis hide domain={[0, (max: number) => max * 1.25]} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={(props) => <LoadTooltip {...props} pool={pool} />}
        />
        {series.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="load"
            fill={`var(--color-${s})`}
            isAnimationActive={false}
          >
            {i === series.length - 1 && (
              <LabelList dataKey="overflow" content={OverflowLabel} />
            )}
          </Bar>
        ))}
        <ReferenceLine
          y={capacityT}
          stroke="var(--foreground)"
          strokeWidth={2}
          ifOverflow="extendDomain"
          label={{
            value: `Capacity ${capacityT} t`,
            position: "insideBottomRight",
            className: "fill-foreground text-xs font-semibold",
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}

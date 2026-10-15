"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** One bar: tonnes with the p10–p90 range, labels formatted on the server. */
export type ArrivalBar = {
  label: string;
  title: string;
  t: number;
  /** Distance below and above `t`, for the error bar. */
  range: [number, number];
  rangeLabel: string;
  peak: boolean;
};

const arrivalsConfig = {
  t: { label: "Expected", color: "var(--chart-2)" },
  peak: { label: "Peak", color: "var(--chart-4)" },
} satisfies ChartConfig;

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
}) {
  const bar = payload?.[0]?.payload as ArrivalBar | undefined;
  if (!active || !bar) return null;
  return (
    <div className="grid gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{bar.title}</div>
      <div className="tabular-nums">
        {bar.t.toFixed(1)} t{" "}
        <span className="text-muted-foreground">({bar.rangeLabel})</span>
      </div>
    </div>
  );
}

/** Expected arrivals per week or day, with p10–p90 error bars and the peak highlighted. */
export function ArrivalsCard({
  weekly,
  daily,
}: {
  weekly: ArrivalBar[];
  daily: ArrivalBar[];
}) {
  const [view, setView] = useState<"weekly" | "daily">("weekly");
  const data = view === "weekly" ? weekly : daily;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Expected arrivals per {view === "weekly" ? "week" : "day"} (t)
        </CardTitle>
        <CardDescription>Lines show the likely range.</CardDescription>
        <CardAction>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[view]}
            onValueChange={(next: string[]) => {
              if (next[0] === "weekly" || next[0] === "daily") setView(next[0]);
            }}
          >
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={arrivalsConfig}
          className="aspect-auto h-72 w-full"
        >
          <BarChart data={data} margin={{ top: 8, left: -8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={view === "daily" ? 24 : 4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(t: number) => `${t} t`}
            />
            <ChartTooltip cursor={false} content={BarTooltip} />
            <Bar dataKey="t" radius={4} isAnimationActive={false}>
              {data.map((bar) => (
                <Cell
                  key={bar.label}
                  fill={bar.peak ? "var(--color-peak)" : "var(--color-t)"}
                />
              ))}
              <ErrorBar
                isAnimationActive={false}
                dataKey="range"
                width={view === "weekly" ? 8 : 0}
                stroke="var(--foreground)"
                strokeOpacity={0.6}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

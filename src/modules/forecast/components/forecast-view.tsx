import { connection } from "next/server";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDays, todayManila } from "@/lib/dates";
import { formatTonnes } from "@/lib/format";
import {
  byMunicipality,
  lagWeights,
  peak,
  sumByDay,
  sumByWeek,
  total,
  type KgRange,
} from "../logic";
import { arrivalRows, latestForecastMetrics } from "../queries";
import {
  ArrivalsCard,
  LagWeightsChart,
  type ArrivalBar,
} from "./forecast-charts";

const CHART_WEEKS = 12;
const TABLE_WEEKS = 8;
const TABLE_ROWS = 10;

const dayMonth = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
/** `Oct 15` from a `YYYY-MM-DD` date. */
const short = (date: string) => dayMonth.format(new Date(`${date}T00:00:00Z`));

/** `Oct 15 – 21`, or `Oct 29 – Nov 4` across months. */
function span(from: string, to: string): string {
  const [a, b] = [short(from), short(to)];
  return a.slice(0, 3) === b.slice(0, 3)
    ? `${a} – ${b.slice(4)}`
    : `${a} – ${b}`;
}

const rangeT = (r: KgRange) =>
  `${formatTonnes(r.kgLow)} – ${formatTonnes(r.kgHigh)}`;

function bar(
  r: KgRange,
  label: string,
  title: string,
  top: boolean,
): ArrivalBar {
  return {
    label,
    title,
    t: r.kgMid / 1000,
    range: [(r.kgMid - r.kgLow) / 1000, (r.kgHigh - r.kgMid) / 1000],
    rangeLabel: rangeT(r),
    peak: top,
  };
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {detail}
      </CardContent>
    </Card>
  );
}

/** The forecast page body: headline, chart, municipalities and model details. */
export async function ForecastView() {
  await connection();
  const from = todayManila();
  const to = addDays(from, CHART_WEEKS * 7 - 1);
  const tableTo = addDays(from, TABLE_WEEKS * 7 - 1);
  const [metrics, rows] = await Promise.all([
    latestForecastMetrics(),
    arrivalRows(from, to),
  ]);

  if (!metrics || rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrendingUp />
          </EmptyMedia>
          <EmptyTitle>No forecast for the next {CHART_WEEKS} weeks</EmptyTitle>
          <EmptyDescription>
            Train it in <code>data/forecast</code>, then run{" "}
            <code>pnpm import:forecast</code>.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const days = sumByDay(rows, from, to);
  const weeks = sumByWeek(days);
  const all = total(weeks);
  const topWeek = peak(weeks);
  const topDay = peak(days);
  const municipalities = byMunicipality(rows.filter((r) => r.date <= tableTo));
  const shown = municipalities.slice(0, TABLE_ROWS);
  const rest = municipalities.slice(TABLE_ROWS);
  const restTotal = total(rest);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`Expected arrivals, next ${CHART_WEEKS} weeks`}
          value={formatTonnes(all.kgMid)}
          detail={`Range ${rangeT(all)}`}
        />
        <Stat
          label="Peak week"
          value={topWeek ? span(topWeek.from, topWeek.to) : "—"}
          detail={
            topWeek
              ? `About ${formatTonnes(topWeek.kgMid)} (${rangeT(topWeek)})`
              : "No arrivals expected"
          }
        />
        <Stat
          label="Held-out accuracy"
          value={`R² ${metrics.r2.province_held_out.toFixed(2)}`}
          detail={`Province total. Per municipality × half-month: ${metrics.r2.municipality_half_month_held_out.toFixed(2)}.`}
        />
        <Stat
          label="Training data"
          value="OPA 2025"
          detail={metrics.irpc_share.source}
        />
      </div>

      <ArrivalsCard
        weekly={weeks.map((w) =>
          bar(w, short(w.from), span(w.from, w.to), w === topWeek),
        )}
        daily={days.map((d) =>
          bar(d, short(d.date), short(d.date), d === topDay),
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By municipality · next {TABLE_WEEKS} weeks</CardTitle>
            <CardDescription>
              Expected to IRPC, already × IRPC&apos;s share.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Municipality</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Range</TableHead>
                  <TableHead>Peak half-month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((m) => (
                  <TableRow key={m.municipality}>
                    <TableCell className="font-medium">
                      {m.municipality}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTonnes(m.kgMid)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {rangeT(m)}
                    </TableCell>
                    <TableCell>
                      {m.peak ? span(m.peak.from, m.peak.to) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {rest.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>{rest.length} more municipalities</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTonnes(restTotal.kgMid)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {rangeT(restTotal)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model</CardTitle>
            <CardDescription>{metrics.evaluation}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                Planting to harvest (lag weights)
              </div>
              <LagWeightsChart
                lags={lagWeights(metrics).map((l) => ({
                  label: `~${l.days} d`,
                  weight: l.weight,
                }))}
              />
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Lead time</dt>
                <dd className="font-medium tabular-nums">
                  {metrics.lead_days} days
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Range (p10–p90)
                </dt>
                <dd className="font-medium tabular-nums">
                  {Math.round(metrics.band.p10 * 100)}% / +
                  {Math.round(metrics.band.p90 * 100)}%
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Trained {metrics.trained_on} on {metrics.data}. The range excludes{" "}
              {metrics.band.excludes}.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ForecastViewSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
      <Skeleton className="h-80" />
    </>
  );
}

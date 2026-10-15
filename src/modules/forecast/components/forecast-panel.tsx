import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { lagWeights, type ForecastSource } from "../logic";
import { forecastCoverage, latestForecastMetrics } from "../queries";

const SOURCE_LABEL: Record<ForecastSource, string> = {
  "opa-2025": "OPA 2025",
  "demo-synthetic": "Demo 2026",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

async function Panel() {
  const [metrics, coverage] = await Promise.all([
    latestForecastMetrics(),
    forecastCoverage(),
  ]);
  if (!metrics) {
    return (
      <p className="text-sm text-muted-foreground">
        No forecast loaded. Run <code>pnpm import:forecast</code>.
      </p>
    );
  }
  const lags = lagWeights(metrics);
  const maxWeight = Math.max(...lags.map((l) => l.weight));

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="grid grid-cols-2 gap-4">
        <Stat
          label="Province R² (held out)"
          value={metrics.r2.province_held_out.toFixed(2)}
        />
        <Stat
          label="Municipality R² (held out)"
          value={metrics.r2.municipality_half_month_held_out.toFixed(2)}
        />
        <Stat
          label="Range (p10–p90)"
          value={`${pct(metrics.band.p10)} / +${pct(metrics.band.p90)}`}
        />
        <Stat label="Lead time" value={`${metrics.lead_days} days`} />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">
          Planting to harvest (lag weights)
        </div>
        {lags.map((l) => (
          <div
            key={l.halfMonths}
            className="flex items-center gap-2 text-xs tabular-nums"
          >
            <span className="w-14 text-muted-foreground">~{l.days} d</span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(l.weight / maxWeight) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right">{l.weight.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 text-sm">
        <div className="text-xs text-muted-foreground">Loaded arrivals</div>
        {coverage.map((c) => (
          <div key={c.source} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{SOURCE_LABEL[c.source]}</span>
            {c.source === "demo-synthetic" ? (
              <Badge variant="outline">Synthetic, for demo</Badge>
            ) : (
              <Badge variant="secondary">Real data</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(c.from)} – {formatDate(c.to)}
            </span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Trained {formatDate(metrics.trained_on)} on real OPA 2025 data only.
          The range excludes {metrics.band.excludes}.
        </p>
      </div>
    </div>
  );
}

/** Held-out accuracy, lag weights and loaded sources of the arrival forecast. */
export function ForecastPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Arrival forecast</CardTitle>
        <CardDescription>
          Expected palay arrivals from OPA planting reports, scored
          leave-one-municipality-out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-32" />}>
          <Panel />
        </Suspense>
      </CardContent>
    </Card>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ForecastView,
  ForecastViewSkeleton,
} from "@/modules/forecast/components/forecast-view";

export const metadata: Metadata = { title: "Forecast" };

export default function ForecastPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Arrival forecast
        </h1>
        <p className="text-sm text-muted-foreground">
          Expected palay arrivals = municipal harvest × IRPC&apos;s share of
          each municipality.
        </p>
      </div>
      <Suspense fallback={<ForecastViewSkeleton />}>
        <ForecastView />
      </Suspense>
    </>
  );
}

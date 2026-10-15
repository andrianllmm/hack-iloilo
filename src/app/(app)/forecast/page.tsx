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
          Palay expected to arrive at IRPC in the coming weeks.
        </p>
      </div>
      <Suspense fallback={<ForecastViewSkeleton />}>
        <ForecastView />
      </Suspense>
    </>
  );
}

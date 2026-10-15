import type { Metadata } from "next";
import { ForecastPanel } from "@/modules/forecast/components/forecast-panel";

export const metadata: Metadata = { title: "Forecast" };

export default function ForecastPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
      <ForecastPanel />
    </>
  );
}

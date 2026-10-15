import { PagePlaceholder } from "@/components/page-placeholder";
import { ForecastPanel } from "@/modules/forecast/components/forecast-panel";

export default function CapacityPage() {
  return (
    <>
      <PagePlaceholder
        title="Capacity"
        module="M9"
        description="Dryer, storage and mill load against capacity, with suggested actions (M10)."
      />
      <ForecastPanel />
    </>
  );
}

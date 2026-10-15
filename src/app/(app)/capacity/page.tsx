import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CapacityLoader } from "@/modules/capacity/components/capacity-loader";

export const metadata: Metadata = { title: "Capacity" };

export default function CapacityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CapacityLoader />
    </Suspense>
  );
}

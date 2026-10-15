import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueueLoader } from "@/modules/gate/components/queue-loader";

export const metadata: Metadata = { title: "Gate queue" };

export default function QueuePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <QueueLoader />
    </Suspense>
  );
}

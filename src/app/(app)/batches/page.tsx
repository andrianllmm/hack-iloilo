import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchesList } from "@/modules/gate/components/batches-list";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage({ searchParams }: PageProps<"/batches">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BatchesList searchParams={searchParams} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseCard } from "@/modules/buying/components/purchase-card";
import { BatchDispatch } from "@/modules/gate/components/batch-dispatch";
import { BatchSummaryCard } from "@/modules/gate/components/batch-summary";

export const metadata: Metadata = { title: "Batch" };

async function Batch({ params }: Pick<PageProps<"/batches/[id]">, "params">) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <BatchSummaryCard id={id} />
      <PurchaseCard id={id} />
      <BatchDispatch id={id} />
    </div>
  );
}

export default function BatchPage({ params }: PageProps<"/batches/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Batch params={params} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/modules/accounts/components/role-gate";
import { PurchaseCard } from "@/modules/buying/components/purchase-card";
import { BatchDispatch } from "@/modules/gate/components/batch-dispatch";
import { BatchSummaryCard } from "@/modules/gate/components/batch-summary";
import { BatchCostCard } from "@/modules/pricing/components/batch-cost-card";

export const metadata: Metadata = { title: "Batch" };

async function Batch({ params }: Pick<PageProps<"/batches/[id]">, "params">) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <BatchSummaryCard id={id} />
      <PurchaseCard id={id} />
      <BatchDispatch id={id} />
      <RoleGate role="manager">
        <BatchCostCard id={id} />
      </RoleGate>
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

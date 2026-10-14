import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Batch" };

async function Batch({ params }: Pick<PageProps<"/batches/[id]">, "params">) {
  const { id } = await params;

  return (
    <PagePlaceholder
      title={`Batch ${id}`}
      module="M6"
      description="The batch trail from gate to buyers."
    />
  );
}

export default function BatchPage({ params }: PageProps<"/batches/[id]">) {
  return (
    <Suspense>
      <Batch params={params} />
    </Suspense>
  );
}

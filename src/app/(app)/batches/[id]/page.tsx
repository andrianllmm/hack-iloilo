import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchPage({
  params,
}: PageProps<"/batches/[id]">) {
  const { id } = await params;

  return (
    <PagePlaceholder
      title={`Batch ${id}`}
      module="M6"
      description="The batch trail from gate to buyers."
    />
  );
}

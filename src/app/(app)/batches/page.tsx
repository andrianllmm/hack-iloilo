import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage() {
  return (
    <PagePlaceholder
      title="Batches"
      module="M6"
      description="Batch records from receiving to dispatch."
    />
  );
}

import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <PagePlaceholder
      title="Clients"
      module="M2"
      description="Farmers, co-ops, traders and buyers."
    />
  );
}

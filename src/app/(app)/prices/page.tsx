import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";
import { requireRole } from "@/modules/accounts/auth";

export const metadata: Metadata = { title: "Prices" };

export default async function PricesPage() {
  await requireRole("manager");

  return (
    <PagePlaceholder
      title="Prices"
      module="M7"
      description="Buying base price, deduction rates, service fees and rice price."
    />
  );
}

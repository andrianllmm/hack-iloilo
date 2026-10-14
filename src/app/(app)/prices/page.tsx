import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";
import { RoleGate } from "@/modules/accounts/components/role-gate";

export const metadata: Metadata = { title: "Prices" };

export default function PricesPage() {
  return (
    <RoleGate role="manager">
      <PagePlaceholder
        title="Prices"
        module="M7"
        description="Buying base price, deduction rates, service fees and rice price."
      />
    </RoleGate>
  );
}

import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";
import { RoleGate } from "@/modules/accounts/components/role-gate";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <RoleGate role="manager">
      <PagePlaceholder
        title="Settings"
        module="M1"
        description="IRPC capacity, cost and planning settings, machines and varieties."
      />
    </RoleGate>
  );
}

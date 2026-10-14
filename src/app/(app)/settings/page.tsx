import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";
import { requireRole } from "@/modules/accounts/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("manager");

  return (
    <PagePlaceholder
      title="Settings"
      module="M1"
      description="IRPC capacity, cost and planning settings, machines and varieties."
    />
  );
}

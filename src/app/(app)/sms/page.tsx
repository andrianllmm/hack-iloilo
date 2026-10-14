import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "SMS simulator" };

export default function SmsPage() {
  return (
    <PagePlaceholder
      title="SMS simulator"
      module="M3"
      description="A phone screen per number for demoing SMS commands."
    />
  );
}

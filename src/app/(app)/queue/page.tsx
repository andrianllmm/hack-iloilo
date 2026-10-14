import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Queue" };

export default function QueuePage() {
  return (
    <PagePlaceholder
      title="Queue"
      module="M6"
      description="Gate check-in and the live queue per service."
    />
  );
}

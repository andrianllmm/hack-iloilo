import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Buying" };

export default function BuyingPage() {
  return (
    <PagePlaceholder
      title="Buying"
      module="M5"
      description="Sell offers to accept or decline, and purchase records."
    />
  );
}

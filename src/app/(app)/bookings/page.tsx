import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <PagePlaceholder
      title="Bookings"
      module="M4"
      description="Upcoming drying and milling bookings per service and day."
    />
  );
}

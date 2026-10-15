import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingsLoader } from "@/modules/booking/components/bookings-loader";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BookingsLoader searchParams={searchParams} />
    </Suspense>
  );
}

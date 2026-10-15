import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayManila } from "@/lib/dates";
import { WebBookingForm } from "@/modules/booking/components/web-booking-form";

export const metadata: Metadata = { title: "Book a slot" };

async function BookingFormLoader() {
  await connection();
  return <WebBookingForm today={todayManila()} />;
}

export default function BookPage() {
  return (
    <main className="flex flex-1 items-start justify-center p-4 sm:items-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Book drying or milling</CardTitle>
          <CardDescription>
            Iloilo Rice Processing Complex. Your booking is confirmed right
            away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96" />}>
            <BookingFormLoader />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SmsLoader } from "@/modules/sms/components/sms-loader";

export const metadata: Metadata = { title: "SMS" };

export default function SmsPage({ searchParams }: PageProps<"/sms">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SmsLoader searchParams={searchParams} />
    </Suspense>
  );
}

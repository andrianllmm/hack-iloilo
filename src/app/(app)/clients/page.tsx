import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientsLoader } from "@/modules/accounts/components/clients-loader";

export const metadata: Metadata = { title: "Clients & staff" };
export default function ClientsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ClientsLoader />
    </Suspense>
  );
}

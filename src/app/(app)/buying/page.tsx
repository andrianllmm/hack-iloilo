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
import { clientsDirectory } from "@/modules/accounts/queries";
import { OfferForm } from "@/modules/buying/components/offer-form";
import { OffersView } from "@/modules/buying/components/offers-view";
import { listVarieties } from "@/modules/setup/queries";

export const metadata: Metadata = { title: "Buying" };

async function NewOffer() {
  // Reference data read fresh per request; defer past the prerendered shell.
  await connection();
  const [clients, varieties] = await Promise.all([
    clientsDirectory(),
    listVarieties(),
  ]);
  return (
    <OfferForm
      clients={clients
        .map((c) => ({ id: c.id, name: c.name, phone: c.phone }))
        .sort((a, b) => a.name.localeCompare(b.name))}
      varieties={varieties.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
      }))}
    />
  );
}

export default function BuyingPage({ searchParams }: PageProps<"/buying">) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New sell offer</CardTitle>
          <CardDescription>
            Record a client&apos;s offer to sell palay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96" />}>
            <NewOffer />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buying list</CardTitle>
          <CardDescription>
            Offers by harvest date. Managers accept or decline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96" />}>
            <OffersView searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

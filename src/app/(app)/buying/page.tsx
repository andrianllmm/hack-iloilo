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
import { clientsDirectory } from "@/modules/accounts/queries";
import { BudgetCard } from "@/modules/buying/components/budget-card";
import { OfferForm } from "@/modules/buying/components/offer-form";
import { OffersView } from "@/modules/buying/components/offers-view";
import type { BuyRules } from "@/modules/pricing/logic";
import { QuoteCalculator } from "@/modules/pricing/components/quote-calculator";
import { priceOn } from "@/modules/pricing/queries";
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

async function Quote() {
  // Prices are read fresh per request; defer past the prerendered shell.
  await connection();
  let priceRule;
  try {
    const prices = await priceOn(todayManila());
    priceRule = {
      buy_base_minor_per_kg: prices.buy_base_minor_per_kg,
      buy_reference_mc: prices.buy_reference_mc,
      buy_rules: prices.buy_rules as BuyRules,
    };
  } catch {
    return (
      <p className="text-sm text-muted-foreground">
        No prices set yet. A manager sets them on the Prices page.
      </p>
    );
  }
  return <QuoteCalculator priceRule={priceRule} />;
}

export default function BuyingPage({ searchParams }: PageProps<"/buying">) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <BudgetCard />
        </Suspense>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Quote calculator</CardTitle>
            <CardDescription>
              Estimate a buying price from MC. Skips deductions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <Quote />
            </Suspense>
          </CardContent>
        </Card>

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
      </div>

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

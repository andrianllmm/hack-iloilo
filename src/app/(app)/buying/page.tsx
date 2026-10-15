import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToolDialog } from "@/components/tool-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { todayManila } from "@/lib/dates";
import { clientsDirectory } from "@/modules/accounts/queries";
import { BudgetButton } from "@/modules/buying/components/budget-button";
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
    <section className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Buying</h1>
          <p className="text-sm text-muted-foreground">
            Palay offers from clients, from offer to purchase
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Suspense fallback={<Skeleton className="h-8 w-44" />}>
            <BudgetButton />
          </Suspense>
          <ToolDialog
            trigger={
              <>
                <Calculator data-icon="inline-start" />
                Quote calculator
              </>
            }
            title="Quote calculator"
            description="Estimate a buying price from MC. Skips deductions."
          >
            <Suspense fallback={<Skeleton className="h-64" />}>
              <Quote />
            </Suspense>
          </ToolDialog>
        </div>
      </header>

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
    </section>
  );
}

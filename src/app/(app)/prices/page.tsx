import type { Metadata } from "next";
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
import { RoleGate } from "@/modules/accounts/components/role-gate";
import {
  PriceForm,
  type PriceFormDefaults,
} from "@/modules/pricing/components/price-form";
import { PricesView } from "@/modules/pricing/components/prices-view";
import type { BuyRules } from "@/modules/pricing/logic";
import { listPrices } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "Prices" };

const peso = (minor: number) => (minor / 100).toFixed(2);

async function SetPrices() {
  const today = todayManila();
  const prices = await listPrices();
  const live = prices.find((p) => p.effective_date <= today);
  const rules = live?.buy_rules as BuyRules | undefined;

  // Prefill from the live row; otherwise the TRD defaults (fees, deductions).
  const defaults: PriceFormDefaults = {
    effectiveDate: today,
    buyBase: live ? peso(live.buy_base_minor_per_kg) : "",
    damaged: String(rules?.damaged ?? 0.25),
    immature: String(rules?.immature ?? 0.1),
    foreign: String(rules?.foreign ?? 1),
    rice: live ? peso(live.rice_minor_per_kg) : "",
    drying: live ? peso(live.drying_fee_minor_per_kg) : "1.60",
    milling: live ? peso(live.milling_fee_minor_per_kg) : "3.30",
  };

  return <PriceForm defaults={defaults} />;
}

export default function PricesPage() {
  return (
    <RoleGate role="manager">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Prices</CardTitle>
            <CardDescription>
              Manager only · a PRICE text replies with today&apos;s prices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <SetPrices />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Price rows by effective date. The one in effect today is tagged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <PricesView />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}

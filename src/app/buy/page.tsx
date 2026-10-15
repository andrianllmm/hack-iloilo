import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayManila } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatKg, formatMoney } from "@/lib/format";
import { riceStock } from "@/modules/gate/queries";
import { priceOn } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "Buy rice" };

/** Today's rice price and IRPC rice on hand; read fresh per request. */
async function RiceToday() {
  await connection();
  const [prices, stockKg] = await Promise.all([
    priceOn(todayManila()).catch(() => null),
    riceStock(),
  ]);
  const number = env().SMS_GATEWAY_PHONE_NUMBER;

  return (
    <div className="flex flex-col gap-4">
      <dl className="divide-y">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted-foreground">Rice price</dt>
          <dd className="font-semibold tabular-nums">
            {prices
              ? `${formatMoney(prices.rice_minor_per_kg)}/kg`
              : "Not set yet"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted-foreground">Rice on hand</dt>
          <dd className="font-semibold tabular-nums">
            {stockKg > 0 ? formatKg(stockKg) : "None available today"}
          </dd>
        </div>
      </dl>
      <p>
        Buy at the plant. You&apos;ll get your receipt and batch no. by text.
      </p>
      <p className="text-sm text-muted-foreground">
        No data? Text PRICE to{" "}
        {number ? (
          <a
            href={`sms:${number}`}
            className="font-semibold text-primary underline"
          >
            {number}
          </a>
        ) : (
          "the IRPC number"
        )}
        .
      </p>
    </div>
  );
}

export default function BuyPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-start gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <Wordmark className="h-8 w-auto text-primary" />
        <p className="text-sm text-muted-foreground">
          Iloilo Rice Processing Complex
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Buy rice</CardTitle>
          <CardDescription>
            Today&apos;s price and rice on hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40" />}>
            <RiceToday />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

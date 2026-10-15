import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { todayManila } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatDate, formatKg, formatMoney } from "@/lib/format";
import { normalizeBatchNo } from "@/modules/gate/logic";
import { publicBatchTrail, riceStock } from "@/modules/gate/queries";
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

/** Batch lookup: a plain GET form, so the result URL can be shared. */
async function Trace({
  searchParams,
}: {
  searchParams: PageProps<"/buy">["searchParams"];
}) {
  await connection();
  const { batch } = await searchParams;
  const input = typeof batch === "string" ? batch : "";
  const batchNo = normalizeBatchNo(input);
  const trail = batchNo ? await publicBatchTrail(batchNo) : null;

  return (
    <div className="flex flex-col gap-4">
      <form action="/buy" className="flex gap-2">
        <Input
          name="batch"
          defaultValue={input}
          placeholder="261015-007"
          aria-label="Batch no."
          inputMode="numeric"
          required
        />
        <Button type="submit">Trace</Button>
      </form>
      {batchNo &&
        (trail ? (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">
              Batch {trail.batchNo}
              {trail.variety ? ` · ${trail.variety}` : ""}
            </p>
            <p className="text-muted-foreground">
              {trail.municipality
                ? `From ${trail.municipality} farmers`
                : "Municipality not recorded"}
            </p>
            <dl className="divide-y">
              {trail.steps.map((step) => (
                <div
                  key={step.label}
                  className="flex justify-between gap-4 py-2"
                >
                  <dt className="text-muted-foreground">{step.label}</dt>
                  <dd className="tabular-nums">{formatDate(step.date)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No batch found.</p>
        ))}
    </div>
  );
}

export default function BuyPage({ searchParams }: PageProps<"/buy">) {
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Where your rice came from</CardTitle>
          <CardDescription>
            Enter the batch no. from your receipt text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24" />}>
            <Trace searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

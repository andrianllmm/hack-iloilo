"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toPickerDate } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Municipality } from "@/modules/accounts/types";
import { queueLines, services } from "../logic";
import type { QueueRow } from "../types";
import { CheckInCard, type CheckInRequest } from "./check-in-card";
import { QueueLine } from "./queue-line";

const REFRESH_MS = 30_000;
const TICK_MS = 60_000;
const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Gate workspace: check-in form and one live column per service line. */
export function GateQueue({
  rows,
  municipalities,
  today,
  renderedAt,
}: {
  rows: QueueRow[];
  municipalities: Municipality[];
  today: string;
  renderedAt: string;
}) {
  const router = useRouter();
  // Starts at the server's clock so wait times hydrate identically.
  const [now, setNow] = useState(() => new Date(renderedAt));
  const [request, setRequest] = useState<CheckInRequest | null>(null);
  const lines = queueLines(rows);
  const todayLabel = dayLabel.format(new Date(`${today}T00:00:00Z`));

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), TICK_MS);
    const refresh = setInterval(() => router.refresh(), REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const ask = (next: Omit<CheckInRequest, "seq">) =>
    setRequest((previous) => ({ ...next, seq: (previous?.seq ?? 0) + 1 }));

  return (
    <section className="flex min-w-0 flex-col gap-6 font-sans [--font-sans:var(--font-geist-sans)]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Gate queue</h1>
          <p className="text-sm text-muted-foreground">
            {todayLabel} · one line per service · first come, first served
          </p>
        </div>
        <Button variant="outline" onClick={() => ask({ mode: "walkIn" })}>
          Walk-in check-in
        </Button>
      </header>
      <div className="grid min-w-0 items-stretch gap-6 lg:grid-cols-[minmax(20rem,1fr)_1fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <CheckInCard municipalities={municipalities} request={request} />
          <Card>
            <CardHeader>
              <CardTitle>Date context</CardTitle>
              <CardDescription>Today · {todayLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={toPickerDate(today)}
                defaultMonth={toPickerDate(today)}
                className="mx-auto"
              />
            </CardContent>
          </Card>
        </div>
        {services.map((service) => (
          <QueueLine
            key={service}
            service={service}
            line={lines[service]}
            now={now}
            onCheckIn={(line) => ask({ mode: "phone", service: line })}
          />
        ))}
      </div>
    </section>
  );
}

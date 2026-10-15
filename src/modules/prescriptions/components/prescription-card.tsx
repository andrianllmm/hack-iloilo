"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, formatTonnes } from "@/lib/format";
import { decidePrescription } from "../actions";
import { dayList, shortDay, templateNote } from "../logic";
import type {
  Decision,
  FillIdlePrescription,
  MillFullLoadsPrescription,
  MoveBookingsPrescription,
  Prescription,
} from "../types";

const kindLabels: Record<Prescription["kind"], string> = {
  move_bookings: "Move bookings",
  fill_idle: "Fill idle days",
  mill_full_loads: "Mill in full loads",
};

/** Recipients listed by name before "and N more". */
const SHOWN_RECIPIENTS = 5;

/** One suggestion with its numbers and accept / dismiss. Managers only. */
export function PrescriptionCard({
  prescription: p,
}: {
  prescription: Prescription;
}) {
  const [pending, start] = useTransition();
  const { accept, accepted } = acceptCopy(p);
  const decide = (decision: Decision) =>
    start(async () => {
      const result = await decidePrescription(p.key, decision);
      if (result.status === "error") toast.error(result.message);
      else toast.success(decision === "accepted" ? accepted : "Dismissed.");
    });

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{kindLabels[p.kind]}</CardDescription>
        <CardTitle>{p.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-pretty">{templateNote(p)}</p>
        {p.kind === "move_bookings" && <Moves p={p} />}
        {p.kind === "fill_idle" && <Recipients p={p} />}
        {p.kind === "mill_full_loads" && <MillPlans p={p} />}
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("accepted")}>
          {accept}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide("dismissed")}
        >
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}

function Moves({ p }: { p: MoveBookingsPrescription }) {
  return (
    <>
      {p.incomingKg > 0 && (
        <p className="text-muted-foreground">
          Includes {formatTonnes(p.incomingKg)} already asked to move here.
        </p>
      )}
      <ul className="divide-y rounded-lg border text-sm">
        {p.moves.map((m) => (
          <li
            key={m.bookingId}
            className="flex items-center justify-between gap-3 p-2.5"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{m.client}</span>
              <span className="text-xs text-muted-foreground">
                {m.ref} · {shortDay(m.from)} → {shortDay(m.to)}
              </span>
            </div>
            <span className="shrink-0 tabular-nums">{formatTonnes(m.kg)}</span>
          </li>
        ))}
      </ul>
      {p.remainderKg > 0 ? (
        <Badge variant="warning">
          {formatTonnes(p.remainderKg)} still over after the moves
        </Badge>
      ) : (
        <Badge variant="success">Clears the overflow</Badge>
      )}
    </>
  );
}

function Recipients({ p }: { p: FillIdlePrescription }) {
  const more = p.recipients.length - SHOWN_RECIPIENTS;
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {p.recipients.length} recipients · {p.facts.municipalities}
        </span>
        <p>
          {p.recipients
            .slice(0, SHOWN_RECIPIENTS)
            .map((r) => r.name)
            .join(", ")}
          {more > 0 && ` and ${more} more`}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Text · {p.message.length}/320
        </span>
        <p className="rounded-lg border bg-muted/50 p-2.5 font-mono text-xs break-words">
          {p.message}
        </p>
      </div>
    </>
  );
}

/** The accept button label and the toast once accepted. */
function acceptCopy(p: Prescription): { accept: string; accepted: string } {
  switch (p.kind) {
    case "move_bookings":
      return { accept: "Ask to move", accepted: "Clients asked to move." };
    case "fill_idle": {
      const n = p.recipients.length;
      return {
        accept: `Send ${n} ${n === 1 ? "text" : "texts"}`,
        accepted: `${n} ${n === 1 ? "text" : "texts"} sent.`,
      };
    }
    case "mill_full_loads":
      return {
        accept: "Plan full loads",
        accepted: "Full-load plan accepted.",
      };
  }
}

function MillPlans({ p }: { p: MillFullLoadsPrescription }) {
  const plans = [
    {
      label: "Full loads",
      dates: p.fullDates,
      minorPerKg: p.fullMinorPerKg,
    },
    {
      label: "Partial days (now)",
      dates: p.spreadDates,
      minorPerKg: p.spreadMinorPerKg,
    },
  ];
  return (
    <>
      <ul className="divide-y rounded-lg border text-sm">
        {plans.map((plan) => (
          <li
            key={plan.label}
            className="flex items-center justify-between gap-3 p-2.5"
          >
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{plan.label}</span>
              <span className="text-xs text-muted-foreground">
                {plan.dates.length} {plan.dates.length === 1 ? "day" : "days"} ·{" "}
                {dayList(plan.dates)}
              </span>
            </div>
            <span className="shrink-0 tabular-nums">
              {formatMoney(plan.minorPerKg)}/kg
            </span>
          </li>
        ))}
      </ul>
      <Badge variant="success">
        Saves {formatMoney(p.spreadMinorPerKg - p.fullMinorPerKg)}/kg on{" "}
        {formatTonnes(p.kg)}
      </Badge>
    </>
  );
}

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
import { formatTonnes } from "@/lib/format";
import { decidePrescription } from "../actions";
import { shortDay, templateNote } from "../logic";
import type {
  Decision,
  FillIdlePrescription,
  MoveBookingsPrescription,
  Prescription,
} from "../types";

const kindLabels: Record<Prescription["kind"], string> = {
  move_bookings: "Move bookings",
  fill_idle: "Fill idle days",
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
  const texts = p.kind === "fill_idle" ? p.recipients.length : 0;
  const decide = (decision: Decision) =>
    start(async () => {
      const result = await decidePrescription(p.key, decision);
      if (result.status === "error") toast.error(result.message);
      else if (decision === "dismissed") toast.success("Dismissed.");
      else
        toast.success(
          p.kind === "move_bookings"
            ? "Clients asked to move."
            : `${texts} texts sent.`,
        );
    });

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{kindLabels[p.kind]}</CardDescription>
        <CardTitle>{p.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-pretty">{templateNote(p)}</p>
        {p.kind === "move_bookings" ? <Moves p={p} /> : <Recipients p={p} />}
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("accepted")}>
          {p.kind === "move_bookings"
            ? "Ask to move"
            : `Send ${texts} ${texts === 1 ? "text" : "texts"}`}
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

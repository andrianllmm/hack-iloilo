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
import { shortDay } from "../logic";
import type { Decision, Prescription } from "../types";

const kindLabels: Record<Prescription["kind"], string> = {
  move_bookings: "Move bookings",
};

/** One suggestion with its numbers and accept / dismiss. Managers only. */
export function PrescriptionCard({
  prescription: p,
}: {
  prescription: Prescription;
}) {
  const [pending, start] = useTransition();
  const decide = (decision: Decision) =>
    start(async () => {
      const result = await decidePrescription(p.key, decision);
      if (result.status === "error") toast.error(result.message);
      else
        toast.success(
          decision === "accepted" ? "Suggestion accepted." : "Dismissed.",
        );
    });

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{kindLabels[p.kind]}</CardDescription>
        <CardTitle>{p.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
              <span className="shrink-0 tabular-nums">
                {formatTonnes(m.kg)}
              </span>
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
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("accepted")}>
          Ask to move
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

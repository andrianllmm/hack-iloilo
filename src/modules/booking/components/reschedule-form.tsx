"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { moveBookingByStaff } from "../actions";
import { MAX_FLEX_DAYS } from "../logic";
import type { BookingRow } from "../types";

export function RescheduleForm({
  booking,
  today,
  onSaved,
  onCancel,
}: {
  booking: BookingRow;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [date, setDate] = useState(booking.scheduled_date);
  const [flexDays, setFlexDays] = useState(String(booking.flex_days));
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setMessage(undefined);
          try {
            const result = await moveBookingByStaff({
              ref: booking.ref,
              date,
              flexDays: Number(flexDays),
            });
            if (result.status === "error") {
              setMessage(result.message);
              return;
            }
            toast.success(`Booking ${booking.ref} rescheduled.`);
            onSaved();
          } catch {
            setMessage("Unable to move the booking. Please try again.");
          }
        });
      }}
    >
      <FieldGroup className="p-4">
        <Field>
          <FieldLabel htmlFor={`${id}-date`}>New date</FieldLabel>
          <DatePicker
            id={`${id}-date`}
            value={date}
            min={today}
            disabled={pending}
            onChange={(value) => setDate(value ?? "")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-flex`}>Flex days</FieldLabel>
          <Input
            id={`${id}-flex`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_FLEX_DAYS}
            step={1}
            required
            value={flexDays}
            onChange={(event) => setFlexDays(event.target.value)}
            disabled={pending}
          />
          <FieldDescription>
            Days either side the client can shift (0–{MAX_FLEX_DAYS}).
          </FieldDescription>
        </Field>
        {message ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending || !date}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Rescheduling…" : "Confirm reschedule"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Keep booking
        </Button>
      </SheetFooter>
    </form>
  );
}

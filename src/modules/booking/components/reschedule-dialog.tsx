"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatKg } from "@/lib/format";
import { rescheduleBookingByStaff } from "../actions";
import { rescheduleSchema, type RescheduleInput } from "../booking-schema";
import { formatDay, MAX_FLEX_DAYS, serviceLabels } from "../logic";
import type { BookingRow } from "../types";

/** Staff reschedule of an open booking; texts the client and booker. */
export function RescheduleDialog({
  booking,
  today,
  onClose,
}: {
  booking: BookingRow | null;
  today: string;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        {booking ? (
          <RescheduleForm
            key={booking.ref}
            booking={booking}
            today={today}
            onPendingChange={setPending}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RescheduleForm({
  booking,
  today,
  onPendingChange,
  onDone,
}: {
  booking: BookingRow;
  today: string;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
}) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm<RescheduleInput>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      ref: booking.ref,
      date: booking.scheduled_date < today ? today : booking.scheduled_date,
      flexDays: booking.flex_days,
    },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit((input) =>
    startTransition(async () => {
      onPendingChange(true);
      setMessage(undefined);
      try {
        const result = await rescheduleBookingByStaff(input);
        if (result.status === "error") {
          setMessage(result.message);
          for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
            form.setError(
              field as keyof RescheduleInput,
              { message: error },
              { shouldFocus: true },
            );
          return;
        }
        toast.success(
          `Booking ${booking.ref} moved to ${formatDay(result.booking.scheduled_date)}.`,
          { description: "The client has been texted." },
        );
        onDone();
      } catch {
        setMessage("Unable to move the booking. Please try again.");
      } finally {
        onPendingChange(false);
      }
    }),
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Reschedule booking {booking.ref}</DialogTitle>
        <DialogDescription>
          {`${booking.client.name} · ${serviceLabels[booking.service].toLowerCase()} · ${formatKg(booking.est_kg)} on ${formatDay(booking.scheduled_date)}.`}
          {booking.status === "reschedule_proposed"
            ? " This replaces the pending proposal."
            : null}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Controller
          control={form.control}
          name="date"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor={`${formId}-date`}>New date</FieldLabel>
              <DatePicker
                id={`${formId}-date`}
                value={field.value}
                min={today}
                disabled={pending}
                aria-invalid={!!fieldState.error}
                onChange={(value) => field.onChange(value ?? "")}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Field data-invalid={!!errors.flexDays}>
          <FieldLabel htmlFor={`${formId}-flex`}>Flex days</FieldLabel>
          <Input
            id={`${formId}-flex`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_FLEX_DAYS}
            step={1}
            {...form.register("flexDays", { valueAsNumber: true })}
            aria-invalid={!!errors.flexDays}
            disabled={pending}
          />
          <FieldDescription>
            How many days either side the client can shift (0–{MAX_FLEX_DAYS}).
          </FieldDescription>
          <FieldError errors={[errors.flexDays]} />
        </Field>
        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to complete request</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onDone}
        >
          Keep date
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Moving…" : "Move booking"}
        </Button>
      </DialogFooter>
    </form>
  );
}

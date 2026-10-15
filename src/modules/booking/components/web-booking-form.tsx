"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatKg } from "@/lib/format";
import { bookOnline, type BookOnlineResult } from "../actions";
import { webBookingSchema, type WebBookingInput } from "../booking-schema";
import { MAX_FLEX_DAYS, serviceLabels, services } from "../logic";

type Booked = Extract<BookOnlineResult, { status: "created" }>["booking"];

const serviceItems = services.map((value) => ({
  value,
  label: serviceLabels[value],
}));

/** Public booking from a phone browser; `channel = sms`, booked by the entered phone. */
export function WebBookingForm({ today }: { today: string }) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [booked, setBooked] = useState<Booked>();
  const form = useForm<WebBookingInput>({
    resolver: zodResolver(webBookingSchema),
    defaultValues: {
      phone: "",
      service: "drying",
      preferredDate: today,
      flexDays: 0,
    },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit((input) =>
    startTransition(async () => {
      setMessage(undefined);
      try {
        const result = await bookOnline(input);
        if (result.status === "error") {
          setMessage(result.message);
          for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
            form.setError(
              field as keyof WebBookingInput,
              { message: error },
              { shouldFocus: true },
            );
          return;
        }
        setBooked(result.booking);
      } catch {
        setMessage("Unable to save the booking. Please try again.");
      }
    }),
  );

  if (booked)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-center">
          <p className="text-sm text-muted-foreground">Booking confirmed</p>
          <p className="font-mono text-4xl font-bold tracking-widest">
            {booked.ref}
          </p>
          <p>
            {serviceLabels[booked.service]} · {formatKg(booked.est_kg)} ·{" "}
            {formatDate(booked.scheduled_date)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          We texted this ref to your phone. Show it at the gate. To cancel, text{" "}
          <span className="font-mono">CANCEL {booked.ref}</span>.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            form.reset({ ...form.getValues(), estKg: undefined });
            setBooked(undefined);
          }}
        >
          Book another
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor={`${formId}-phone`}>Mobile number</FieldLabel>
          <Input
            id={`${formId}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            {...form.register("phone")}
            aria-invalid={!!errors.phone}
            disabled={pending}
          />
          <FieldDescription>We text your booking ref here.</FieldDescription>
          <FieldError errors={[errors.phone]} />
        </Field>
        <Controller
          control={form.control}
          name="service"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor={`${formId}-service`}>Service</FieldLabel>
              <Select
                items={serviceItems}
                value={field.value}
                disabled={pending}
                onValueChange={(value) => {
                  if (value) field.onChange(value);
                }}
              >
                <SelectTrigger
                  id={`${formId}-service`}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  aria-invalid={!!fieldState.error}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {serviceItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Field data-invalid={!!errors.estKg}>
          <FieldLabel htmlFor={`${formId}-kg`}>Estimated kg</FieldLabel>
          <Input
            id={`${formId}-kg`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="5000"
            {...form.register("estKg", { valueAsNumber: true })}
            aria-invalid={!!errors.estKg}
            disabled={pending}
          />
          <FieldError errors={[errors.estKg]} />
        </Field>
        <Controller
          control={form.control}
          name="preferredDate"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor={`${formId}-date`}>Preferred date</FieldLabel>
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
            How many days earlier or later you can come (0–{MAX_FLEX_DAYS}).
          </FieldDescription>
          <FieldError errors={[errors.flexDays]} />
        </Field>
        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to complete request</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Booking…" : "Book"}
        </Button>
      </FieldGroup>
    </form>
  );
}

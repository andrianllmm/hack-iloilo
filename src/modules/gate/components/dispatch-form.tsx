"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatKg } from "@/lib/format";
import { dispatchBatch } from "../actions";
import type { DispatchMode } from "../logic";

type Buyer = { id: string; name: string };

/**
 * Records a dispatch from a batch. For a sale the staff pick a buyer and price;
 * for a pickup the owner and a zero price are fixed, so only the kg and an
 * optional reference are entered.
 */
export function DispatchForm({
  batchId,
  mode,
  remaining,
  buyers,
  owner,
}: {
  batchId: string;
  mode: DispatchMode;
  remaining: number;
  buyers: Buyer[];
  owner: Buyer;
}) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  // Price is entered in pesos and converted to centavos on submit.
  const schema = z.object({
    buyerId: z.guid("Choose a buyer."),
    kg: z
      .number("Enter the weight in kg.")
      .int("Enter whole kilograms.")
      .positive("Enter more than 0 kg.")
      .max(remaining, `Only ${remaining} kg left to dispatch.`),
    pricePerKg: z
      .number("Enter the price per kg.")
      .nonnegative("Price can't be negative."),
    orRef: z.string().trim(),
  });
  type FormValues = z.infer<typeof schema>;

  const defaults: FormValues = {
    buyerId: mode === "pickup" ? owner.id : "",
    kg: remaining,
    pricePerKg: 0,
    orRef: "",
  };
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(undefined);
      try {
        const result = await dispatchBatch(batchId, {
          buyerId: values.buyerId,
          kg: values.kg,
          priceMinorPerKg: Math.round(values.pricePerKg * 100),
          orRef: values.orRef || null,
        });
        if (result.status === "error") {
          setMessage(result.message);
          for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
            form.setError(
              // The server names the price field by its stored (minor) key.
              (field === "priceMinorPerKg"
                ? "pricePerKg"
                : field) as keyof FormValues,
              { message: error },
              { shouldFocus: true },
            );
          return;
        }
        toast.success(mode === "sale" ? "Sale recorded." : "Pickup recorded.");
        form.reset(defaults);
      } catch {
        setMessage("Unable to record the dispatch. Please try again.");
      }
    }),
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        {mode === "sale" ? (
          <Controller
            control={form.control}
            name="buyerId"
            render={({ field, fieldState }) => {
              const selected = buyers.find((b) => b.id === field.value) ?? null;
              return (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor={`${formId}-buyer`}>Buyer</FieldLabel>
                  <Combobox
                    items={buyers}
                    value={selected}
                    onValueChange={(item) => field.onChange(item?.id ?? "")}
                    itemToStringLabel={(item) => item.name}
                    isItemEqualToValue={(item, value) => item.id === value.id}
                    disabled={pending}
                  >
                    <ComboboxInput
                      id={`${formId}-buyer`}
                      disabled={pending}
                      aria-invalid={!!fieldState.error}
                      placeholder="Search buyer…"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No matches.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: Buyer) => (
                          <ComboboxItem key={item.id} value={item}>
                            {item.name}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              );
            }}
          />
        ) : (
          <Field>
            <FieldLabel>Owner</FieldLabel>
            <p className="text-sm font-medium">{owner.name}</p>
          </Field>
        )}

        <Field data-invalid={!!errors.kg}>
          <FieldLabel htmlFor={`${formId}-kg`}>
            Weight (kg) · {formatKg(remaining)} left
          </FieldLabel>
          <Input
            id={`${formId}-kg`}
            type="number"
            inputMode="numeric"
            min={1}
            max={remaining}
            step={1}
            {...form.register("kg", {
              setValueAs: (value: string | number | null) =>
                value === "" || value === null ? NaN : Number(value),
            })}
            aria-invalid={!!errors.kg}
            disabled={pending}
          />
          <FieldError errors={[errors.kg]} />
        </Field>

        {mode === "sale" ? (
          <Field data-invalid={!!errors.pricePerKg}>
            <FieldLabel htmlFor={`${formId}-price`}>Price (₱/kg)</FieldLabel>
            <Input
              id={`${formId}-price`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              {...form.register("pricePerKg", {
                setValueAs: (value: string | number | null) =>
                  value === "" || value === null ? NaN : Number(value),
              })}
              aria-invalid={!!errors.pricePerKg}
              disabled={pending}
            />
            <FieldError errors={[errors.pricePerKg]} />
          </Field>
        ) : null}

        <Field data-invalid={!!errors.orRef}>
          <FieldLabel htmlFor={`${formId}-or`}>
            {mode === "sale" ? "OR / receipt no." : "Reference"} (optional)
          </FieldLabel>
          <Input
            id={`${formId}-or`}
            placeholder="Optional"
            {...form.register("orRef")}
            aria-invalid={!!errors.orRef}
            disabled={pending}
          />
          <FieldError errors={[errors.orRef]} />
        </Field>

        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to complete request</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending
          ? "Recording…"
          : mode === "sale"
            ? "Record sale"
            : "Record pickup"}
      </Button>
    </form>
  );
}

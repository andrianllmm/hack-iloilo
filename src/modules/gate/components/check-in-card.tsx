"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ClientKindSelect } from "@/modules/accounts/components/client-kind-select";
import type { Municipality } from "@/modules/accounts/types";
import { checkInClient } from "../actions";
import { checkInSchema, type CheckInInput } from "../checkin-schema";
import { ownershipLabels, ownerships, serviceLabels, services } from "../logic";
import type { Service } from "../types";

/** Asks the card to switch tab, preselect a line and focus the first field. */
export type CheckInRequest = {
  mode: CheckInInput["mode"];
  service?: Service;
  seq: number;
};

const blank: CheckInInput = {
  mode: "phone",
  phone: "",
  service: "drying",
  ownership: "custom",
  estKg: null,
  name: "",
  kind: "farmer",
  municipality_id: null,
};

export function CheckInCard({
  municipalities,
  request,
}: {
  municipalities: Municipality[];
  request: CheckInRequest | null;
}) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchema),
    defaultValues: blank,
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const service = useWatch({ control: form.control, name: "service" });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!request) return;
    form.setValue("mode", request.mode);
    if (request.service) form.setValue("service", request.service);
    form.setFocus(request.mode === "walkIn" ? "name" : "phone");
  }, [request, form]);

  const submit = form.handleSubmit((input) =>
    startTransition(async () => {
      setMessage(undefined);
      try {
        const result = await checkInClient(input);
        if (result.status === "error") {
          setMessage(result.message);
          for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
            form.setError(
              field as keyof CheckInInput,
              { message: error },
              { shouldFocus: true },
            );
          return;
        }
        toast.success(`Checked in to the ${input.service} line.`);
        form.reset({ ...blank, mode: input.mode, service: input.service });
      } catch {
        setMessage("Unable to check in the client. Please try again.");
      }
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check in</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              form.setValue("mode", value);
              form.clearErrors();
            }}
          >
            <TabsList aria-label="Check in by">
              <TabsTrigger value="booking" disabled>
                Booking
              </TabsTrigger>
              <TabsTrigger value="offer" disabled>
                Offer
              </TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
              <TabsTrigger value="walkIn">Walk-in</TabsTrigger>
            </TabsList>
          </Tabs>
          <FieldGroup>
            {mode === "walkIn" ? (
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                <Input
                  id={`${formId}-name`}
                  placeholder="Full name"
                  autoComplete="name"
                  {...form.register("name")}
                  aria-invalid={!!errors.name}
                  disabled={pending}
                />
                <FieldError errors={[errors.name]} />
              </Field>
            ) : null}
            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor={`${formId}-phone`}>Phone</FieldLabel>
              <Input
                id={`${formId}-phone`}
                type="tel"
                autoComplete="tel"
                placeholder="0917 123 4567"
                {...form.register("phone")}
                aria-invalid={!!errors.phone}
                disabled={pending}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
            {mode === "walkIn" ? (
              <>
                <Controller
                  control={form.control}
                  name="municipality_id"
                  render={({ field, fieldState }) => {
                    const selected =
                      municipalities.find((m) => m.id === field.value) ?? null;
                    return (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor={`${formId}-municipality`}>
                          Municipality
                        </FieldLabel>
                        <Combobox
                          items={municipalities}
                          value={selected}
                          onValueChange={(item) =>
                            field.onChange(item?.id ?? null)
                          }
                          itemToStringLabel={(item) => item.name}
                          isItemEqualToValue={(item, value) =>
                            item.id === value.id
                          }
                          disabled={pending}
                        >
                          <ComboboxInput
                            id={`${formId}-municipality`}
                            disabled={pending}
                            aria-invalid={!!fieldState.error}
                            placeholder="Search municipality…"
                          />
                          <ComboboxContent>
                            <ComboboxEmpty>No matches.</ComboboxEmpty>
                            <ComboboxList>
                              {(item: Municipality) => (
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
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor={`${formId}-kind`}>Kind</FieldLabel>
                      <ClientKindSelect
                        id={`${formId}-kind`}
                        value={field.value}
                        disabled={pending}
                        invalid={!!fieldState.error}
                        onBlur={field.onBlur}
                        triggerRef={field.ref}
                        onChange={(value) => {
                          if (value !== "all") field.onChange(value);
                        }}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </>
            ) : null}
            <Controller
              control={form.control}
              name="service"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel>Service line</FieldLabel>
                  <ToggleGroup
                    variant="outline"
                    spacing={0}
                    aria-label="Service line"
                    value={[field.value]}
                    disabled={pending}
                    onValueChange={([value]) => {
                      if (value) field.onChange(value);
                    }}
                  >
                    {services.map((value) => (
                      <ToggleGroupItem key={value} value={value}>
                        {serviceLabels[value]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="ownership"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel>Ownership</FieldLabel>
                  <ToggleGroup
                    variant="outline"
                    spacing={0}
                    aria-label="Ownership"
                    value={[field.value]}
                    disabled={pending}
                    onValueChange={([value]) => {
                      if (value) field.onChange(value);
                    }}
                  >
                    {ownerships.map((value) => (
                      <ToggleGroupItem key={value} value={value}>
                        {ownershipLabels[value]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Field data-invalid={!!errors.estKg}>
              <FieldLabel htmlFor={`${formId}-kg`}>Est. weight (kg)</FieldLabel>
              <Input
                id={`${formId}-kg`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="Optional"
                {...form.register("estKg", {
                  // A reset hands back null, which Number() would turn into 0.
                  setValueAs: (value: string | number | null) =>
                    value === "" || value === null ? null : Number(value),
                })}
                aria-invalid={!!errors.estKg}
                disabled={pending}
              />
              <FieldError errors={[errors.estKg]} />
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
              ? "Checking in…"
              : `Check in to ${serviceLabels[service]} line`}
          </Button>
          <Alert>
            <AlertDescription>
              Unknown phone? Register the walk-in in seconds (name, phone,
              municipality, kind).
            </AlertDescription>
          </Alert>
        </form>
      </CardContent>
    </Card>
  );
}

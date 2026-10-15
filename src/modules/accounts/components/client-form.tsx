"use client";
import { useId, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { SheetFooter } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { saveClient } from "../actions";
import { clientSchema, type ClientInput } from "../client-schema";
import { clientKinds, kindLabels } from "../logic";
import type { Client, Municipality } from "../types";

type Props = {
  client?: Client;
  coops: Client[];
  municipalities: Municipality[];
  onSaved: () => void;
  onEditExisting: (client: Client) => void;
  onCancel: () => void;
  presentation?: "sheet" | "inline";
};
type Option = { id: string; name: string };
function Lookup({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  error?: string;
}) {
  const items = [{ id: "", name: "None" }, ...options];
  return (
    <Field data-invalid={!!error} data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        items={items}
        value={items.find((item) => item.id === (value ?? "")) ?? null}
        onValueChange={(item) => onChange(item?.id || null)}
        itemToStringLabel={(item) => item.name}
        isItemEqualToValue={(item, selected) => item.id === selected.id}
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          disabled={disabled}
          aria-invalid={!!error}
          placeholder={`Search ${label.toLowerCase()}…`}
        />
        <ComboboxContent>
          <ComboboxEmpty>No matches.</ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
export function ClientForm({
  client,
  coops,
  municipalities,
  onSaved,
  onEditExisting,
  onCancel,
  presentation = "sheet",
}: Props) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [existing, setExisting] = useState<Client>();
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          phone: client.phone,
          kind: client.kind,
          municipality_id: client.municipality_id,
          coop_id: client.coop_id,
        }
      : {
          name: "",
          phone: "",
          kind: "farmer",
          municipality_id: null,
          coop_id: null,
        },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const submit = form.handleSubmit((input) =>
    startTransition(async () => {
      setMessage(undefined);
      setExisting(undefined);
      try {
        const result = await saveClient(input, client?.id);
        if (result.status === "error") {
          setMessage(result.message);
          for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
            form.setError(
              field as keyof ClientInput,
              { message: error },
              { shouldFocus: true },
            );
        } else if (result.status === "existing") setExisting(result.client);
        else {
          form.reset();
          onSaved();
        }
      } catch {
        setMessage("Unable to save the client. Please try again.");
      }
    }),
  );
  const actions = () => (
    <>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "Saving…" : client ? "Save changes" : "Save client"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          form.reset();
          setMessage(undefined);
          setExisting(undefined);
          onCancel();
        }}
      >
        Cancel
      </Button>
    </>
  );
  return (
    <form
      onSubmit={submit}
      className={
        presentation === "sheet"
          ? "flex min-h-0 flex-1 flex-col overflow-y-auto"
          : "flex flex-col gap-4"
      }
    >
      <FieldGroup className={presentation === "sheet" ? "p-4" : undefined}>
        <Field data-invalid={!!form.formState.errors.name}>
          <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
          <Input
            id={`${formId}-name`}
            placeholder="Full name"
            autoComplete="name"
            autoFocus={presentation === "sheet"}
            {...form.register("name")}
            aria-invalid={!!form.formState.errors.name}
            disabled={pending}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>
        <Field data-invalid={!!form.formState.errors.phone}>
          <FieldLabel htmlFor={`${formId}-phone`}>Phone</FieldLabel>
          <Input
            id={`${formId}-phone`}
            type="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            {...form.register("phone")}
            aria-invalid={!!form.formState.errors.phone}
            disabled={pending}
          />
          <FieldError errors={[form.formState.errors.phone]} />
        </Field>
        <Controller
          control={form.control}
          name="municipality_id"
          render={({ field, fieldState }) => (
            <Lookup
              id={`${formId}-municipality`}
              label="Municipality"
              options={municipalities}
              value={field.value}
              onChange={field.onChange}
              disabled={pending}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="coop_id"
          render={({ field, fieldState }) => (
            <Lookup
              id={`${formId}-coop`}
              label="Co-op"
              options={coops.filter((coop) => coop.id !== client?.id)}
              value={field.value}
              onChange={field.onChange}
              disabled={pending || kind === "coop"}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="kind"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel id={`${formId}-kind-label`}>Kind</FieldLabel>
              <ToggleGroup
                aria-labelledby={`${formId}-kind-label`}
                value={[field.value]}
                disabled={pending}
                onValueChange={(values) => {
                  if (!values[0]) return;
                  field.onChange(values[0]);
                  if (values[0] === "coop")
                    form.setValue("coop_id", null, { shouldValidate: true });
                }}
                variant="outline"
                size="sm"
                className="flex-wrap"
              >
                {clientKinds.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {kindLabels[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to save</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {existing ? (
          <Alert>
            <AlertTitle>Client already registered</AlertTitle>
            <AlertDescription>
              <p>
                {existing.name} · {existing.phone}
              </p>
              <p>The existing details have been preserved.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => onEditExisting(existing)}
              >
                Edit existing client
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
      {presentation === "sheet" ? (
        <SheetFooter>{actions()}</SheetFooter>
      ) : (
        <div className="flex flex-wrap items-center gap-2">{actions()}</div>
      )}
    </form>
  );
}

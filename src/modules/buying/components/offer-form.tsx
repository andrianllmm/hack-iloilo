"use client";

import { useActionState, useState } from "react";
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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { submitOffer, type OfferFormState } from "../actions";

type ClientOption = { id: string; name: string; phone: string };
type VarietyOption = { id: string; code: string; name: string };

export function OfferForm({
  clients,
  varieties,
}: {
  clients: ClientOption[];
  varieties: VarietyOption[];
}) {
  const [state, action, pending] = useActionState(submitOffer, undefined);
  // A new ref means a successful submit: remount the fields to clear them
  // (DOM and phone state both reset), without a setState-in-effect.
  const resetKey = state?.ok ? state.ref : "new";

  return (
    <OfferFields
      key={resetKey}
      clients={clients}
      varieties={varieties}
      action={action}
      pending={pending}
      state={state}
    />
  );
}

function OfferFields({
  clients,
  varieties,
  action,
  pending,
  state,
}: {
  clients: ClientOption[];
  varieties: VarietyOption[];
  action: (formData: FormData) => void;
  pending: boolean;
  state: OfferFormState;
}) {
  const [phone, setPhone] = useState("");

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="clientId">Client</FieldLabel>
          <NativeSelect
            id="clientId"
            name="clientId"
            className="w-full"
            required
            defaultValue=""
            onChange={(e) => {
              const client = clients.find((c) => c.id === e.target.value);
              setPhone(client?.phone ?? "");
            }}
          >
            <NativeSelectOption value="" disabled>
              Select a client
            </NativeSelectOption>
            {clients.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="varietyId">Variety</FieldLabel>
          <NativeSelect
            id="varietyId"
            name="varietyId"
            className="w-full"
            defaultValue=""
          >
            <NativeSelectOption value="">Unknown</NativeSelectOption>
            {varieties.map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.code} — {v.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Optional.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="estKg">Estimated kilos</FieldLabel>
          <Input
            id="estKg"
            name="estKg"
            type="number"
            min={1}
            step={1}
            required
            placeholder="3000"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="harvestDate">Harvest date</FieldLabel>
          <Input id="harvestDate" name="harvestDate" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="bookedByPhone">Contact phone</FieldLabel>
          <Input
            id="bookedByPhone"
            name="bookedByPhone"
            type="tel"
            required
            placeholder="+639XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <FieldDescription>Who to text the decision to.</FieldDescription>
        </Field>

        {state && !state.ok && <FieldError>{state.error}</FieldError>}
        {state?.ok && (
          <FieldDescription>Offer {state.ref} recorded.</FieldDescription>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record offer"}
        </Button>
      </FieldGroup>
    </form>
  );
}

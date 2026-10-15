"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { savePrice } from "../actions";

/** Pre-filled values: pesos as decimal strings, factors as plain decimals. */
export type PriceFormDefaults = {
  effectiveDate: string;
  buyBase: string;
  damaged: string;
  immature: string;
  foreign: string;
  rice: string;
  drying: string;
  milling: string;
};

export function PriceForm({ defaults }: { defaults: PriceFormDefaults }) {
  const [state, action, pending] = useActionState(savePrice, undefined);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="effectiveDate">Effective date</FieldLabel>
          <Input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            required
            defaultValue={defaults.effectiveDate}
          />
          <FieldDescription>
            Reads back on this date; re-saving a date overwrites it.
          </FieldDescription>
        </Field>

        <Peso
          id="buyBase"
          label="Palay buying base @ 25% MC"
          defaultValue={defaults.buyBase}
          placeholder="21.00"
        />

        <div className="grid grid-cols-3 gap-3">
          <Factor
            id="damaged"
            label="Damaged"
            defaultValue={defaults.damaged}
          />
          <Factor
            id="immature"
            label="Immature"
            defaultValue={defaults.immature}
          />
          <Factor
            id="foreign"
            label="Foreign"
            defaultValue={defaults.foreign}
          />
        </div>
        <FieldDescription>
          Deduction factors: fraction of the affected kilos removed.
        </FieldDescription>

        <div className="grid grid-cols-2 gap-3">
          <Peso
            id="drying"
            label="Drying fee"
            defaultValue={defaults.drying}
            placeholder="1.60"
          />
          <Peso
            id="milling"
            label="Milling fee"
            defaultValue={defaults.milling}
            placeholder="3.30"
          />
        </div>

        <Peso
          id="rice"
          label="Rice selling price"
          defaultValue={defaults.rice}
          placeholder="47.00"
        />

        {state && !state.ok && <FieldError>{state.error}</FieldError>}
        {state?.ok && (
          <FieldDescription>
            Prices saved, effective {state.effectiveDate}.
          </FieldDescription>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function Peso({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        type="number"
        min={0}
        step={0.01}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </Field>
  );
}

function Factor({
  id,
  label,
  defaultValue,
}: {
  id: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        type="number"
        min={0}
        max={1}
        step={0.01}
        required
        defaultValue={defaultValue}
      />
    </Field>
  );
}

"use client";

import { useId, useState, useTransition } from "react";
import { Controller, type FieldValues, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/date-time-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { joinManila, splitManila } from "@/lib/dates";
import {
  finishDryingBatch,
  finishMillingBatch,
  skipDryingBatch,
  startDryingBatch,
  startMillingBatch,
  type StageResult,
} from "../actions";
import {
  finishDryingSchema,
  type FinishDryingInput,
  finishMillingSchema,
  type FinishMillingInput,
  startDryingSchema,
  type StartDryingInput,
  startMillingSchema,
  type StartMillingInput,
} from "../batch-schema";
import type { Batch } from "../types";

type Machine = { id: string; code: string };

/** Current Manila wall-clock as the picker's ISO format. */
function nowManila(): string {
  const { date, time } = splitManila(new Date());
  return joinManila(date, time);
}

/** The next step for a batch, matching the stage it's on. */
export function BatchStages({
  batch,
  dryers,
  mills,
}: {
  batch: Pick<Batch, "id" | "stage">;
  dryers: Machine[];
  mills: Machine[];
}) {
  switch (batch.stage) {
    case "received":
      return <ReceivedForms batchId={batch.id} dryers={dryers} />;
    case "drying":
      return <FinishDryingForm batchId={batch.id} />;
    case "stored":
      return <StartMillingForm batchId={batch.id} mills={mills} />;
    case "milling":
      return <FinishMillingForm batchId={batch.id} />;
    default:
      return null;
  }
}

/** Shared submit wiring: run the action, map errors back onto the form. */
function useStageSubmit<T extends FieldValues>(
  form: ReturnType<typeof useForm<T>>,
  action: (input: T) => Promise<StageResult>,
  done: string,
) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const submit = form.handleSubmit((input) =>
    startTransition(async () => {
      setMessage(undefined);
      const result = await action(input);
      if (result.status === "error") {
        setMessage(result.message);
        for (const [field, error] of Object.entries(result.fieldErrors ?? {}))
          form.setError(field as never, { message: error });
        return;
      }
      toast.success(done);
    }),
  );
  return { pending, message, submit };
}

function StageCard({
  title,
  description,
  pending,
  message,
  submit,
  submitLabel,
  children,
  extra,
}: {
  title: string;
  description: string;
  pending: boolean;
  message?: string;
  submit: () => void;
  submitLabel: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <FieldGroup>{children}</FieldGroup>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
        {extra}
      </div>
    </form>
  );
}

function ReceivedForms({
  batchId,
  dryers,
}: {
  batchId: string;
  dryers: Machine[];
}) {
  const formId = useId();
  const form = useForm<StartDryingInput>({
    resolver: zodResolver(startDryingSchema),
    defaultValues: { dryer_id: "", dry_start: nowManila() },
  });
  const { pending, message, submit } = useStageSubmit(
    form,
    (input) => startDryingBatch(batchId, input),
    "Drying started.",
  );
  const [skipping, startSkip] = useTransition();
  const errors = form.formState.errors;

  return (
    <StageCard
      title="Start drying"
      description="Load the palay into a dryer. Dry palay can skip this step."
      pending={pending}
      message={message}
      submit={submit}
      submitLabel={pending ? "Starting…" : "Start drying"}
      extra={
        <Button
          type="button"
          variant="outline"
          disabled={skipping}
          onClick={() =>
            startSkip(async () => {
              const result = await skipDryingBatch(batchId);
              if (result.status === "error")
                toast.error(result.message ?? "Couldn't skip drying.");
              else toast.success("Drying skipped — moved to storage.");
            })
          }
        >
          {skipping ? <Spinner data-icon="inline-start" /> : null}
          Skip drying
        </Button>
      }
    >
      <Field data-invalid={!!errors.dryer_id}>
        <FieldLabel htmlFor={`${formId}-dryer`}>Dryer</FieldLabel>
        <NativeSelect
          id={`${formId}-dryer`}
          className="w-full"
          aria-invalid={!!errors.dryer_id}
          disabled={pending}
          {...form.register("dryer_id")}
        >
          <NativeSelectOption value="">Choose a dryer…</NativeSelectOption>
          {dryers.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError errors={[errors.dryer_id]} />
      </Field>
      <Controller
        control={form.control}
        name="dry_start"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Started</FieldLabel>
            <DateTimePicker
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              disabled={pending}
              aria-invalid={!!fieldState.error}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </StageCard>
  );
}

function FinishDryingForm({ batchId }: { batchId: string }) {
  const formId = useId();
  const form = useForm<FinishDryingInput>({
    resolver: zodResolver(finishDryingSchema),
    defaultValues: {
      dry_end: nowManila(),
      mc_out: undefined,
      dried_kg: undefined,
    },
  });
  const { pending, message, submit } = useStageSubmit(
    form,
    (input) => finishDryingBatch(batchId, input),
    "Drying finished — moved to storage.",
  );
  const errors = form.formState.errors;

  return (
    <StageCard
      title="Finish drying"
      description="Record the dried palay coming out of the dryer."
      pending={pending}
      message={message}
      submit={submit}
      submitLabel={pending ? "Saving…" : "Finish drying"}
    >
      <Controller
        control={form.control}
        name="dry_end"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Finished</FieldLabel>
            <DateTimePicker
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              disabled={pending}
              aria-invalid={!!fieldState.error}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Field data-invalid={!!errors.mc_out}>
        <FieldLabel htmlFor={`${formId}-mc`}>Moisture out (%)</FieldLabel>
        <Input
          id={`${formId}-mc`}
          type="number"
          inputMode="decimal"
          step="0.1"
          min={0}
          max={100}
          aria-invalid={!!errors.mc_out}
          disabled={pending}
          {...form.register("mc_out", { valueAsNumber: true })}
        />
        <FieldError errors={[errors.mc_out]} />
      </Field>
      <Field data-invalid={!!errors.dried_kg}>
        <FieldLabel htmlFor={`${formId}-dried`}>Dried weight (kg)</FieldLabel>
        <Input
          id={`${formId}-dried`}
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          aria-invalid={!!errors.dried_kg}
          disabled={pending}
          {...form.register("dried_kg", { valueAsNumber: true })}
        />
        <FieldError errors={[errors.dried_kg]} />
      </Field>
    </StageCard>
  );
}

function StartMillingForm({
  batchId,
  mills,
}: {
  batchId: string;
  mills: Machine[];
}) {
  const formId = useId();
  const form = useForm<StartMillingInput>({
    resolver: zodResolver(startMillingSchema),
    defaultValues: { mill_id: "", mill_start: nowManila() },
  });
  const { pending, message, submit } = useStageSubmit(
    form,
    (input) => startMillingBatch(batchId, input),
    "Milling started.",
  );
  const errors = form.formState.errors;

  return (
    <StageCard
      title="Start milling"
      description="Load the dried palay into the mill."
      pending={pending}
      message={message}
      submit={submit}
      submitLabel={pending ? "Starting…" : "Start milling"}
    >
      <Field data-invalid={!!errors.mill_id}>
        <FieldLabel htmlFor={`${formId}-mill`}>Mill</FieldLabel>
        <NativeSelect
          id={`${formId}-mill`}
          className="w-full"
          aria-invalid={!!errors.mill_id}
          disabled={pending}
          {...form.register("mill_id")}
        >
          <NativeSelectOption value="">Choose a mill…</NativeSelectOption>
          {mills.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError errors={[errors.mill_id]} />
      </Field>
      <Controller
        control={form.control}
        name="mill_start"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Started</FieldLabel>
            <DateTimePicker
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              disabled={pending}
              aria-invalid={!!fieldState.error}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </StageCard>
  );
}

function FinishMillingForm({ batchId }: { batchId: string }) {
  const formId = useId();
  const form = useForm<FinishMillingInput>({
    resolver: zodResolver(finishMillingSchema),
    defaultValues: {
      mill_end: nowManila(),
      mill_in_kg: undefined,
      rice_kg: undefined,
      bran_kg: null,
      husk_kg: null,
    },
  });
  const { pending, message, submit } = useStageSubmit(
    form,
    (input) => finishMillingBatch(batchId, input),
    "Milling finished.",
  );
  const errors = form.formState.errors;
  const asKg = { valueAsNumber: true } as const;
  const asNullableKg = {
    setValueAs: (value: string) => (value === "" ? null : Number(value)),
  } as const;

  return (
    <StageCard
      title="Finish milling"
      description="Record the rice and by-products. Recovery is computed."
      pending={pending}
      message={message}
      submit={submit}
      submitLabel={pending ? "Saving…" : "Finish milling"}
    >
      <Controller
        control={form.control}
        name="mill_end"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Finished</FieldLabel>
            <DateTimePicker
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              disabled={pending}
              aria-invalid={!!fieldState.error}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Field data-invalid={!!errors.mill_in_kg}>
        <FieldLabel htmlFor={`${formId}-in`}>Into the mill (kg)</FieldLabel>
        <Input
          id={`${formId}-in`}
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          aria-invalid={!!errors.mill_in_kg}
          disabled={pending}
          {...form.register("mill_in_kg", asKg)}
        />
        <FieldError errors={[errors.mill_in_kg]} />
      </Field>
      <Field data-invalid={!!errors.rice_kg}>
        <FieldLabel htmlFor={`${formId}-rice`}>Rice out (kg)</FieldLabel>
        <Input
          id={`${formId}-rice`}
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          aria-invalid={!!errors.rice_kg}
          disabled={pending}
          {...form.register("rice_kg", asKg)}
        />
        <FieldError errors={[errors.rice_kg]} />
      </Field>
      <Field data-invalid={!!errors.bran_kg}>
        <FieldLabel htmlFor={`${formId}-bran`}>Bran / darak (kg)</FieldLabel>
        <Input
          id={`${formId}-bran`}
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          placeholder="Optional"
          aria-invalid={!!errors.bran_kg}
          disabled={pending}
          {...form.register("bran_kg", asNullableKg)}
        />
        <FieldError errors={[errors.bran_kg]} />
      </Field>
      <Field data-invalid={!!errors.husk_kg}>
        <FieldLabel htmlFor={`${formId}-husk`}>Husk / ipa (kg)</FieldLabel>
        <Input
          id={`${formId}-husk`}
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          placeholder="Optional"
          aria-invalid={!!errors.husk_kg}
          disabled={pending}
          {...form.register("husk_kg", asNullableKg)}
        />
        <FieldError errors={[errors.husk_kg]} />
      </Field>
    </StageCard>
  );
}

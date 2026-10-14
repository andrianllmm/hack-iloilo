"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Pickers speak `YYYY-MM-DD` strings (Asia/Manila calendar dates, as in
// `@/lib/dates`); react-day-picker speaks local `Date`s at midnight.

export function toPickerDate(date: string | undefined): Date | undefined {
  if (!date) return undefined;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fromPickerDate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const display = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatPickerDate(date: string): string {
  return display.format(toPickerDate(date));
}

export type DatePickerProps = {
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Earliest selectable date, `YYYY-MM-DD`. */
  min?: string;
  /** Latest selectable date, `YYYY-MM-DD`. */
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toPickerDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            className={className}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {value ? (
          formatPickerDate(value)
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          disabled={pickerBounds(min, max)}
          onSelect={(date) => {
            onChange?.(fromPickerDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function pickerBounds(min?: string, max?: string) {
  const before = toPickerDate(min);
  const after = toPickerDate(max);
  return [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
}

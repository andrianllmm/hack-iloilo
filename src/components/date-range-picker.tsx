"use client";

import { CalendarIcon } from "lucide-react";

import {
  formatPickerDate,
  fromPickerDate,
  pickerBounds,
  toPickerDate,
} from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Inclusive range of `YYYY-MM-DD` dates. */
export type DateRangeValue = { from?: string; to?: string };

export type DateRangePickerProps = {
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue | undefined) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick dates",
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  className,
}: DateRangePickerProps) {
  const from = toPickerDate(value?.from);
  const to = toPickerDate(value?.to);

  return (
    <Popover>
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
        {value?.from ? (
          value.to ? (
            `${formatPickerDate(value.from)} – ${formatPickerDate(value.to)}`
          ) : (
            formatPickerDate(value.from)
          )
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={from ? { from, to } : undefined}
          defaultMonth={from}
          disabled={pickerBounds(min, max)}
          onSelect={(range) =>
            onChange?.(
              range
                ? {
                    from: fromPickerDate(range.from),
                    to: fromPickerDate(range.to),
                  }
                : undefined,
            )
          }
        />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import {
  formatPickerDate,
  fromPickerDate,
  PickerPopover,
  toPickerDate,
  usePickerBounds,
} from "@/components/date-picker";
import { Calendar } from "@/components/ui/calendar";

/** Inclusive range of `YYYY-MM-DD` dates. */
export type DateRangeValue = { from?: string; to?: string };

export type DateRangePickerProps = {
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue | undefined) => void;
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

export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick dates",
  ...trigger
}: DateRangePickerProps) {
  const from = toPickerDate(value?.from);
  const to = toPickerDate(value?.to);
  const bounds = usePickerBounds(min, max);

  return (
    <PickerPopover
      label={
        value?.from
          ? value.to
            ? `${formatPickerDate(value.from)} – ${formatPickerDate(value.to)}`
            : formatPickerDate(value.from)
          : undefined
      }
      placeholder={placeholder}
      {...trigger}
    >
      {(close) => (
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={from ? { from, to } : undefined}
          defaultMonth={from}
          disabled={bounds}
          onSelect={(range) => {
            const next = range?.from
              ? {
                  from: fromPickerDate(range.from),
                  to: fromPickerDate(range.to),
                }
              : undefined;
            onChange?.(next);
            // Close once a second, different day completes the range.
            if (next?.to && next.to !== next.from) close();
          }}
        />
      )}
    </PickerPopover>
  );
}

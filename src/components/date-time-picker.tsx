"use client";

import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { joinManila, splitManila } from "@/lib/dates";

export type DateTimePickerProps = {
  /** ISO timestamp, e.g. from a `timestamptz` column. */
  value?: string;
  /** Emits `YYYY-MM-DDTHH:mm:00+08:00`. */
  onChange?: (value: string | undefined) => void;
  /** Earliest selectable day, as an ISO timestamp or `YYYY-MM-DD`. */
  min?: string;
  /** Latest selectable day, as an ISO timestamp or `YYYY-MM-DD`. */
  max?: string;
  /** Time used when only a date has been picked. */
  defaultTime?: string;
  stepMinutes?: number;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
};

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  defaultTime = "08:00",
  stepMinutes,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
  const current = value ? splitManila(value) : undefined;

  return (
    <div className="flex gap-2">
      <DatePicker
        id={id}
        value={current?.date}
        min={min && toManilaDate(min)}
        max={max && toManilaDate(max)}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={(date) =>
          onChange?.(
            date ? joinManila(date, current?.time ?? defaultTime) : undefined,
          )
        }
      />
      <TimePicker
        aria-label="Time"
        value={current?.time}
        stepMinutes={stepMinutes}
        disabled={disabled || !current}
        aria-invalid={ariaInvalid}
        onChange={(time) =>
          current && time && onChange?.(joinManila(current.date, time))
        }
      />
    </div>
  );
}

// A bare `YYYY-MM-DD` parses as UTC midnight, which is still that day in Manila.
function toManilaDate(value: string): string {
  return splitManila(value).date;
}

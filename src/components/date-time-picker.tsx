"use client";

import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";

const manilaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Any ISO timestamp as Manila `{ date: "YYYY-MM-DD", time: "HH:mm" }`. */
export function splitManila(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(
    manilaParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

/** Manila date and time as a `timestamptz`-ready ISO string. */
export function joinManila(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

export type DateTimePickerProps = {
  /** ISO timestamp, e.g. from a `timestamptz` column. */
  value?: string;
  /** Emits `YYYY-MM-DDTHH:mm:00+08:00`. */
  onChange?: (value: string | undefined) => void;
  min?: string;
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
        min={min}
        max={max}
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

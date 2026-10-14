"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type TimePickerProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  /** `HH:mm`, 24-hour. */
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Minutes between choices. */
  stepMinutes?: number;
};

export function TimePicker({
  value,
  onChange,
  stepMinutes = 15,
  className,
  ...props
}: TimePickerProps) {
  return (
    <Input
      type="time"
      step={stepMinutes * 60}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value || undefined)}
      className={cn(
        "w-32 appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden",
        className,
      )}
      {...props}
    />
  );
}

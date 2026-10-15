"use client";
import type { Ref } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientKinds, kindLabels } from "../logic";
import type { ClientKind } from "../types";

type Props = {
  value: ClientKind | "all";
  onChange: (value: ClientKind | "all") => void;
  includeAll?: boolean;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
};
const kinds = clientKinds.map((value) => ({ value, label: kindLabels[value] }));
const allKinds = [{ value: "all" as const, label: "All kinds" }, ...kinds];
/** Shared kind control for the directory, quick registration and editing. */
export function ClientKindSelect({
  value,
  onChange,
  includeAll = false,
  id,
  disabled,
  invalid,
  onBlur,
  triggerRef,
}: Props) {
  const items = includeAll ? allKinds : kinds;
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        ref={triggerRef}
        onBlur={onBlur}
        aria-invalid={invalid}
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

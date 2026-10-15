"use client";

import { toPickerDate } from "@/components/date-picker";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckInMode } from "../checkin-schema";
import { formatDay, recordDateNote } from "../logic";
import type { RefPreview } from "../types";

const ignoreSelect = () => {};

/**
 * Read-only month around today and the checked-in record's date: a booking's
 * scheduled day or an offer's harvest day. Walk-ins arrive today.
 */
export function DateContextCard({
  today,
  mode,
  preview,
}: {
  today: string;
  mode: CheckInMode;
  preview: RefPreview | null;
}) {
  const record = preview?.date;
  const month = toPickerDate(record ?? today);
  const recordLabel = preview?.kind === "offer" ? "Harvest" : "Scheduled";
  const note = preview
    ? recordDateNote(preview.kind, preview.date, today)
    : mode === "walkIn"
      ? "Walk-ins arrive today"
      : "Select a booking or offer for its date";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date context</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* The record date shows as selected. Without onSelect, DayPicker would
            take `selected` only as its initial value; this one ignores clicks. */}
        <Calendar
          mode="single"
          selected={toPickerDate(record)}
          onSelect={ignoreSelect}
          month={month}
          hideNavigation
          classNames={{
            today:
              "rounded-(--cell-radius) [&_button]:font-semibold [&_button]:ring-2 [&_button]:ring-primary [&_button]:ring-inset",
          }}
          className="mx-auto p-0 [--cell-size:--spacing(11)]"
        />
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="size-6 rounded-md border-2 border-primary" />
            Today · {formatDay(today)}
          </li>
          {mode === "walkIn" && !preview ? null : (
            <li className="flex items-center gap-2">
              {record ? (
                <span className="size-6 rounded-md bg-primary" />
              ) : (
                <span className="size-6" />
              )}
              {record
                ? `${recordLabel} · ${formatDay(record)}`
                : "Record date · Not selected"}
            </li>
          )}
        </ul>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

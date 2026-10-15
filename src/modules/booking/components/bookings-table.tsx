"use client";

import { ServiceLabel } from "@/components/service-icon";
import { Fragment, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKg, formatTonnes } from "@/lib/format";
import { cancelBookingByStaff } from "../actions";
import {
  bookedByLabel,
  formatDay,
  formatShortDate,
  serviceLabels,
  statusLabels,
  type BookingGroup,
} from "../logic";
import type { BookingClient, BookingRow, BookingStatus } from "../types";

/** Rows shown per day before `+ N more`. */
const GROUP_PREVIEW = 6;
const COLUMNS = 8;
const kgFormat = new Intl.NumberFormat("en-US");
const statusVariants: Record<
  BookingStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  confirmed: "secondary",
  reschedule_proposed: "outline",
  arrived: "default",
  cancelled: "destructive",
  no_show: "destructive",
};

export function BookingsTable({
  groups,
  clients,
  onReschedule,
}: {
  groups: BookingGroup[];
  clients: BookingClient[];
  onReschedule: (booking: BookingRow) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<BookingRow | null>(null);
  const [pending, startTransition] = useTransition();
  const namesByPhone = useMemo(
    () => new Map(clients.map((client) => [client.phone, client.name])),
    [clients],
  );
  const showService = new Set(groups.map((group) => group.service)).size > 1;

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Booked by</TableHead>
              <TableHead className="text-right">Est. kg</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Flex</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const key = `${group.date}|${group.service}`;
              const open = expanded.has(key);
              const rows = open
                ? group.rows
                : group.rows.slice(0, GROUP_PREVIEW);
              const hidden = group.rows.length - rows.length;
              return (
                <Fragment key={key}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={COLUMNS} className="font-medium">
                      <ServiceLabel kind={group.service}>
                        {[
                          formatDay(group.date),
                          showService ? serviceLabels[group.service] : null,
                          `${group.count} ${group.count === 1 ? "booking" : "bookings"}`,
                          formatTonnes(group.totalKg),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </ServiceLabel>
                      <span className="sr-only">
                        {" "}
                        ({formatKg(group.totalKg)})
                      </span>
                    </TableCell>
                  </TableRow>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">{row.ref}</TableCell>
                      <TableCell>{row.client.name}</TableCell>
                      <TableCell>{bookedByLabel(row, namesByPhone)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {kgFormat.format(row.est_kg)}
                      </TableCell>
                      <TableCell>
                        {formatShortDate(row.scheduled_date)}
                      </TableCell>
                      <TableCell>
                        {row.flex_days ? `${row.flex_days} d` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[row.status]}>
                          {statusLabels[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status === "confirmed" ||
                        row.status === "reschedule_proposed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Reschedule booking ${row.ref}`}
                            onClick={() => onReschedule(row)}
                          >
                            Reschedule
                          </Button>
                        ) : null}
                        {row.status === "confirmed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Cancel booking ${row.ref}`}
                            onClick={() => setCancelling(row)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {hidden > 0 ? (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={COLUMNS - 1}>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0"
                          onClick={() =>
                            setExpanded((previous) =>
                              new Set(previous).add(key),
                            )
                          }
                        >
                          + {hidden} more
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCancelling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel booking {cancelling?.ref}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling
                ? `${cancelling.client.name} · ${serviceLabels[cancelling.service].toLowerCase()} · ${formatKg(cancelling.est_kg)} on ${formatDay(cancelling.scheduled_date)}. This frees the slot and can't be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Keep booking
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!cancelling) return;
                const { ref } = cancelling;
                startTransition(async () => {
                  try {
                    const result = await cancelBookingByStaff(ref);
                    if (result.status === "error") toast.error(result.message);
                    else toast.success(`Booking ${ref} cancelled.`);
                  } catch {
                    toast.error(
                      "Unable to cancel the booking. Please try again.",
                    );
                  } finally {
                    setCancelling(null);
                  }
                });
              }}
            >
              {pending ? "Cancelling…" : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

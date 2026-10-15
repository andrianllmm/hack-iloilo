"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
import { formatKg } from "@/lib/format";
import { serviceLabels, stageLabels } from "../logic";
import type { BatchListRow } from "../types";

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

type Row = BatchListRow & {
  clientName: string;
  line: string;
  /** The latest weight the batch has recorded. */
  kg: number | null;
};

const columnHelper = createColumnHelper<typeof features, Row>();

const day = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

const columns = columnHelper.columns([
  columnHelper.accessor("batch_no", {
    header: "Batch",
    cell: ({ row }) => (
      <Link
        href={`/batches/${row.original.id}`}
        className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline"
      >
        {row.original.batch_no}
      </Link>
    ),
  }),
  columnHelper.accessor("clientName", { header: "Client" }),
  columnHelper.accessor("line", { header: "Line" }),
  columnHelper.accessor("ownership", {
    header: "Ownership",
    cell: ({ getValue }) => (getValue() === "irpc" ? "IRPC" : "Custom"),
  }),
  columnHelper.accessor("stage", {
    header: "Stage",
    cell: ({ row, getValue }) => (
      <span className="flex flex-wrap items-center gap-1">
        <Badge variant="secondary">{stageLabels[getValue()]}</Badge>
        {row.original.confirmations.some((c) => c.status === "disputed") ? (
          <Badge variant="destructive">Weight disputed</Badge>
        ) : null}
      </span>
    ),
  }),
  columnHelper.accessor("kg", {
    header: "Weight",
    sortFn: "basic",
    cell: ({ getValue }) => {
      const kg = getValue();
      return kg ? formatKg(kg) : "—";
    },
  }),
  columnHelper.accessor("created_at", {
    header: "Opened",
    sortFn: "basic",
    cell: ({ getValue }) => day.format(new Date(getValue())),
  }),
]);

/** Sortable, paginated batch records. */
export function BatchesDataTable({ batches }: { batches: BatchListRow[] }) {
  const data = useMemo(
    () =>
      batches.map((batch) => ({
        ...batch,
        clientName: batch.client.name,
        line: batch.entry ? serviceLabels[batch.entry.service] : "—",
        kg: batch.rice_kg ?? batch.dried_kg ?? batch.net_kg,
      })),
    [batches],
  );
  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => row.id,
    defaultColumn: { sortFn: "alphanumeric", sortDescFirst: false },
    enableMultiSort: false,
    initialState: {
      sorting: [{ id: "created_at", desc: true }],
      pagination: { pageIndex: 0, pageSize: 20 },
    },
  });
  const rows = table.getRowModel().rows;
  const right = (id: string) => id === "kg";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0 overflow-auto rounded-lg border">
        <Table className="min-w-2xl">
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon =
                    sorted === "asc"
                      ? ArrowUp
                      : sorted === "desc"
                        ? ArrowDown
                        : ArrowUpDown;
                  return (
                    <TableHead
                      key={header.id}
                      className={right(header.column.id) ? "text-right" : ""}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mx-2 text-xs font-bold tracking-wide uppercase"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        <SortIcon
                          data-icon="inline-end"
                          className={sorted ? "" : "text-muted-foreground"}
                        />
                      </Button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={right(cell.column.id) ? "text-right" : ""}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Page {table.state.pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { features, type DirectoryRow } from "./clients-table-model";

const data: DirectoryRow[] = Array.from({ length: 23 }, (_, index) => ({
  id: String(index),
  name: `Client ${23 - index}`,
  phone: `+639${String(index).padStart(9, "0")}`,
  kind: "farmer",
  municipality_id: null,
  coop_id: null,
  created_at: "",
  updated_at: "",
  coop: null,
  coopName: "—",
  municipality: "—",
}));

// Mount the real React adapter without a browser or DOM dependency.
function model() {
  let table!: ReturnType<typeof useTable<typeof features, DirectoryRow>>;
  function Harness() {
    table = useTable({
      features,
      data,
      columns: [{ accessorKey: "name" }],
      defaultColumn: { sortFn: "alphanumeric", sortDescFirst: false },
      getRowId: (row) => row.id,
    });
    return null;
  }
  renderToString(createElement(Harness));
  return table;
}

describe("directory table pagination and sorting", () => {
  it("visits each client once across pages and disables the last page", () => {
    const table = model();
    const ids: string[] = [];
    expect(table.getCanPreviousPage()).toBe(false);
    do {
      ids.push(...table.getRowModel().rows.map((row) => row.id));
      if (!table.getCanNextPage()) break;
      table.nextPage();
    } while (true);
    expect(ids).toEqual(data.map((row) => row.id));
    expect(table.getRowModel().rows).toHaveLength(3);
    expect(table.getCanNextPage()).toBe(false);
    table.previousPage();
    expect(table.getRowModel().rows).toHaveLength(10);
  });

  it("sorts the full dataset before pagination in both directions", () => {
    const table = model();
    table.setSorting([{ id: "name", desc: false }]);
    expect(table.getRowModel().rows[0].original.name).toBe("Client 1");
    table.nextPage();
    expect(table.getRowModel().rows[0].original.name).toBe("Client 11");
    table.setSorting([{ id: "name", desc: true }]);
    table.firstPage();
    expect(table.getRowModel().rows[0].original.name).toBe("Client 23");
    table.setSorting([]);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(
      data.slice(0, 10).map((row) => row.id),
    );
  });

  it("returns to page one when filters shrink the result set", async () => {
    const table = model();
    table.getRowModel();
    table.nextPage();
    table.nextPage();
    expect(table.getRowModel().rows).toHaveLength(3);
    table.setOptions((previous) => ({ ...previous, data: data.slice(0, 1) }));
    table.getRowModel();
    // The page index reset is scheduled as a microtask after the row model updates.
    await Promise.resolve();
    expect(table.store.state.pagination.pageIndex).toBe(0);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual([data[0].id]);
  });

  it("changes page size without dropping clients", () => {
    const table = model();
    table.setPageSize(20);
    expect(table.getRowModel().rows).toHaveLength(20);
    table.nextPage();
    expect(table.getRowModel().rows).toHaveLength(3);
    table.setPageSize(50);
    expect(table.getPageCount()).toBe(1);
    expect(table.getRowModel().rows).toHaveLength(23);
  });
});

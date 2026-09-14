// Generic client-side table built on TanStack Table v9: sortable headers
// (shift-click multi-sorts), drag-and-drop column reordering and row anchors.
// The toolbar (search, filters, column menu) lives in TableToolbar.tsx.
import { useState } from "react";
import {
  flexRender,
  useTable,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { features, moveToTarget } from "@/components/data-table/features.js";
import type {
  DataTableColumn,
  TableFilter,
} from "@/components/data-table/features.js";
import { TableToolbar } from "@/components/data-table/TableToolbar.js";
import { cn } from "@/components/ui";

interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  filters?: TableFilter[];
  initialSorting?: SortingState;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Filtering is owned by the parent; retain only table-specific controls. */
  externalFiltering?: boolean;
  /** Called when a row's whitespace is clicked (inner buttons/links excluded). */
  onRowClick?: (row: TData) => void;
  /** Stable DOM id used for deep links to a specific row. */
  getRowAnchor?: (row: TData) => string | undefined;
  /** Visually distinguishes a row selected by the parent. */
  isRowHighlighted?: (row: TData) => boolean;
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  filters = [],
  initialSorting = [],
  searchPlaceholder = "Search…",
  emptyMessage = "No rows.",
  externalFiltering = false,
  onRowClick,
  getRowAnchor,
  isRowHighlighted,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnOrder,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
  });

  // Splice-based reorder, as recommended by the TanStack column-ordering guide.
  const dropOn = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setColumnOrder((prev) =>
      moveToTarget(
        table.getVisibleLeafColumns().map((c) => c.id),
        draggingId,
        targetId,
      ),
    );
  };

  const rows = table.getRowModel().rows;
  const total = data.length;
  const filtered = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3">
      <TableToolbar
        table={table}
        filters={filters}
        searchPlaceholder={searchPlaceholder}
        externalFiltering={externalFiltering}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        onColumnOrderChange={setColumnOrder}
        total={total}
        filtered={filtered}
      />

      <div className="overflow-x-auto rounded-xl border border-edge bg-panel shadow-[0_18px_45px_rgba(0,0,0,0.08)]">
        <table className="w-full border-collapse text-[0.9rem] [&>tbody>tr:hover]:bg-ok/[0.025] [&>tbody>tr:last-child>td]:border-b-0">
          <thead className="bg-raise/55">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const column = header.column;
                  const sorted = column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      draggable
                      onDragStart={() => setDraggingId(column.id)}
                      onDragEnter={() => setOverId(column.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropOn(column.id);
                        setDraggingId(null);
                        setOverId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverId(null);
                      }}
                      className={cn(
                        "border-b border-edge px-4 py-3 text-left text-[0.76rem] font-bold whitespace-nowrap text-dim",
                        draggingId &&
                          overId === column.id &&
                          draggingId !== column.id
                          ? "bg-raise"
                          : undefined,
                      )}
                    >
                      {column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          title="Sort (shift-click to multi-sort)"
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-inherit font-semibold text-dim hover:text-ink",
                            sorted && "text-ink",
                          )}
                        >
                          {flexRender(
                            column.columnDef.header,
                            header.getContext(),
                          )}
                          <span aria-hidden="true">
                            {sorted === "asc"
                              ? "▲"
                              : sorted === "desc"
                                ? "▼"
                                : "↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                id={getRowAnchor?.(row.original)}
                className={cn(
                  onRowClick &&
                    "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ok",
                  isRowHighlighted?.(row.original) &&
                    "bg-ok/[0.07] outline-1 -outline-offset-1 outline-ok/35",
                )}
                onClick={(e) => {
                  if (!onRowClick) return;
                  const t = e.target as HTMLElement;
                  if (t.closest("a,button,input,select,label,summary")) return;
                  onRowClick(row.original);
                }}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!onRowClick || event.target !== event.currentTarget)
                    return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onRowClick(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border-b border-edge2 px-4 py-3.5 align-middle"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                  className="p-8 text-center text-dim"
                >
                  {filtered < total
                    ? "Nothing matches the current search or filters."
                    : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

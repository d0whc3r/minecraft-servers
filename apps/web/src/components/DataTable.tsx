// Generic client-side table built on TanStack Table v9: sortable headers
// (shift-click multi-sorts), a global search input, per-column filters,
// drag-and-drop column reordering and a column visibility menu.
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { cn, inputClass } from "@/components/ui";

// V9 requires features, row models and fn registries to be declared up front;
// string filter fn names ("includesString", "equalsString") only resolve
// against the `filterFns` registry registered here.
const features = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
  },
  // Type-only slot replacing the v8 `ColumnMeta` declaration merge.
  columnMeta: {} as { label?: string },
});

/** Column definition accepted by `DataTable` (carries the table's features). */
export type DataTableColumn<TData extends RowData> = ColumnDef<
  typeof features,
  TData,
  any
>;

/** Toolbar filter bound to a column declared in `columns`. */
export interface TableFilter {
  columnId: string;
  label: string;
  kind: "select" | "text";
  /** Options for kind: "select". */
  options?: Array<{ value: string; label: string }>;
}

interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  filters?: TableFilter[];
  initialSorting?: SortingState;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Called when a row's whitespace is clicked (inner buttons/links excluded). */
  onRowClick?: (row: TData) => void;
}

/** Reads the consumer-friendly label from a column def. */
function columnLabel(column: {
  id: string;
  columnDef: { meta?: { label?: string } };
}): string {
  return column.columnDef.meta?.label ?? column.id;
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  filters = [],
  initialSorting = [],
  searchPlaceholder = "Search…",
  emptyMessage = "No rows.",
  onRowClick,
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

  const visibleIds = () => table.getVisibleLeafColumns().map((c) => c.id);

  // Splice-based reorder, as recommended by the TanStack column-ordering guide.
  const dropOn = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setColumnOrder((prev) => {
      const next = visibleIds();
      next.splice(
        next.indexOf(targetId),
        0,
        next.splice(next.indexOf(draggingId), 1)[0],
      );
      return next;
    });
  };

  const shift = (id: string, delta: -1 | 1) => {
    const current = visibleIds();
    const from = current.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= current.length) return;
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    setColumnOrder(next);
  };

  const rows = table.getRowModel().rows;
  const total = data.length;
  const filtered = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search table"
          className={cn(inputClass, "min-w-[min(240px,100%)] flex-1")}
        />
        {filters.map((f) => {
          const column = table.getColumn(f.columnId);
          if (!column) return null;
          if (f.kind === "select") {
            return (
              <select
                key={f.columnId}
                className={cn(inputClass, "w-auto")}
                value={String(column.getFilterValue() ?? "")}
                onChange={(e) =>
                  column.setFilterValue(e.target.value || undefined)
                }
                aria-label={`Filter by ${f.label}`}
              >
                <option value="">{f.label}: all</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <input
              key={f.columnId}
              type="search"
              value={String(column.getFilterValue() ?? "")}
              onChange={(e) =>
                column.setFilterValue(e.target.value || undefined)
              }
              placeholder={`${f.label}…`}
              aria-label={`Filter by ${f.label}`}
              className={cn(inputClass, "w-44")}
            />
          );
        })}
        <span className="text-sm whitespace-nowrap text-dim" aria-live="polite">
          {filtered === total ? total : `${filtered} of ${total}`}
        </span>
        <details className="relative">
          <summary
            className={cn(
              "inline-flex cursor-pointer list-none items-center rounded-lg border border-edge bg-raise px-2.5 py-1.5 text-[0.82rem] whitespace-nowrap select-none hover:bg-[#243044]",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            Columns ▾
          </summary>
          <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-lg border border-edge bg-panel p-2 shadow-[0_10px_36px_rgba(0,0,0,0.45)]">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/[0.03]"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-1.5 py-1 text-[0.85rem]">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {columnLabel(column)}
                  </label>
                  <button
                    type="button"
                    aria-label={`Move ${columnLabel(column)} left`}
                    className="cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-dim hover:bg-raise hover:text-ink"
                    onClick={() => shift(column.id, -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${columnLabel(column)} right`}
                    className="cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-dim hover:bg-raise hover:text-ink"
                    onClick={() => shift(column.id, 1)}
                  >
                    →
                  </button>
                </div>
              ))}
          </div>
        </details>
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge bg-panel">
        <table className="w-full border-collapse text-[0.92rem] [&>tbody>tr:hover]:bg-white/[0.02] [&>tbody>tr:last-child>td]:border-b-0">
          <thead>
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
                        "border-b border-edge px-4 py-2.5 text-left text-[0.8rem] font-semibold whitespace-nowrap text-dim",
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
                            "inline-flex cursor-pointer items-center gap-1 border-0 bg-none p-0 font-inherit font-semibold text-dim hover:text-ink",
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
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  if (!onRowClick) return;
                  const t = e.target as HTMLElement;
                  if (t.closest("a,button,input,select,label,summary")) return;
                  onRowClick(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border-b border-edge2 px-4 py-2.5 align-middle"
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

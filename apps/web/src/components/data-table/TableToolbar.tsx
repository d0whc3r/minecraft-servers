// Toolbar above the table: global search, optional per-column filters, the
// filtered/total count and the column settings menu.
import type { ColumnOrderState, RowData } from "@tanstack/react-table";
import type { SetStateAction } from "react";
import {
  columnLabel,
  type DataTableInstance,
  type TableFilter,
} from "@/components/data-table/features.js";
import { ColumnSettings } from "@/components/data-table/ColumnSettings.js";
import { cn, inputClass } from "@/components/ui";

interface TableToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  filters: TableFilter[];
  searchPlaceholder: string;
  externalFiltering: boolean;
  globalFilter: string;
  onGlobalFilterChange: (value: SetStateAction<string>) => void;
  onColumnOrderChange: (value: SetStateAction<ColumnOrderState>) => void;
  total: number;
  filtered: number;
}

export function TableToolbar<TData extends RowData>({
  table,
  filters,
  searchPlaceholder,
  externalFiltering,
  globalFilter,
  onGlobalFilterChange,
  onColumnOrderChange,
  total,
  filtered,
}: TableToolbarProps<TData>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5",
        externalFiltering
          ? "justify-end"
          : "rounded-xl border border-edge2 bg-panel/75 p-2.5",
      )}
    >
      {!externalFiltering && (
        <>
          <div className="relative min-w-[min(240px,100%)] flex-1">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-dim stroke-2"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" />
            </svg>
            <input
              type="search"
              name="table-search"
              autoComplete="off"
              value={globalFilter}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className={cn(inputClass, "w-full pl-9")}
            />
          </div>
          {filters.map((f) => {
            const column = table.getColumn(f.columnId);
            if (!column) return null;
            if (f.kind === "select") {
              return (
                <select
                  key={f.columnId}
                  name={`filter-${f.columnId}`}
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
                name={`filter-${f.columnId}`}
                autoComplete="off"
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
        </>
      )}
      <span
        className={cn(
          "rounded-lg px-2.5 py-2 text-[0.78rem] font-semibold whitespace-nowrap text-dim",
          externalFiltering ? "bg-panel" : "bg-raise",
        )}
        aria-live="polite"
      >
        {filtered === total
          ? `${total} ${total === 1 ? "item" : "items"}`
          : `${filtered} of ${total}`}
      </span>
      <ColumnSettings table={table} setColumnOrder={onColumnOrderChange} />
    </div>
  );
}

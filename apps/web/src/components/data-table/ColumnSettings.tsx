// "Columns ▾" menu: per-column visibility checkboxes and manual reordering.
import type { ColumnOrderState } from "@tanstack/react-table";
import type { SetStateAction } from "react";
import type { RowData } from "@tanstack/react-table";
import {
  columnLabel,
  shiftOne,
  type DataTableInstance,
} from "@/components/data-table/features.js";
import { cn } from "@/components/ui";

export function ColumnSettings<TData extends RowData>({
  table,
  setColumnOrder,
}: {
  table: DataTableInstance<TData>;
  setColumnOrder: (value: SetStateAction<ColumnOrderState>) => void;
}) {
  // Splice-free one-slot move, as recommended by the TanStack ordering guide.
  const shift = (id: string, delta: -1 | 1) => {
    const next = shiftOne(
      table.getVisibleLeafColumns().map((c) => c.id),
      id,
      delta,
    );
    if (next) setColumnOrder(next);
  };

  return (
    <details className="relative">
      <summary
        className={cn(
          "inline-flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-edge bg-raise px-3 text-[0.82rem] font-semibold whitespace-nowrap select-none hover:border-[#45594f] hover:bg-[#223029]",
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
  );
}

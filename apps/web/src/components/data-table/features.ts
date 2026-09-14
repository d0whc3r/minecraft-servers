// Shared table feature registry and public types for the DataTable.
// V9 requires features, row models and fn registries to be declared up front;
// string filter fn names ("includesString", "equalsString") only resolve
// against the `filterFns` registry registered here.
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type ColumnOrderState,
  type ReactTable,
  type RowData,
} from "@tanstack/react-table";

export const features = tableFeatures({
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

/** Table instance type handed to DataTable subcomponents. */
export type DataTableInstance<TData extends RowData> = ReactTable<
  typeof features,
  TData
>;

/** Toolbar filter bound to a column declared in `columns`. */
export interface TableFilter {
  columnId: string;
  label: string;
  kind: "select" | "text";
  /** Options for kind: "select". */
  options?: Array<{ value: string; label: string }>;
}

/** Reorders `order` by moving `id` next to `targetId` (splice-insert). */
export function moveToTarget(
  order: string[],
  id: string,
  targetId: string,
): ColumnOrderState {
  const next = [...order];
  next.splice(next.indexOf(targetId), 0, next.splice(next.indexOf(id), 1)[0]);
  return next;
}

/** Reorders `order` by moving `id` one slot; null when already at the edge. */
export function shiftOne(
  order: string[],
  id: string,
  delta: -1 | 1,
): ColumnOrderState | null {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return null;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Reads the consumer-friendly label from a column def. */
export function columnLabel(column: {
  id: string;
  columnDef: { meta?: { label?: string } };
}): string {
  return column.columnDef.meta?.label ?? column.id;
}

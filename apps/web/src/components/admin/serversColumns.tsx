// Column definitions for the admin servers table (server identity, state,
// players and the start/stop/details quick actions).
import type { ServerStatus } from "@/types";
import type { DataTableColumn } from "@/components/data-table";
import { Button, MONO, StateBadge } from "@/components/ui";

export function buildServersColumns({
  disabled,
  onStart,
  onStopRequest,
  onDetails,
}: {
  disabled: boolean;
  onStart: (name: string) => void;
  onStopRequest: (name: string) => void;
  onDetails: (name: string) => void;
}): DataTableColumn<ServerStatus>[] {
  return [
    {
      id: "server",
      header: "Server",
      meta: { label: "Server" },
      accessorFn: (s) => `${s.title} ${s.name} ${s.platform} ${s.mcVersion}`,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-ink hover:text-ok"
            onClick={() => onDetails(row.original.name)}
          >
            {row.original.title}
          </button>
          {row.original.custom && (
            <span
              title="Created from the panel (removable)"
              className="ml-1.5 inline-flex items-center rounded-full border border-edge bg-raise px-1.5 py-0 align-middle text-[0.68rem] uppercase tracking-wide text-dim"
            >
              custom
            </span>
          )}
          <span className="block font-mono text-[0.78rem] text-dim">
            {row.original.name}
          </span>
        </div>
      ),
    },
    {
      id: "state",
      header: "Status",
      meta: { label: "Status" },
      accessorKey: "state",
      filterFn: "equalsString",
      cell: ({ row }) => <StateBadge state={row.original.state} />,
    },
    {
      id: "players",
      header: "Players",
      meta: { label: "Players" },
      accessorFn: (s) => s.players?.online ?? -1,
      cell: ({ row }) => (
        <span className={MONO}>
          {row.original.players
            ? `${row.original.players.online}/${row.original.players.max}`
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { label: "Actions" },
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const s = row.original;
        const isUp = s.state === "running" || s.state === "starting";
        return (
          <div className="flex flex-nowrap gap-1.5">
            {isUp ? (
              <Button
                size="sm"
                disabled={disabled}
                onClick={() => onStopRequest(s.name)}
              >
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={disabled}
                onClick={() => onStart(s.name)}
              >
                Start
              </Button>
            )}
            <Button size="sm" onClick={() => onDetails(s.name)}>
              Details
            </Button>
          </div>
        );
      },
    },
  ];
}

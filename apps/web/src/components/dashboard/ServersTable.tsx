// Table view of the dashboard: sortable columns over the filtered servers.
import { useMemo } from "react";
import type { ServerStatus } from "@/types";
import { formatUptime } from "@/lib/client";
import { adminServerHref } from "@/lib/serverLinks";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { CopyValue, MONO, StateBadge } from "@/components/ui";

/** Sortable/filterable table view of every server (TanStack Table). */
export function ServersTable({
  servers,
  isAdmin,
  onOpen,
}: {
  servers: ServerStatus[];
  isAdmin: boolean;
  onOpen: (s: ServerStatus) => void;
}) {
  const columns = useMemo<DataTableColumn<ServerStatus>[]>(
    () => [
      {
        id: "server",
        header: "Server",
        meta: { label: "Server" },
        accessorFn: (s) => `${s.title} ${s.name}`,
        enableHiding: false,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-2.5">
              {s.favicon && (
                <img
                  className="size-7 rounded-md"
                  src={s.favicon}
                  alt=""
                  width="28"
                  height="28"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(s)}
                    className="block max-w-[26rem] cursor-pointer truncate border-0 bg-transparent p-0 text-left font-semibold text-ink hover:underline hover:underline-offset-3"
                  >
                    {s.title}
                  </button>
                  {isAdmin && (
                    <a
                      href={adminServerHref(s.name)}
                      className="flex-none text-[0.72rem] font-semibold text-ok hover:underline underline-offset-3"
                      aria-label={`Manage ${s.title} in admin`}
                    >
                      Manage <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
                <span className="block font-mono text-[0.78rem] text-dim">
                  {s.name} · MC {s.mcVersion}
                </span>
              </div>
            </div>
          );
        },
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
        id: "tags",
        header: "Tags",
        meta: { label: "Tags" },
        accessorFn: (s) => s.tags.join(" "),
        cell: ({ row }) => <TableTags tags={row.original.tags} />,
      },
      {
        id: "players",
        header: "Players",
        meta: { label: "Players" },
        accessorFn: (s) => s.players?.online ?? -1,
        cell: ({ row }) => {
          const p = row.original.players;
          return (
            <span className={MONO}>{p ? `${p.online}/${p.max}` : "—"}</span>
          );
        },
      },
      {
        id: "uptime",
        header: "Uptime",
        meta: { label: "Uptime" },
        accessorFn: (s) => s.uptimeSec ?? -1,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <span className={MONO}>
              {s.state === "running" || s.state === "starting"
                ? formatUptime(s.uptimeSec)
                : "—"}
            </span>
          );
        },
      },
      {
        id: "connect",
        header: "Connect",
        meta: { label: "Connect" },
        accessorKey: "connect",
        cell: ({ row }) => <CopyValue value={row.original.connect} />,
      },
      {
        id: "memory",
        header: "RAM",
        meta: { label: "RAM" },
        accessorKey: "memory",
        cell: ({ row }) => <span className={MONO}>{row.original.memory}</span>,
      },
      {
        id: "modpack",
        header: "Modpack",
        meta: { label: "Modpack" },
        accessorFn: (s) => s.platform,
        filterFn: "equalsString",
        cell: ({ row }) => {
          const s = row.original;
          return s.modUrl ? (
            <a
              href={s.modUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open the official ${s.platform} page to verify the modpack against your client`}
              className="whitespace-nowrap text-ok hover:underline underline-offset-3"
            >
              {s.platform} <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="text-dim">{s.platform}</span>
          );
        },
      },
    ],
    [isAdmin, onOpen],
  );

  return (
    <section aria-label="Servers">
      <DataTable
        data={servers}
        columns={columns}
        initialSorting={[{ id: "server", desc: false }]}
        emptyMessage={servers.length ? "No servers." : "Loading server status…"}
        onRowClick={onOpen}
        externalFiltering
      />
    </section>
  );
}

function TableTags({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-dim">—</span>;
  const visible = tags.slice(0, 2);
  return (
    <div
      className="flex min-w-32 max-w-48 items-center gap-2"
      title={tags.map((tag) => `#${tag}`).join(", ")}
    >
      <span className="sr-only">Tags: {tags.join(", ")}</span>
      <span
        aria-hidden="true"
        className="min-w-0 truncate font-mono text-[0.72rem] text-dim"
      >
        {visible.join(" · ")}
      </span>
      {tags.length > visible.length && (
        <span
          aria-hidden="true"
          className="inline-flex h-5 flex-none items-center rounded-md bg-ok/10 px-1.5 font-mono text-[0.66rem] font-semibold text-ok"
        >
          +{tags.length - visible.length}
        </span>
      )}
    </div>
  );
}

// Public dashboard: live status of every configured server.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthMe, ServerStatus, StatusResponse } from "@/types";
import { api, formatUptime, startPolling } from "@/lib/client";
import {
  DataTable,
  type DataTableColumn,
  type TableFilter,
} from "@/components/DataTable";
import {
  Button,
  Chip,
  cn,
  CopyValue,
  Field,
  Meter,
  Modal,
  StateBadge,
  StateBar,
  inputClass,
  MONO,
  STATE_LABELS,
} from "@/components/ui";

type Filter = "all" | "running" | "stopped" | "alerts";
type View = "cards" | "table";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["running", "Running"],
  ["stopped", "Stopped"],
  ["alerts", "Alerts"],
];

const VIEW_KEY = "mcpanel.dashboardView";

function initialView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

export default function Dashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>(initialView);
  const [detail, setDetail] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    api<AuthMe>("/api/auth/me")
      .then((me) => setIsAdmin(me.authed))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const data = await api<StatusResponse>("/api/status");
        setStatus(data);
        setError(null);
        const h = historyRef.current;
        h.push(data.summary.playersOnline);
        if (h.length > 120) h.shift();
      } catch (err) {
        setError((err as Error).message);
      }
    };
    return startPolling(refresh, 5000);
  }, []);

  const servers = useMemo(() => {
    let list = status?.servers ?? [];
    if (filter === "running")
      list = list.filter(
        (s) => s.state === "running" || s.state === "starting",
      );
    if (filter === "stopped")
      list = list.filter((s) => s.state === "stopped" || s.state === "missing");
    if (filter === "alerts") list = list.filter((s) => s.state === "unhealthy");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.platform.toLowerCase().includes(q) ||
          s.mcVersion.includes(q),
      );
    }
    // Running first, then alphabetical
    return [...list].sort((a, b) => {
      const rank = (s: ServerStatus) =>
        s.state === "running"
          ? 0
          : s.state === "starting"
            ? 1
            : s.state === "unhealthy"
              ? 2
              : 3;
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });
  }, [status, query, filter]);

  const doAction = async (
    name: string,
    action: "start" | "stop" | "restart",
  ) => {
    setBusy(`${name}:${action}`);
    setActionMsg(null);
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/action/${name}/${action}`,
        { method: "POST", json: {} },
      );
      setActionMsg(res.output);
    } catch (err) {
      setActionMsg(`${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private browsing */
    }
  };

  const summary = status?.summary;
  const history = historyRef.current;

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2 text-[0.9rem]"
        >
          Panel connection lost: {error}. Retrying…
        </div>
      )}
      {actionMsg && (
        <div className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-ok/35 bg-ok/10 px-3.5 py-2 text-[0.9rem]">
          <pre className="m-0 max-h-35 overflow-auto font-mono text-[0.8rem] break-words whitespace-pre-wrap">
            {actionMsg}
          </pre>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={() => setActionMsg(null)}
          >
            ✕
          </Button>
        </div>
      )}

      <section
        aria-label="Overall summary"
        className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-xl border border-edge bg-panel max-sm:[&>*+*]:border-t max-sm:[&>*+*]:border-edge2 [&>*+*]:border-l [&>*+*]:border-edge2 max-sm:[&>*+*]:border-l-0"
      >
        <Stat
          value={summary ? `${summary.running}/${summary.total}` : "…"}
          label="servers running"
        />
        <Stat
          value={summary ? String(summary.playersOnline) : "…"}
          label="players online"
          spark={history.length > 2 ? <Sparkline data={history} /> : null}
        />
        <Stat
          value={summary ? String(summary.unhealthy) : "…"}
          label="health warnings"
        />
        <Stat
          value={
            status
              ? `${Math.max(0, Math.round((Date.now() - status.now) / 1000))}s`
              : "…"
          }
          label="since last update"
        />
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {view === "cards" && (
          <>
            <input
              type="search"
              placeholder="Search by name, modpack, version…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search servers"
              className={cn(inputClass, "min-w-[min(320px,100%)]")}
            />
            <div
              role="tablist"
              aria-label="Filter by status"
              className="inline-flex divide-x divide-edge overflow-hidden rounded-lg border border-edge"
            >
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={cn(
                    "cursor-pointer border-0 px-3.5 py-2 font-sans text-dim",
                    filter === key
                      ? "bg-raise font-semibold text-ink"
                      : "hover:text-ink",
                  )}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        <div
          role="group"
          aria-label="View mode"
          className="ml-auto inline-flex divide-x divide-edge overflow-hidden rounded-lg border border-edge"
        >
          {(["cards", "table"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer border-0 px-3.5 py-2 font-sans text-dim",
                view === v
                  ? "bg-raise font-semibold text-ink"
                  : "hover:text-ink",
              )}
              onClick={() => changeView(v)}
            >
              {v === "cards" ? "Cards" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {view === "cards" ? (
        <section
          aria-label="Servers"
          className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5"
        >
          {servers.map((s) => (
            <ServerCard
              key={s.name}
              server={s}
              isAdmin={isAdmin}
              busy={busy === `${s.name}:start` || busy === `${s.name}:stop`}
              onOpen={() => setDetail(s)}
              onAction={doAction}
            />
          ))}
          {!servers.length && (
            <p className="col-span-full p-8 text-center text-dim">
              {status
                ? "No servers match the current filters."
                : "Loading server status…"}
            </p>
          )}
        </section>
      ) : (
        <ServersTableView servers={status?.servers ?? []} onOpen={setDetail} />
      )}

      {detail && (
        <ServerDetail
          server={detail}
          routerPort={status?.router.port ?? null}
          isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onAction={doAction}
          busy={busy !== null}
        />
      )}
    </>
  );
}

/** Sortable/filterable table view of every server (TanStack Table). */
function ServersTableView({
  servers,
  onOpen,
}: {
  servers: ServerStatus[];
  onOpen: (s: ServerStatus) => void;
}) {
  const platforms = useMemo(
    () => [...new Set(servers.map((s) => s.platform))].sort(),
    [servers],
  );

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
              {s.favicon ? (
                <img
                  className="size-7 rounded-md"
                  src={s.favicon}
                  alt=""
                  width="28"
                  height="28"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-7 flex-none place-items-center rounded-md bg-raise text-[0.95rem]"
                >
                  ⛏
                </span>
              )}
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(s)}
                  className="block max-w-[26rem] cursor-pointer truncate border-0 bg-none p-0 text-left font-semibold text-ink hover:underline hover:underline-offset-3"
                >
                  {s.title}
                </button>
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
              {s.platform} ↗
            </a>
          ) : (
            <span className="text-dim">{s.platform}</span>
          );
        },
      },
    ],
    [onOpen],
  );

  const filters = useMemo<TableFilter[]>(
    () => [
      {
        columnId: "state",
        label: "Status",
        kind: "select",
        options: Object.entries(STATE_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
      {
        columnId: "modpack",
        label: "Platform",
        kind: "select",
        options: platforms.map((p) => ({ value: p, label: p })),
      },
    ],
    [platforms],
  );

  return (
    <section aria-label="Servers">
      <DataTable
        data={servers}
        columns={columns}
        filters={filters}
        initialSorting={[{ id: "server", desc: false }]}
        searchPlaceholder="Search by name, modpack, version…"
        emptyMessage={servers.length ? "No servers." : "Loading server status…"}
        onRowClick={onOpen}
      />
    </section>
  );
}

function Stat({
  value,
  label,
  spark,
}: {
  value: string;
  label: string;
  spark?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-0.5 px-5 py-4">
      <span className="font-mono text-[1.7rem] leading-[1.1] font-semibold">
        {value}
      </span>
      <span className="text-[0.88rem] text-dim">{label}</span>
      {spark}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 120;
  const h = 28;
  const max = Math.max(1, ...data);
  const points = data
    .map(
      (v, i) =>
        `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`,
    )
    .join(" ");
  return (
    <svg
      className="absolute right-3.5 bottom-3.5 h-[26px] w-[110px] text-ok opacity-80 max-sm:hidden"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ServerCard({
  server: s,
  isAdmin,
  busy,
  onOpen,
  onAction,
}: {
  server: ServerStatus;
  isAdmin: boolean;
  busy: boolean;
  onOpen: () => void;
  onAction: (name: string, action: "start" | "stop" | "restart") => void;
}) {
  const players = s.players;
  return (
    <article className="relative flex animate-rise flex-col gap-2.5 overflow-hidden rounded-xl border border-edge bg-panel py-3.5 pr-4 pl-[18px] motion-reduce:animate-none">
      <StateBar state={s.state} />
      <header className="flex items-start gap-2.5">
        {s.favicon ? (
          <img
            className="mt-1 size-7 rounded-md"
            src={s.favicon}
            alt=""
            width="28"
            height="28"
          />
        ) : (
          <span
            aria-hidden="true"
            className="mt-1 grid size-7 place-items-center rounded-md bg-raise text-[0.95rem]"
          >
            ⛏
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[1.02rem] leading-tight">
            <button
              type="button"
              onClick={onOpen}
              className="cursor-pointer bg-none p-0 text-left font-inherit text-ink hover:underline hover:underline-offset-3"
            >
              {s.title}
            </button>
          </h3>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 overflow-hidden font-mono text-[0.8rem] text-ellipsis whitespace-nowrap text-dim">
            <span className="min-w-0 overflow-hidden text-ellipsis">
              {s.name} ·
            </span>
            {s.modUrl ? (
              <a
                href={s.modUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open the official ${s.platform} page to verify the modpack against your client`}
                className="inline-flex flex-none items-center gap-0.5 rounded-full border border-ok/50 bg-ok/10 px-2 py-px font-semibold text-ok transition-colors hover:bg-ok/25"
              >
                {s.platform} ↗
              </a>
            ) : (
              <span className="flex-none">{s.platform}</span>
            )}
            <span>· {s.mcVersion}</span>
          </span>
        </div>
        <StateBadge state={s.state} />
      </header>

      <div className="flex flex-col gap-1.5">
        <KeyRow label="Players">
          <span className={MONO}>
            {players
              ? `${players.online}/${players.max}`
              : s.state === "running"
                ? "—"
                : "0"}
          </span>
        </KeyRow>
        <Meter value={players?.online ?? 0} max={players?.max ?? 1} />
        <KeyRow label="Uptime">
          <span className={MONO}>
            {s.state === "running" || s.state === "starting"
              ? formatUptime(s.uptimeSec)
              : "—"}
          </span>
        </KeyRow>
        <KeyRow label="Connect">
          <CopyValue value={s.connect} />
        </KeyRow>
        <KeyRow label="RAM">
          <span className={MONO}>{s.memory}</span>
        </KeyRow>
        {s.state === "running" && s.cpuPerc !== null && (
          <KeyRow label="CPU · Mem">
            <span className={MONO}>
              {s.cpuPerc.toFixed(1)}% · {s.memUsed ?? "—"}
            </span>
          </KeyRow>
        )}
      </div>

      <footer className="mt-auto flex gap-2">
        {isAdmin &&
          (s.state === "running" || s.state === "starting" ? (
            <Button disabled={busy} onClick={() => onAction(s.name, "stop")}>
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => onAction(s.name, "start")}
            >
              Start
            </Button>
          ))}
        <Button onClick={onOpen}>Details</Button>
      </footer>
    </article>
  );
}

function KeyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-[0.88rem]">
      <span className="text-dim">{label}</span>
      {children}
    </div>
  );
}

/** Full player-facing address: "<server>.<domain>" plus the router port. */
function connectAddress(connect: string, routerPort: number | null): string {
  return routerPort ? `${connect}:${routerPort}` : connect;
}

function ServerDetail({
  server: s,
  routerPort,
  isAdmin,
  onClose,
  onAction,
  busy,
}: {
  server: ServerStatus;
  routerPort: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onAction: (name: string, action: "start" | "stop" | "restart") => void;
  busy: boolean;
}) {
  return (
    <Modal title={s.title} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div>
          <p className="m-0">
            <StateBadge state={s.state} />
            {s.statusText && (
              <span className="text-dim"> · {s.statusText}</span>
            )}
          </p>
          {s.description && <p className="text-dim">{s.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.modUrl ? (
              <a
                href={s.modUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the official modpack page to verify the version your client needs"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ok/50 bg-ok/10 px-3.5 py-2 text-sm font-semibold text-ok transition-colors hover:bg-ok/25"
              >
                Official {s.platform} page ↗
              </a>
            ) : (
              <Chip>{s.platform}</Chip>
            )}
            <Chip>MC {s.mcVersion}</Chip>
            <Chip>{s.memory} RAM</Chip>
            <Chip tone="mono">{s.connect}</Chip>
            {s.pingMs !== null && <Chip>{s.pingMs} ms</Chip>}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <Field label="Players online">
            {s.players && s.players.names.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {s.players.names.map((n) => (
                  <Chip key={n}>{n}</Chip>
                ))}
              </div>
            ) : (
              <span className={MONO}>
                {s.players ? `${s.players.online}/${s.players.max}` : "—"}
              </span>
            )}
          </Field>
          <Field label="MOTD">
            <span className={MONO}>{s.motd ?? "—"}</span>
          </Field>
          <Field label="Reported version">
            <span className={MONO}>{s.versionName ?? s.mcVersion}</span>
          </Field>
        </div>

        <Field label="Connect address (host:port via mc-router)">
          <CopyValue value={connectAddress(s.connect, routerPort)} />
        </Field>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {s.state === "running" || s.state === "starting" ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() => onAction(s.name, "stop")}
                >
                  Stop server
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => onAction(s.name, "restart")}
                >
                  Restart
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => onAction(s.name, "start")}
              >
                Start server
              </Button>
            )}
            <Button onClick={() => (location.href = "/admin")}>
              Manage in admin
            </Button>
          </div>
        )}
        <p className="m-0 text-sm text-dim">
          For more actions (logs, console, backups), use the admin area.
        </p>
      </div>
    </Modal>
  );
}

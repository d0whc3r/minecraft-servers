// Public dashboard: live status of every configured server.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthMe, ServerStatus, StatusResponse } from "@/types";
import { api, formatUptime, startPolling } from "@/lib/client";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { ServerDetailsModal } from "@/components/ServerDetailsModal";
import {
  Button,
  buttonClass,
  cn,
  CountedFilterGroup,
  CopyValue,
  FilterSearch,
  StateBadge,
  StateBar,
  MONO,
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
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

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  // Category tags across every server, most used first: drives the chip row.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of status?.servers ?? [])
      for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort(
      ([tagA, countA], [tagB, countB]) =>
        countB - countA || tagA.localeCompare(tagB),
    );
  }, [status]);

  const servers = useMemo(() => {
    let list = status?.servers ?? [];
    if (filter === "running")
      list = list.filter(
        (s) => s.state === "running" || s.state === "starting",
      );
    if (filter === "stopped")
      list = list.filter((s) => s.state === "stopped" || s.state === "missing");
    if (filter === "alerts") list = list.filter((s) => s.state === "unhealthy");
    if (selectedTags.length)
      list = list.filter((s) => s.tags.some((t) => selectedTags.includes(t)));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.platform.toLowerCase().includes(q) ||
          s.mcVersion.includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.includes(q)),
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
  }, [status, query, filter, selectedTags]);

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
  const allServers = status?.servers ?? [];
  const filterCounts: Record<Filter, number> = {
    all: allServers.length,
    running: allServers.filter(
      (server) => server.state === "running" || server.state === "starting",
    ).length,
    stopped: allServers.filter(
      (server) => server.state === "stopped" || server.state === "missing",
    ).length,
    alerts: allServers.filter((server) => server.state === "unhealthy").length,
  };
  const visibleTags = showAllTags
    ? allTags
    : allTags.filter(
        ([tag], index) => index < 10 || selectedTags.includes(tag),
      );

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

      <section className="page-heading" aria-labelledby="dashboard-title">
        <div>
          <h1 id="dashboard-title">Server overview</h1>
          <p>
            Check availability, player activity and connection details across
            your Minecraft worlds.
          </p>
        </div>
        <span className="live-label" aria-live="polite">
          <span
            className={cn(
              "size-2 rounded-full",
              error ? "bg-bad" : status ? "bg-ok" : "animate-pulse bg-idle",
            )}
          />
          {error
            ? "Connection interrupted"
            : status
              ? "Live · refreshes every 5s"
              : "Connecting…"}
        </span>
      </section>

      <section
        aria-label="Overall summary"
        className="mb-8 grid grid-cols-2 overflow-hidden border-y border-edge bg-panel/70 md:grid-cols-4 [&>*+*]:border-l [&>*+*]:border-edge2 [&>*:nth-child(odd)]:border-l-0 [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-edge2 md:[&>*:nth-child(3)]:border-l md:[&>*:nth-child(n+3)]:border-t-0"
      >
        <Stat
          value={summary ? `${summary.running}/${summary.total}` : "…"}
          label="Servers running"
          detail={
            summary
              ? `${summary.total - summary.running} currently offline`
              : "Checking availability"
          }
          tone="ok"
        />
        <Stat
          value={summary ? String(summary.playersOnline) : "…"}
          label="Players online"
          detail={
            summary
              ? `Capacity for ${summary.playersMax}`
              : "Reading player count"
          }
          spark={history.length > 2 ? <Sparkline data={history} /> : null}
        />
        <Stat
          value={summary ? String(summary.unhealthy) : "…"}
          label="Health warnings"
          detail={
            summary?.unhealthy
              ? "Needs your attention"
              : "Everything looks stable"
          }
          tone={summary?.unhealthy ? "bad" : "neutral"}
        />
        <Stat
          value={
            status
              ? `${Math.max(0, Math.round((Date.now() - status.now) / 1000))}s`
              : "…"
          }
          label="Last update"
          detail="Automatic live monitoring"
        />
      </section>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-[1.18rem] font-bold tracking-[-0.02em]">
            Your servers
          </h2>
          <p className="mt-1 mb-0 text-[0.84rem] text-dim">
            {servers.length} shown
          </p>
        </div>
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex rounded-xl border border-edge bg-panel p-1"
        >
          {(["cards", "table"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 px-2.5 font-sans text-[0.8rem] font-semibold text-dim",
                view === v
                  ? "bg-raise text-ink"
                  : "bg-transparent hover:text-ink",
              )}
              onClick={() => changeView(v)}
            >
              <ViewIcon view={v} />
              <span className="max-sm:sr-only">
                {v === "cards" ? "Cards" : "Table"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-edge2 bg-panel/75 p-2.5">
        <FilterSearch
          name="server-search"
          placeholder="Search servers, modpacks, tags or versions"
          value={query}
          onChange={setQuery}
          label="Search servers"
        />
        <CountedFilterGroup
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map(([value, label]) => ({
            value,
            label,
            count: filterCounts[value],
          }))}
        />
      </div>

      {allTags.length > 0 && (
        <div
          role="group"
          aria-label="Filter by tags"
          className="mb-5 flex flex-wrap items-center gap-1.5"
        >
          {visibleTags.map(([tag, count]) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-mono text-[0.74rem]",
                  active
                    ? "border-ok/50 bg-ok/12 font-semibold text-ok"
                    : "border-edge bg-panel/75 text-dim hover:border-edge2 hover:text-ink",
                )}
                onClick={() => toggleTag(tag)}
              >
                #{tag}
                <span className="text-[0.68rem] opacity-75">{count}</span>
              </button>
            );
          })}
          {allTags.length > 10 && (
            <button
              type="button"
              aria-expanded={showAllTags}
              className="inline-flex min-h-7 cursor-pointer items-center rounded-full border border-edge bg-transparent px-2.5 text-[0.74rem] font-semibold text-dim hover:text-ink"
              onClick={() => setShowAllTags((current) => !current)}
            >
              {showAllTags
                ? "Fewer tags"
                : `More tags (${allTags.length - 10})`}
            </button>
          )}
          {selectedTags.length > 0 && (
            <button
              type="button"
              className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[0.78rem] font-semibold text-dim underline underline-offset-3 hover:text-ink"
              onClick={() => setSelectedTags([])}
            >
              Clear tags
            </button>
          )}
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {servers.length} servers match the current filters.
      </div>

      {view === "cards" ? (
        <section
          aria-label="Servers"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(350px,100%),1fr))] gap-4"
        >
          {servers.map((s) => (
            <ServerCard
              key={s.name}
              server={s}
              isAdmin={isAdmin}
              busy={busy === `${s.name}:start` || busy === `${s.name}:stop`}
              activeTags={selectedTags}
              onToggleTag={toggleTag}
              onOpen={() => setDetail(s)}
              onAction={doAction}
            />
          ))}
          {!servers.length && (
            <div className="col-span-full grid min-h-56 place-items-center rounded-2xl border border-dashed border-edge bg-panel/40 p-8 text-center">
              <div>
                <span
                  className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-raise text-xl"
                  aria-hidden="true"
                >
                  ⌕
                </span>
                <h3 className="m-0 text-base">
                  {status ? "No matching servers" : "Loading server status…"}
                </h3>
                {status && (
                  <p className="mt-1.5 mb-0 text-sm text-dim">
                    Try another search or clear the status filter.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <ServersTableView
          servers={servers}
          isAdmin={isAdmin}
          onOpen={setDetail}
        />
      )}

      {detail && (
        <ServerDetailsModal
          server={detail}
          routerPort={status?.router.port ?? null}
          onClose={() => setDetail(null)}
          adminHref={isAdmin ? adminServerHref(detail.name) : undefined}
          actions={
            isAdmin ? (
              detail.state === "running" || detail.state === "starting" ? (
                <>
                  <Button
                    disabled={busy !== null}
                    onClick={() => doAction(detail.name, "stop")}
                  >
                    Stop server
                  </Button>
                  <Button
                    disabled={busy !== null}
                    onClick={() => doAction(detail.name, "restart")}
                  >
                    Restart
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => doAction(detail.name, "start")}
                >
                  Start server
                </Button>
              )
            ) : undefined
          }
        />
      )}
    </>
  );
}

/** Sortable/filterable table view of every server (TanStack Table). */
function ServersTableView({
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
                      Manage ↗
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
              {s.platform} ↗
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

function Stat({
  value,
  label,
  detail,
  spark,
  tone = "neutral",
}: {
  value: string;
  label: string;
  detail: string;
  spark?: ReactNode;
  tone?: "ok" | "bad" | "neutral";
}) {
  return (
    <div className="relative flex min-h-32 flex-col justify-center gap-1 px-5 py-5">
      <span className="text-[0.78rem] font-semibold text-dim">{label}</span>
      <span
        className={cn(
          "font-mono text-[2rem] leading-none font-semibold tracking-[-0.04em]",
          tone === "ok" && "text-ok",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[0.75rem] text-dim">{detail}</span>
      {spark}
    </div>
  );
}

function ViewIcon({ view }: { view: View }) {
  return view === "cards" ? (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M1 2h14v3H1zm0 4.5h14v3H1zM1 11h14v3H1z" />
    </svg>
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
  activeTags,
  onToggleTag,
  onOpen,
  onAction,
}: {
  server: ServerStatus;
  isAdmin: boolean;
  busy: boolean;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onOpen: () => void;
  onAction: (name: string, action: "start" | "stop" | "restart") => void;
}) {
  const players = s.players;
  return (
    <article className="group relative flex animate-rise flex-col gap-4 overflow-hidden rounded-2xl border border-edge bg-panel px-5 pt-5 pb-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#405249] motion-reduce:animate-none motion-reduce:transform-none">
      <StateBar state={s.state} />
      <header className="flex items-start gap-3.5">
        {s.favicon && (
          <img
            className="size-11 rounded-xl border border-edge bg-raise [image-rendering:pixelated]"
            src={s.favicon}
            alt=""
            width="44"
            height="44"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[1.05rem] leading-snug font-bold tracking-[-0.015em]">
            <button
              type="button"
              onClick={onOpen}
              className="cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-ink hover:text-ok"
            >
              {s.title}
            </button>
          </h3>
          <span className="mt-0.5 block truncate font-mono text-[0.74rem] text-dim">
            {s.name}
          </span>
        </div>
        <StateBadge state={s.state} />
      </header>

      <div className="flex flex-wrap items-center gap-2 text-[0.77rem] text-dim">
        {s.modUrl ? (
          <a
            href={s.modUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open the official ${s.platform} page`}
            className="rounded-md bg-ok/10 px-2 py-1 font-semibold text-ok no-underline hover:bg-ok/18"
          >
            {s.platform} ↗
          </a>
        ) : (
          <span className="rounded-md bg-raise px-2 py-1">{s.platform}</span>
        )}
        <span>MC {s.mcVersion}</span>
      </div>

      {s.tags.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {s.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTags.includes(tag)}
              title={`Show every ${tag} server`}
              className={cn(
                "cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[0.7rem]",
                activeTags.includes(tag)
                  ? "border-ok/50 bg-ok/12 text-ok"
                  : "border-edge bg-panel text-dim hover:text-ink",
              )}
              onClick={() => onToggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
          {s.tags.length > 3 && (
            <span
              className="inline-flex items-center rounded-full border border-edge px-2 py-0.5 font-mono text-[0.7rem] text-dim"
              title={s.tags
                .slice(3)
                .map((tag) => `#${tag}`)
                .join(", ")}
            >
              +{s.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="rounded-xl border border-edge2 bg-base/55 px-3 py-2.5">
        <span className="mb-1 block text-[0.7rem] font-semibold text-dim">
          Connect address
        </span>
        <CopyValue value={s.connect} />
      </div>

      <div className="grid grid-cols-3 divide-x divide-edge2 border-y border-edge2 py-3">
        <Metric
          label="Players"
          value={
            players
              ? `${players.online}/${players.max}`
              : s.state === "running"
                ? "—"
                : "0"
          }
        />
        <Metric
          label="Uptime"
          value={
            s.state === "running" || s.state === "starting"
              ? formatUptime(s.uptimeSec)
              : "—"
          }
        />
        <Metric label="Memory" value={s.memUsed ?? s.memory} />
      </div>

      <footer className="mt-auto flex items-center gap-2">
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
        {isAdmin && (
          <a
            href={adminServerHref(s.name)}
            className={buttonClass("ghost")}
            aria-label={`Manage ${s.title} in admin`}
          >
            Manage
          </a>
        )}
        <Button className="ml-auto" variant="ghost" onClick={onOpen}>
          View details
        </Button>
      </footer>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <span className="block text-[0.68rem] font-semibold text-dim">
        {label}
      </span>
      <span className="mt-1 block truncate font-mono text-[0.82rem] font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

function adminServerHref(name: string): string {
  const encodedName = encodeURIComponent(name);
  return `/admin?server=${encodedName}#admin-server-${encodedName}`;
}

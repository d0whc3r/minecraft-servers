// Admin area: login gate + server actions, live logs, RCON console, backups, system.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  AuthMe,
  BackupFile,
  ServerStatus,
  StatusResponse,
  SystemInfo,
} from "@/types";
import {
  api,
  formatBytes,
  formatUptime,
  startPolling,
  timeAgo,
} from "@/lib/client";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { ServerDetailsModal } from "@/components/ServerDetailsModal";
import {
  Button,
  buttonClass,
  cn,
  CountedFilterGroup,
  Field,
  FilterSearch,
  inputClass,
  Meter,
  Modal,
  MONO,
  StateBadge,
  useToasts,
} from "@/components/ui";

import { CreateServerModal } from "@/components/CreateServerModal";

type Tab = "servers" | "backups" | "system";
type AdminServerFilter = "all" | "running" | "stopped" | "alerts";
type BackupFilter = "all" | "checksum" | "unchecked";

const ADMIN_TABS: Tab[] = ["servers", "backups", "system"];
const ADMIN_SERVER_FILTERS: Array<[AdminServerFilter, string]> = [
  ["all", "All"],
  ["running", "Running"],
  ["stopped", "Stopped"],
  ["alerts", "Alerts"],
];
const BACKUP_FILTERS: Array<[BackupFilter, string]> = [
  ["all", "All"],
  ["checksum", "Checksum"],
  ["unchecked", "No checksum"],
];

export default function AdminApp() {
  const [me, setMe] = useState<AuthMe | null>(null);
  const { push, list: toasts } = useToasts();

  useEffect(() => {
    api<AuthMe>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe({ authed: false, user: null, publicView: true }));
  }, []);

  if (!me) return <p className="p-8 text-center text-dim">Loading…</p>;
  if (!me.authed)
    return (
      <Login
        onDone={() => setMe({ authed: true, user: "admin", publicView: true })}
      />
    );
  return (
    <>
      <AdminTabs
        onLogout={async () => {
          await api("/api/auth/logout", { method: "POST", json: {} });
          setMe({ authed: false, user: null, publicView: true });
        }}
        push={push}
      />
      {toasts}
    </>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        json: { user, password },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto mt-[clamp(1rem,7vh,5rem)] grid w-full max-w-[860px] overflow-hidden rounded-3xl border border-edge bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.22)] md:grid-cols-[1.05fr_1fr]">
      <div className="relative flex min-h-105 flex-col justify-between overflow-hidden border-r border-edge2 bg-raise/55 p-8 max-md:min-h-64 max-md:border-r-0 max-md:border-b">
        <div
          aria-hidden="true"
          className="absolute -top-14 -right-12 size-48 rotate-12 border border-ok/10 bg-ok/[0.035] shadow-[0_0_0_24px_rgba(105,221,160,0.02),0_0_0_48px_rgba(105,221,160,0.015)]"
        />
        <span className="grid size-12 place-items-center rounded-2xl border border-ok/25 bg-ok/10 text-ok">
          <svg
            viewBox="0 0 24 24"
            className="size-6 fill-none stroke-current stroke-[1.6]"
            aria-hidden="true"
          >
            <path d="M12 3 5 6v5.5c0 4.4 2.7 7.4 7 9.5 4.3-2.1 7-5.1 7-9.5V6l-7-3Z" />
            <path d="M9.3 11.2V9.8a2.7 2.7 0 0 1 5.4 0v1.4M8.5 11.2h7v5h-7z" />
          </svg>
        </span>
        <div className="relative">
          <h1 className="m-0 max-w-xs text-[clamp(1.8rem,4vw,2.55rem)] leading-[1.08] font-bold tracking-[-0.045em]">
            Your control room is protected.
          </h1>
          <p className="mt-3 mb-0 max-w-sm leading-relaxed text-dim">
            Sign in to start and stop servers, run console commands, and manage
            backups.
          </p>
        </div>
      </div>
      <form
        className="flex flex-col justify-center gap-4 p-8 max-sm:p-5"
        onSubmit={submit}
      >
        <div className="mb-2">
          <h2 className="m-0 text-xl font-bold tracking-[-0.025em]">
            Admin sign in
          </h2>
          <p className="mt-1.5 mb-0 text-sm text-dim">
            Use your panel credentials to continue.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="m-0 rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2 text-[0.9rem]"
          >
            {error}
          </p>
        )}
        <Field label="Username">
          <input
            className={inputClass}
            name="username"
            spellCheck={false}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        {/* Not Field(): a <label> cannot wrap the show-password button. */}
        <div className="flex flex-col gap-1 text-[0.85rem] text-dim">
          <label htmlFor="admin-password" className="font-semibold">
            Password
          </label>
          <div className="relative">
            <input
              id="admin-password"
              className={cn(inputClass, "w-full pr-16")}
              name="password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-pressed={showPass}
              aria-label={showPass ? "Hide credentials" : "Show credentials"}
              className="absolute inset-y-0 right-1.5 my-auto h-7 cursor-pointer rounded-md border-0 bg-transparent px-2 font-sans text-[0.78rem] font-semibold text-dim transition-colors hover:bg-raise hover:text-ink"
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <Button
          className="mt-1 w-full"
          variant="primary"
          type="submit"
          disabled={sending}
        >
          {sending ? "Checking…" : "Sign in"}
        </Button>
      </form>
    </section>
  );
}

function AdminTabs({
  onLogout,
  push,
}: {
  onLogout: () => void;
  push: ReturnType<typeof useToasts>["push"];
}) {
  const [tab, setTab] = useState<Tab>(() =>
    typeof location !== "undefined" &&
    (location.hash === "#backups" || location.hash === "#copias")
      ? "backups"
      : typeof location !== "undefined" && location.hash === "#system"
        ? "system"
        : "servers",
  );

  const selectTab = (next: Tab) => {
    setTab(next);
    history.replaceState(
      null,
      "",
      next === "servers" ? location.pathname : `#${next}`,
    );
  };

  return (
    <>
      <section className="page-heading" aria-labelledby="admin-title">
        <div>
          <h1 id="admin-title">Control room</h1>
          <p>
            Manage server lifecycle, backups and host resources from one place.
          </p>
        </div>
        <Button variant="ghost" onClick={onLogout}>
          Sign out
        </Button>
      </section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-edge2">
        <div role="tablist" aria-label="Admin sections" className="flex gap-1">
          {ADMIN_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`admin-${t}-tab`}
              aria-controls={`admin-${t}-panel`}
              aria-selected={tab === t}
              className={cn(
                "relative min-h-11 cursor-pointer border-0 bg-transparent px-4 font-sans text-sm font-semibold text-dim after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent",
                tab === t ? "text-ink after:bg-ok" : "hover:text-ink",
              )}
              onClick={() => selectTab(t)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next =
                  ADMIN_TABS[
                    (ADMIN_TABS.indexOf(t) + offset + ADMIN_TABS.length) %
                      ADMIN_TABS.length
                  ];
                selectTab(next);
                requestAnimationFrame(() =>
                  document.getElementById(`admin-${next}-tab`)?.focus(),
                );
              }}
            >
              {t === "servers"
                ? "Servers"
                : t === "backups"
                  ? "Backups"
                  : "System"}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`admin-${tab}-panel`}
        aria-labelledby={`admin-${tab}-tab`}
      >
        {tab === "servers" && <ServersTab push={push} />}
        {tab === "backups" && <BackupsTab push={push} />}
        {tab === "system" && <SystemTab />}
      </div>
    </>
  );
}

type Push = ReturnType<typeof useToasts>["push"];

function ServersTab({ push }: { push: Push }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [targetServer, setTargetServer] = useState<string | null>(() => {
    if (typeof location === "undefined") return null;
    return new URLSearchParams(location.search).get("server");
  });
  const [query, setQuery] = useState(() => targetServer ?? "");
  const [serverFilter, setServerFilter] = useState<AdminServerFilter>("all");
  const [platformFilter, setPlatformFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [detailOf, setDetailOf] = useState<string | null>(null);
  const [logsOf, setLogsOf] = useState<ServerStatus | null>(null);
  const [rconOf, setRconOf] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<{
    name: string;
    action: "stop" | "restart" | "backup" | "delete";
  } | null>(null);

  useEffect(() => {
    return startPolling(async () => {
      try {
        setStatus(await api<StatusResponse>("/api/status"));
      } catch {
        /* transient */
      }
    }, 5000);
  }, []);

  const run = useCallback(
    async (name: string, action: "start" | "stop" | "restart" | "backup") => {
      setBusy(`${name}:${action}`);
      setConfirming(null);
      try {
        const res = await api<{ ok: boolean; output: string }>(
          `/api/action/${name}/${action}`,
          { method: "POST", json: {} },
        );
        push(
          res.ok ? "ok" : "err",
          `${action} ${name}: ${res.ok ? "done" : "failed"}`,
          res.output,
        );
      } catch (err) {
        push("err", `${action} ${name}: error`, (err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [push],
  );

  const remove = useCallback(
    async (name: string) => {
      setBusy(`${name}:delete`);
      setConfirming(null);
      try {
        await api(`/api/servers/${name}`, { method: "DELETE" });
        push(
          "ok",
          `Removed ${name}`,
          "Config deleted. World data and backups on disk are kept.",
        );
      } catch (err) {
        push("err", `Remove ${name}: error`, (err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [push],
  );

  // Create modal hand-off: fire the normal start action once the config exists.
  const created = useCallback(
    async (name: string, start: boolean) => {
      setCreating(false);
      push("ok", `Created ${name}`, "It will appear in the table momentarily.");
      if (start) await run(name, "start");
    },
    [push, run],
  );

  const allServers = useMemo(
    () =>
      [...(status?.servers ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [status],
  );

  const platforms = useMemo(
    () =>
      [...new Set(allServers.map((server) => server.platform))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allServers],
  );

  const tags = useMemo(
    () =>
      [...new Set(allServers.flatMap((server) => server.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allServers],
  );
  const detailServer = detailOf
    ? (allServers.find((server) => server.name === detailOf) ?? null)
    : null;

  const servers = useMemo(() => {
    let list = allServers;
    if (targetServer)
      list = list.filter((server) => server.name === targetServer);
    if (serverFilter === "running")
      list = list.filter(
        (server) => server.state === "running" || server.state === "starting",
      );
    if (serverFilter === "stopped")
      list = list.filter(
        (server) => server.state === "stopped" || server.state === "missing",
      );
    if (serverFilter === "alerts")
      list = list.filter((server) => server.state === "unhealthy");
    if (platformFilter)
      list = list.filter((server) => server.platform === platformFilter);
    if (tagFilter)
      list = list.filter((server) => server.tags.includes(tagFilter));

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery)
      list = list.filter((server) =>
        [
          server.name,
          server.title,
          server.platform,
          server.mcVersion,
          server.description,
          ...server.tags,
        ].some((value) => value.toLowerCase().includes(normalizedQuery)),
      );
    return list;
  }, [
    allServers,
    platformFilter,
    query,
    serverFilter,
    tagFilter,
    targetServer,
  ]);

  const filterCounts: Record<AdminServerFilter, number> = {
    all: allServers.length,
    running: allServers.filter(
      (server) => server.state === "running" || server.state === "starting",
    ).length,
    stopped: allServers.filter(
      (server) => server.state === "stopped" || server.state === "missing",
    ).length,
    alerts: allServers.filter((server) => server.state === "unhealthy").length,
  };
  const hasActiveFilters =
    query.trim() !== "" ||
    serverFilter !== "all" ||
    platformFilter !== "" ||
    tagFilter !== "";

  useEffect(() => {
    if (
      !targetServer ||
      !allServers.some((server) => server.name === targetServer)
    )
      return;
    requestAnimationFrame(() =>
      document
        .getElementById(`admin-server-${targetServer}`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  }, [allServers, targetServer]);

  const clearTargetServer = () => {
    setTargetServer(null);
    const url = new URL(location.href);
    url.searchParams.delete("server");
    if (url.hash.startsWith("#admin-server-")) url.hash = "";
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const columns = useMemo<DataTableColumn<ServerStatus>[]>(
    () => [
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
              onClick={() => setDetailOf(row.original.name)}
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
          return (
            <div className="flex flex-nowrap gap-1.5">
              {s.state === "running" || s.state === "starting" ? (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    setConfirming({ name: s.name, action: "stop" })
                  }
                >
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => run(s.name, "start")}
                >
                  Start
                </Button>
              )}
              <Button size="sm" onClick={() => setDetailOf(s.name)}>
                Details
              </Button>
            </div>
          );
        },
      },
    ],
    [busy, run],
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.1rem] font-bold tracking-[-0.02em]">
            Server management
          </h2>
          <p className="mt-1 mb-0 text-[0.84rem] text-dim">
            Configurations are stored on disk and survive panel restarts.
          </p>
        </div>
        <Button
          aria-label="+ New server"
          variant="primary"
          disabled={busy !== null}
          onClick={() => setCreating(true)}
        >
          <span aria-hidden="true">＋</span> New server
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-edge2 bg-panel/75 p-2.5">
        <FilterSearch
          name="admin-server-search"
          placeholder="Search servers, versions, platforms or tags"
          value={query}
          onChange={(value) => {
            setQuery(value);
            if (value !== targetServer) clearTargetServer();
          }}
          label="Search admin servers"
        />
        <CountedFilterGroup
          label="Filter admin servers by status"
          value={serverFilter}
          onChange={setServerFilter}
          options={ADMIN_SERVER_FILTERS.map(([value, label]) => ({
            value,
            label,
            count: filterCounts[value],
          }))}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          className={cn(inputClass, "w-auto min-w-44")}
          value={platformFilter}
          onChange={(event) => setPlatformFilter(event.target.value)}
          aria-label="Filter admin servers by platform"
        >
          <option value="">Platform: all</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
        <select
          className={cn(inputClass, "w-auto min-w-44")}
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          aria-label="Filter admin servers by tag"
        >
          <option value="">Tag: all</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent px-1 py-2 text-[0.78rem] font-semibold text-dim underline underline-offset-3 hover:text-ink"
            onClick={() => {
              setQuery("");
              clearTargetServer();
              setServerFilter("all");
              setPlatformFilter("");
              setTagFilter("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {servers.length} servers match the current admin filters.
      </div>

      <DataTable
        data={servers}
        columns={columns}
        initialSorting={[{ id: "server", desc: false }]}
        externalFiltering
        getRowAnchor={(server) => `admin-server-${server.name}`}
        isRowHighlighted={(server) => server.name === targetServer}
        onRowClick={(server) => setDetailOf(server.name)}
        emptyMessage={
          !status
            ? "Loading server status…"
            : hasActiveFilters
              ? "No servers match the current filters."
              : "No servers are configured."
        }
      />

      {detailServer && (
        <ServerDetailsModal
          server={detailServer}
          routerPort={status?.router.port ?? null}
          onClose={() => setDetailOf(null)}
          actions={
            <>
              {detailServer.state === "running" ||
              detailServer.state === "starting" ? (
                <Button
                  disabled={busy !== null}
                  onClick={() => {
                    setDetailOf(null);
                    setConfirming({
                      name: detailServer.name,
                      action: "stop",
                    });
                  }}
                >
                  Stop server
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => run(detailServer.name, "start")}
                >
                  Start server
                </Button>
              )}
              <Button
                disabled={
                  busy !== null ||
                  detailServer.state === "stopped" ||
                  detailServer.state === "missing"
                }
                onClick={() => {
                  setDetailOf(null);
                  setConfirming({
                    name: detailServer.name,
                    action: "restart",
                  });
                }}
              >
                Restart
              </Button>
              <Button
                disabled={
                  busy !== null ||
                  detailServer.state === "stopped" ||
                  detailServer.state === "missing"
                }
                onClick={() => {
                  setDetailOf(null);
                  setConfirming({
                    name: detailServer.name,
                    action: "backup",
                  });
                }}
              >
                Back up
              </Button>
              <Button
                onClick={() => {
                  setDetailOf(null);
                  setLogsOf(detailServer);
                }}
              >
                Logs
              </Button>
              <Button
                onClick={() => {
                  setDetailOf(null);
                  setRconOf(detailServer);
                }}
              >
                Console
              </Button>
              {detailServer.custom && (
                <Button
                  variant="danger"
                  disabled={
                    busy !== null ||
                    (detailServer.state !== "stopped" &&
                      detailServer.state !== "missing")
                  }
                  title={
                    detailServer.state === "stopped" ||
                    detailServer.state === "missing"
                      ? "Remove this server from the panel"
                      : "Stop the server first"
                  }
                  onClick={() => {
                    setDetailOf(null);
                    setConfirming({
                      name: detailServer.name,
                      action: "delete",
                    });
                  }}
                >
                  Delete
                </Button>
              )}
            </>
          }
        />
      )}

      {confirming && (
        <Modal
          title={`Confirm: ${confirming.action}`}
          onClose={() => setConfirming(null)}
        >
          {confirming.action === "delete" ? (
            <p>
              Remove <span className={MONO}>{confirming.name}</span> from the
              panel? Its config file will be deleted.{" "}
              <strong>World data and backups on disk are kept</strong>; the
              server disappears from the list and can no longer be started.
            </p>
          ) : (
            <p>
              This will{" "}
              <strong>
                {confirming.action === "stop"
                  ? "stop"
                  : confirming.action === "restart"
                    ? "restart"
                    : "back up"}
              </strong>{" "}
              <span className={MONO}>{confirming.name}</span>.
              {confirming.action !== "backup" &&
                " Connected players will be disconnected."}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() =>
                confirming.action === "delete"
                  ? remove(confirming.name)
                  : run(confirming.name, confirming.action)
              }
            >
              Yes, continue
            </Button>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {creating && (
        <CreateServerModal
          onClose={() => setCreating(false)}
          onCreated={created}
          push={push}
        />
      )}

      {logsOf && (
        <LogsModal server={logsOf.name} onClose={() => setLogsOf(null)} />
      )}
      {rconOf && (
        <RconModal
          server={rconOf}
          onClose={() => setRconOf(null)}
          push={push}
        />
      )}
    </>
  );
}

function LogsModal({
  server,
  onClose,
}: {
  server: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const [status, setStatus] = useState("connecting…");
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let cancelled = false;
    const es = new EventSource(`/api/logs/${server}/stream`);
    es.addEventListener("log", (ev) => {
      if (cancelled) return;
      const line = JSON.parse((ev as MessageEvent).data) as string;
      setLines((prev) => [...prev.slice(-800), line]);
      setStatus("live");
    });
    es.addEventListener("end", () => {
      es.close();
      setStatus("stream closed");
    });
    es.addEventListener("error", (event) => {
      // Server error events are terminal; network errors may reconnect.
      if (event instanceof MessageEvent) es.close();
      setStatus("stream error");
    });
    // History is prepended (not assigned) so live lines that arrived while
    // the request was in flight keep their chronological position.
    fetch(`/api/logs/${server}/tail?tail=300`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setLines((prev) => [...text.split("\n"), ...prev].slice(-800));
        setStatus("history loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("history unavailable (live only)");
      });
    return () => {
      cancelled = true;
      es.close();
    };
  }, [server]);

  useEffect(() => {
    if (follow && boxRef.current)
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, follow]);

  const visible = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <Modal
      title={
        <>
          Logs · <span className={MONO}>{server}</span>
        </>
      }
      onClose={onClose}
      wide
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className={cn(inputClass, "min-w-45 flex-1")}
          placeholder="Filter lines…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter logs"
        />
        <label className="inline-flex items-center gap-1.5 text-[0.88rem] text-dim">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          Follow live
        </label>
        <span className="text-sm text-dim">
          {status} · {visible.length} lines
        </span>
      </div>
      <pre
        ref={boxRef}
        className="h-[min(50dvh,480px)] overflow-auto rounded-lg border border-edge bg-[#0b1017] px-3 py-3 font-mono text-[0.76rem] leading-relaxed break-words whitespace-pre-wrap text-ink"
      >
        {visible.join("\n") || "No lines to show."}
      </pre>
    </Modal>
  );
}

function RconModal({
  server,
  onClose,
  push,
}: {
  server: ServerStatus;
  onClose: () => void;
  push: Push;
}) {
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<
    Array<{ cmd: string; out: string; ok: boolean }>
  >([]);
  const [sending, setSending] = useState(false);
  const histIdx = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (command: string) => {
    if (!command.trim() || sending) return;
    setSending(true);
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/rcon/${server.name}`,
        { method: "POST", json: { command } },
      );
      setHistory((h) => [
        ...h.slice(-50),
        { cmd: command, out: res.output, ok: res.ok },
      ]);
    } catch (err) {
      setHistory((h) => [
        ...h.slice(-50),
        { cmd: command, out: (err as Error).message, ok: false },
      ]);
    } finally {
      setSending(false);
      setCmd("");
      histIdx.current = -1;
    }
  };

  const quick =
    server.state === "running"
      ? ["list", "tps", "save-all", "whitelist list", "banlist"]
      : [];

  return (
    <Modal
      title={
        <>
          RCON console · <span className={MONO}>{server.name}</span>
        </>
      }
      onClose={onClose}
      wide
    >
      <pre className="h-[min(50dvh,480px)] overflow-auto rounded-lg border border-edge bg-[#0b1017] px-3 py-3 font-mono text-[0.76rem] leading-relaxed break-words whitespace-pre-wrap text-ink">
        {history.length === 0
          ? "Type a command and press Enter. No leading slash (e.g. list)\n"
          : history.flatMap((h) => [`> ${h.cmd}`, h.out, ""]).join("\n")}
      </pre>
      <form
        className="my-2.5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(cmd);
        }}
      >
        <span className="font-mono font-bold text-ok">&gt;</span>
        <input
          ref={inputRef}
          className={cn(inputClass, "flex-1 font-mono")}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && history.length) {
              e.preventDefault();
              histIdx.current =
                histIdx.current < 0
                  ? history.length - 1
                  : Math.max(0, histIdx.current - 1);
              setCmd(history[histIdx.current].cmd);
            }
            if (e.key === "ArrowDown" && histIdx.current >= 0) {
              e.preventDefault();
              histIdx.current =
                histIdx.current + 1 >= history.length
                  ? -1
                  : histIdx.current + 1;
              setCmd(histIdx.current >= 0 ? history[histIdx.current].cmd : "");
            }
          }}
          placeholder={
            server.state === "running" ? "list" : "server is stopped"
          }
          aria-label="RCON command"
          disabled={server.state !== "running"}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={sending || server.state !== "running"}
        >
          Send
        </Button>
      </form>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              className={buttonClass(
                "default",
                "sm",
                "cursor-pointer rounded-full font-mono",
              )}
              onClick={() => void send(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function BackupsTab({ push }: { push: Push }) {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [query, setQuery] = useState("");
  const [backupFilter, setBackupFilter] = useState<BackupFilter>("all");
  const [confirming, setConfirming] = useState<BackupFile | null>(null);

  useEffect(() => {
    api<StatusResponse>("/api/status").then((data) => {
      setServers(data.servers);
      setSelected((cur) => cur ?? data.servers[0]?.name ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<{ files: BackupFile[] }>(`/api/backups/${selected}`).then((res) =>
      setFiles(res.files),
    );
  }, [selected]);

  const createBackup = async () => {
    if (!selected) return;
    push(
      "info",
      "Backup started",
      `Creating a backup of ${selected}; this can take several minutes.`,
    );
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/action/${selected}/backup`,
        { method: "POST", json: {} },
      );
      push(
        res.ok ? "ok" : "err",
        `Backup of ${selected}: ${res.ok ? "done" : "failed"}`,
        res.output,
      );
      const listing = await api<{ files: BackupFile[] }>(
        `/api/backups/${selected}`,
      );
      setFiles(listing.files);
    } catch (err) {
      push("err", "Backup error", (err as Error).message);
    }
  };

  const restore = async (file: BackupFile) => {
    if (!selected) return;
    setConfirming(null);
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/backups/${selected}/restore`,
        { method: "POST", json: { file: file.file } },
      );
      push(
        res.ok ? "ok" : "err",
        `Restore: ${res.ok ? "done" : "failed"}`,
        res.output,
      );
    } catch (err) {
      push("err", "Restore error", (err as Error).message);
    }
  };

  const columns = useMemo<DataTableColumn<BackupFile>[]>(
    () => [
      {
        id: "file",
        header: "File",
        meta: { label: "File" },
        accessorKey: "file",
        enableHiding: false,
        cell: ({ row }) => (
          <span className={cn(MONO, "break-all")}>{row.original.file}</span>
        ),
      },
      {
        id: "size",
        header: "Size",
        meta: { label: "Size" },
        accessorKey: "sizeBytes",
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className={MONO}>{formatBytes(row.original.sizeBytes)}</span>
        ),
      },
      {
        id: "date",
        header: "Date",
        meta: { label: "Date" },
        accessorFn: (f) => new Date(f.modified).getTime(),
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className={MONO}>{timeAgo(row.original.modified)}</span>
        ),
      },
      {
        id: "checksum",
        header: "Checksum",
        meta: { label: "Checksum" },
        accessorFn: (f) => (f.hasChecksum ? 1 : 0),
        enableGlobalFilter: false,
        cell: ({ row }) => (row.original.hasChecksum ? "✓" : "—"),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { label: "Actions" },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex flex-wrap gap-1.5">
              <a
                className={buttonClass("default", "sm")}
                href={`/api/backups/${selected}/file?name=${encodeURIComponent(f.file)}`}
              >
                Download
              </a>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirming(f)}
              >
                Restore
              </Button>
            </div>
          );
        },
      },
    ],
    [selected],
  );

  const visibleFiles = useMemo(() => {
    let list = files;
    if (backupFilter === "checksum")
      list = list.filter((file) => file.hasChecksum);
    if (backupFilter === "unchecked")
      list = list.filter((file) => !file.hasChecksum);
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery)
      list = list.filter((file) =>
        file.file.toLowerCase().includes(normalizedQuery),
      );
    return list;
  }, [backupFilter, files, query]);

  const filterCounts: Record<BackupFilter, number> = {
    all: files.length,
    checksum: files.filter((file) => file.hasChecksum).length,
    unchecked: files.filter((file) => !file.hasChecksum).length,
  };
  const hasActiveFilters = query.trim() !== "" || backupFilter !== "all";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[1.1rem] font-bold tracking-[-0.02em]">
            Backup library
          </h2>
          <p className="mt-1 mb-0 text-[0.84rem] text-dim">
            Create, download or restore a world snapshot.
          </p>
        </div>
        <Button variant="primary" disabled={!selected} onClick={createBackup}>
          Create backup now
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-edge2 bg-panel/75 p-2.5">
        <select
          className={cn(inputClass, "w-auto min-w-55")}
          value={selected ?? ""}
          onChange={(event) => {
            setSelected(event.target.value);
            setFiles([]);
          }}
          aria-label="Filter backups by server"
        >
          {servers.length === 0 && <option value="">No servers</option>}
          {servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.title}
            </option>
          ))}
        </select>
        <FilterSearch
          name="backup-search"
          placeholder="Search backup files"
          value={query}
          onChange={setQuery}
          label="Search backups"
        />
        <CountedFilterGroup
          label="Filter backups by checksum"
          value={backupFilter}
          onChange={setBackupFilter}
          options={BACKUP_FILTERS.map(([value, label]) => ({
            value,
            label,
            count: filterCounts[value],
          }))}
        />
      </div>

      {hasActiveFilters && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent px-1 text-[0.78rem] font-semibold text-dim underline underline-offset-3 hover:text-ink"
            onClick={() => {
              setQuery("");
              setBackupFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {visibleFiles.length} backups match the current filters.
      </div>

      <DataTable
        data={visibleFiles}
        columns={columns}
        initialSorting={[{ id: "date", desc: true }]}
        externalFiltering
        emptyMessage={
          hasActiveFilters
            ? "No backups match the current filters."
            : selected
              ? "No backups for this server yet. Create the first one."
              : "Pick a server."
        }
      />

      {confirming && (
        <Modal title="Confirm restore" onClose={() => setConfirming(null)}>
          <p>
            This will restore <span className={MONO}>{confirming.file}</span>{" "}
            into <span className={MONO}>{selected}</span>.<br />
            <strong>The current world will be replaced</strong> by the backup
            contents. This cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void restore(confirming)}>
              Yes, restore
            </Button>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SystemTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    return startPolling(async () => {
      try {
        setInfo(await api<SystemInfo>("/api/system"));
      } catch {
        /* transient */
      }
    }, 5000);
  }, []);

  if (!info)
    return (
      <p className="p-8 text-center text-dim">Reading host information…</p>
    );

  const memUsed = info.memTotalBytes - info.memFreeBytes;
  const diskUsed = info.diskTotalBytes - info.diskFreeBytes;
  const pct = (a: number, b: number) =>
    b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-[1.1rem] font-bold tracking-[-0.02em]">
          Host resources
        </h2>
        <p className="mt-1 mb-0 text-[0.84rem] text-dim">
          Live capacity and runtime information for this machine.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Memory</h3>
          <p className={cn("m-0", MONO)}>
            {formatBytes(memUsed)} / {formatBytes(info.memTotalBytes)} (
            {pct(memUsed, info.memTotalBytes)}%)
          </p>
          <Meter value={pct(memUsed, info.memTotalBytes)} />
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Disk (project data)</h3>
          <p className={cn("m-0", MONO)}>
            {formatBytes(diskUsed)} / {formatBytes(info.diskTotalBytes)} (
            {pct(diskUsed, info.diskTotalBytes)}%)
          </p>
          <Meter value={pct(diskUsed, info.diskTotalBytes)} />
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">CPU</h3>
          <p className="m-0">{info.cpuCount} cores</p>
          <p className={cn("m-0 text-sm", MONO)}>{info.cpuModel}</p>
          <p className={cn("m-0", MONO)}>
            load: {info.loadAvg.map((l) => l.toFixed(2)).join(" · ")}
          </p>
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Environment</h3>
          <p className={cn("m-0 text-sm", MONO)}>
            {info.hostname} · {info.platform}/{info.arch}
            <br />
            Docker {info.dockerVersion ?? "unavailable"} · Node{" "}
            {info.nodeVersion}
            <br />
            host uptime {formatUptime(info.hostUptimeSec)}
          </p>
        </div>
      </div>
    </>
  );
}

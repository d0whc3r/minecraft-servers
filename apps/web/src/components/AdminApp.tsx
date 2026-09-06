// Admin area: login gate + server actions, live logs, RCON console, backups, system.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AuthMe,
  BackupFile,
  ServerStatus,
  StatusResponse,
  SystemInfo,
} from "../types";
import {
  api,
  formatBytes,
  formatUptime,
  startPolling,
  timeAgo,
} from "../lib/client";
import { DataTable, type TableFilter } from "./DataTable";
import {
  Button,
  buttonClass,
  cn,
  CopyValue,
  Field,
  inputClass,
  Meter,
  Modal,
  MONO,
  StateBadge,
  StatusDot,
  STATE_LABELS,
  useToasts,
} from "./ui";

type Tab = "servers" | "backups" | "system";

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
    <form
      className="mx-auto mt-[8vh] flex w-full max-w-[380px] flex-col gap-3.5 rounded-2xl border border-edge bg-panel p-6"
      onSubmit={submit}
    >
      <h2 className="m-0 mb-1">Admin sign in</h2>
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
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          required
        />
      </Field>
      <Field label="Password">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>
      <Button variant="primary" type="submit" disabled={sending}>
        {sending ? "Checking…" : "Sign in"}
      </Button>
    </form>
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
    typeof location !== "undefined" && location.hash === "#copias"
      ? "backups"
      : "servers",
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Admin sections"
          className="inline-flex divide-x divide-edge overflow-hidden rounded-lg border border-edge"
        >
          {(["servers", "backups", "system"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={cn(
                "cursor-pointer border-0 px-3.5 py-2 font-sans text-dim",
                tab === t
                  ? "bg-raise font-semibold text-ink"
                  : "hover:text-ink",
              )}
              onClick={() => setTab(t)}
            >
              {t === "servers"
                ? "Servers"
                : t === "backups"
                  ? "Backups"
                  : "System"}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onLogout}>
          Sign out
        </Button>
      </div>
      {tab === "servers" && <ServersTab push={push} />}
      {tab === "backups" && <BackupsTab push={push} />}
      {tab === "system" && <SystemTab />}
    </>
  );
}

type Push = ReturnType<typeof useToasts>["push"];

function ServersTab({ push }: { push: Push }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [logsOf, setLogsOf] = useState<ServerStatus | null>(null);
  const [rconOf, setRconOf] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    name: string;
    action: "stop" | "restart" | "backup";
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

  const run = async (
    name: string,
    action: "start" | "stop" | "restart" | "backup",
  ) => {
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
  };

  const servers = useMemo(
    () =>
      [...(status?.servers ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [status],
  );

  const columns = useMemo<ColumnDef<ServerStatus, any>[]>(
    () => [
      {
        id: "server",
        header: "Server",
        meta: { label: "Server" },
        accessorFn: (s) => `${s.title} ${s.name} ${s.platform} ${s.mcVersion}`,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <strong>{row.original.title}</strong>
            <span className="block font-mono text-[0.78rem] text-dim">
              {row.original.name} · {row.original.platform} · MC{" "}
              {row.original.mcVersion}
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
        id: "actions",
        header: "Actions",
        meta: { label: "Actions" },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const s = row.original;
          const stopped = s.state === "stopped" || s.state === "missing";
          return (
            <div className="flex flex-wrap gap-1.5">
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
              <Button
                size="sm"
                disabled={busy !== null || stopped}
                onClick={() =>
                  setConfirming({ name: s.name, action: "restart" })
                }
              >
                Restart
              </Button>
              <Button
                size="sm"
                disabled={busy !== null || stopped}
                onClick={() =>
                  setConfirming({ name: s.name, action: "backup" })
                }
              >
                Back up
              </Button>
              <Button size="sm" onClick={() => setLogsOf(s)}>
                Logs
              </Button>
              <Button size="sm" onClick={() => setRconOf(s)}>
                Console
              </Button>
            </div>
          );
        },
      },
    ],
    [busy, run],
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
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={servers}
        columns={columns}
        filters={filters}
        initialSorting={[{ id: "server", desc: false }]}
        searchPlaceholder="Search servers…"
        emptyMessage={servers.length ? "No servers." : "Loading server status…"}
      />

      {confirming && (
        <Modal
          title={`Confirm: ${confirming.action}`}
          onClose={() => setConfirming(null)}
        >
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => run(confirming.name, confirming.action)}
            >
              Yes, continue
            </Button>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
          </div>
        </Modal>
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
    fetch(`/api/logs/${server}/tail?tail=300`)
      .then((r) => r.text())
      .then((text) => {
        setLines(text.split("\n").slice(-400));
        setStatus("history loaded");
      });
    const es = new EventSource(`/api/logs/${server}/stream`);
    es.addEventListener("log", (ev) => {
      const line = JSON.parse((ev as MessageEvent).data) as string;
      setLines((prev) => [...prev.slice(-800), line]);
      setStatus("live");
    });
    es.addEventListener("end", () => setStatus("stream closed"));
    es.addEventListener("error", () => setStatus("stream error"));
    return () => es.close();
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

  const columns = useMemo<ColumnDef<BackupFile, any>[]>(
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className={cn(inputClass, "min-w-55")}
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Server"
        >
          {servers.map((s) => (
            <option key={s.name} value={s.name}>
              {s.title}
            </option>
          ))}
        </select>
        <Button variant="primary" disabled={!selected} onClick={createBackup}>
          Create backup now
        </Button>
      </div>

      <DataTable
        data={files}
        columns={columns}
        initialSorting={[{ id: "date", desc: true }]}
        searchPlaceholder="Search backups…"
        emptyMessage={
          selected
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
      <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel px-4 py-4">
        <h3 className="m-0 text-[0.95rem]">Memory</h3>
        <p className={cn("m-0", MONO)}>
          {formatBytes(memUsed)} / {formatBytes(info.memTotalBytes)} (
          {pct(memUsed, info.memTotalBytes)}%)
        </p>
        <Meter value={pct(memUsed, info.memTotalBytes)} />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel px-4 py-4">
        <h3 className="m-0 text-[0.95rem]">Disk (project data)</h3>
        <p className={cn("m-0", MONO)}>
          {formatBytes(diskUsed)} / {formatBytes(info.diskTotalBytes)} (
          {pct(diskUsed, info.diskTotalBytes)}%)
        </p>
        <Meter value={pct(diskUsed, info.diskTotalBytes)} />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel px-4 py-4">
        <h3 className="m-0 text-[0.95rem]">CPU</h3>
        <p className="m-0">{info.cpuCount} cores</p>
        <p className={cn("m-0 text-sm", MONO)}>{info.cpuModel}</p>
        <p className={cn("m-0", MONO)}>
          load: {info.loadAvg.map((l) => l.toFixed(2)).join(" · ")}
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel px-4 py-4">
        <h3 className="m-0 text-[0.95rem]">Environment</h3>
        <p className={cn("m-0 text-sm", MONO)}>
          {info.hostname} · {info.platform}/{info.arch}
          <br />
          Docker {info.dockerVersion ?? "unavailable"} · Node {info.nodeVersion}
          <br />
          host uptime {formatUptime(info.hostUptimeSec)}
        </p>
      </div>
    </div>
  );
}

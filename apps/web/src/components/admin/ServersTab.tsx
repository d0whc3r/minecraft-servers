// Servers tab: lifecycle actions, detail modal wiring, create/logs/rcon
// modals and the filterable servers table.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ServerStatus, StatusResponse } from "@/types";
import { api } from "@/lib/client";
import {
  matchesServerQuery,
  matchesStateFilter,
  stateFilterCounts,
  STATE_FILTER_OPTIONS,
  type ServerStateFilter,
} from "@/lib/serverFilters";
import { adminServerAnchor } from "@/lib/serverLinks";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import type { ToastPush } from "@/components/ui";
import {
  Button,
  cn,
  CountedFilterGroup,
  FilterSearch,
  inputClass,
  MONO,
} from "@/components/ui";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { ServerDetailsModal } from "@/components/ServerDetailsModal";
import { CreateServerModal } from "@/components/admin/CreateServerModal";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { LogsModal } from "@/components/admin/LogsModal";
import { RconModal } from "@/components/admin/RconModal";
import { ServerDetailActions } from "@/components/admin/ServerDetailActions";
import { buildServersColumns } from "@/components/admin/serversColumns";

type AdminServerFilter = ServerStateFilter;
type ConfirmAction = "stop" | "restart" | "backup" | "delete";

export function ServersTab({ push }: { push: ToastPush }) {
  const { status } = useStatusPolling();
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
    action: ConfirmAction;
  } | null>(null);

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
    if (serverFilter !== "all")
      list = list.filter((server) => matchesStateFilter(server, serverFilter));
    if (platformFilter)
      list = list.filter((server) => server.platform === platformFilter);
    if (tagFilter)
      list = list.filter((server) => server.tags.includes(tagFilter));
    return list.filter((server) => matchesServerQuery(server, query));
  }, [
    allServers,
    platformFilter,
    query,
    serverFilter,
    tagFilter,
    targetServer,
  ]);

  const filterCounts = stateFilterCounts(allServers);
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
        .getElementById(adminServerAnchor(targetServer))
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
    () =>
      buildServersColumns({
        disabled: busy !== null,
        onStart: (name) => run(name, "start"),
        onStopRequest: (name) => setConfirming({ name, action: "stop" }),
        onDetails: (name) => setDetailOf(name),
      }),
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
          options={STATE_FILTER_OPTIONS.map(([value, label]) => ({
            value,
            label,
            count: filterCounts[value],
          }))}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          name="admin-platform-filter"
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
          name="admin-tag-filter"
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
        getRowAnchor={(server) => adminServerAnchor(server.name)}
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
            <ServerDetailActions
              server={detailServer}
              disabled={busy !== null}
              onStart={() => run(detailServer.name, "start")}
              onStopRequest={() => {
                setDetailOf(null);
                setConfirming({ name: detailServer.name, action: "stop" });
              }}
              onRestartRequest={() => {
                setDetailOf(null);
                setConfirming({ name: detailServer.name, action: "restart" });
              }}
              onBackupRequest={() => {
                setDetailOf(null);
                setConfirming({ name: detailServer.name, action: "backup" });
              }}
              onLogs={() => {
                setDetailOf(null);
                setLogsOf(detailServer);
              }}
              onConsole={() => {
                setDetailOf(null);
                setRconOf(detailServer);
              }}
              onDeleteRequest={() => {
                setDetailOf(null);
                setConfirming({ name: detailServer.name, action: "delete" });
              }}
            />
          }
        />
      )}

      {confirming && (
        <ConfirmModal
          title={`Confirm: ${confirming.action}`}
          confirmLabel="Yes, continue"
          onConfirm={() =>
            confirming.action === "delete"
              ? remove(confirming.name)
              : run(confirming.name, confirming.action)
          }
          onCancel={() => setConfirming(null)}
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
        </ConfirmModal>
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

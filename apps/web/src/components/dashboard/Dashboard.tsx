// Public dashboard: live status of every configured server. Owns the filter
// state and data polling; presentation lives in the sibling components.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthMe, ServerStatus, StatusResponse } from "@/types";
import { api } from "@/lib/client";
import {
  matchesServerQuery,
  matchesStateFilter,
  stateFilterCounts,
  STATE_FILTER_OPTIONS,
  type ServerStateFilter,
} from "@/lib/serverFilters";
import { adminServerHref } from "@/lib/serverLinks";
import { ServerDetailsModal } from "@/components/ServerDetailsModal";
import { Button, cn, CountedFilterGroup, FilterSearch } from "@/components/ui";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { ServerCard } from "@/components/dashboard/ServerCard";
import { ServersTable } from "@/components/dashboard/ServersTable";
import { Sparkline, Stat } from "@/components/dashboard/Stat";
import {
  ViewToggle,
  type DashboardView,
} from "@/components/dashboard/ViewToggle";

type View = DashboardView;

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ServerStateFilter>("all");
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

  const { status, error } = useStatusPolling(5000, (data) => {
    const h = historyRef.current;
    h.push(data.summary.playersOnline);
    if (h.length > 120) h.shift();
  });

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
    if (filter !== "all")
      list = list.filter((s) => matchesStateFilter(s, filter));
    if (selectedTags.length)
      list = list.filter((s) => s.tags.some((t) => selectedTags.includes(t)));
    list = list.filter((s) => matchesServerQuery(s, query));
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
  const filterCounts = stateFilterCounts(allServers);
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
              error
                ? "bg-bad"
                : status
                  ? "bg-ok"
                  : "animate-pulse bg-idle motion-reduce:animate-none",
            )}
            aria-hidden="true"
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
        <ViewToggle view={view} onChange={changeView} />
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
          options={STATE_FILTER_OPTIONS.map(([value, label]) => ({
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
        <ServersTable servers={servers} isAdmin={isAdmin} onOpen={setDetail} />
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

// Server card for the dashboard grid view: identity, tags, connect address,
// metrics and the admin quick actions.
import type { ServerStatus } from "@/types";
import { formatUptime } from "@/lib/client";
import { adminServerHref } from "@/lib/serverLinks";
import {
  Button,
  buttonClass,
  cn,
  CopyValue,
  StateBadge,
  StateBar,
} from "@/components/ui";

export function ServerCard({
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
            {s.platform} <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
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

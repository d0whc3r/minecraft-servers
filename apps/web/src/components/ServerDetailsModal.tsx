import type { ReactNode } from "react";
import type { ServerStatus } from "@/types";
import {
  buttonClass,
  Chip,
  CopyValue,
  Field,
  Modal,
  MONO,
  StateBadge,
} from "@/components/ui";

interface ServerDetailsModalProps {
  server: ServerStatus;
  routerPort: number | null;
  onClose: () => void;
  actions?: ReactNode;
  adminHref?: string;
}

/** Shared server detail surface used by both the public dashboard and Admin. */
export function ServerDetailsModal({
  server: s,
  routerPort,
  onClose,
  actions,
  adminHref,
}: ServerDetailsModalProps) {
  return (
    <Modal title={s.title} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div>
          <p className="m-0">
            <StateBadge state={s.state} />
            {s.statusText ? (
              <span className="text-dim"> · {s.statusText}</span>
            ) : null}
          </p>
          {s.description ? <p className="text-dim">{s.description}</p> : null}
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
            {s.tags.map((tag) => (
              <Chip key={tag} tone="mono">
                #{tag}
              </Chip>
            ))}
            <Chip>MC {s.mcVersion}</Chip>
            <Chip>{s.memory} RAM</Chip>
            <Chip tone="mono">{s.connect}</Chip>
            {s.pingMs !== null ? <Chip>{s.pingMs} ms</Chip> : null}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <Field label="Players online">
            {s.players && s.players.names.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {s.players.names.map((name) => (
                  <Chip key={name}>{name}</Chip>
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

        {actions || adminHref ? (
          <div className="flex flex-wrap gap-2">
            {actions}
            {adminHref ? (
              <a href={adminHref} className={buttonClass()}>
                Manage in admin
              </a>
            ) : null}
          </div>
        ) : null}

        {adminHref ? (
          <p className="m-0 text-sm text-dim">
            Logs, console and backups are available in the admin area.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function connectAddress(connect: string, routerPort: number | null): string {
  return routerPort ? `${connect}:${routerPort}` : connect;
}

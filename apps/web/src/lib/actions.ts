// Management actions: run the repo's own bash scripts with per-server locking.
import { execFile } from "node:child_process";
import { PROJECT_ROOT } from "./servers.js";

export type ActionType = "start" | "stop" | "restart" | "backup" | "restore";

const SCRIPTS: Record<ActionType, { script: string; timeoutMs: number }> = {
  start: { script: "scripts/start-server.sh", timeoutMs: 5 * 60_000 },
  stop: { script: "scripts/stop-server.sh", timeoutMs: 3 * 60_000 },
  restart: { script: "scripts/restart-server.sh", timeoutMs: 8 * 60_000 },
  backup: { script: "scripts/backup.sh", timeoutMs: 30 * 60_000 },
  restore: { script: "scripts/restore.sh", timeoutMs: 30 * 60_000 },
};

export const ACTION_LABELS: Record<ActionType, string> = {
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  backup: "Back up",
  restore: "Restore",
};

// One action at a time per server (status reads stay free).
const locks = new Map<string, Promise<ActionResult>>();

export interface ActionResult {
  ok: boolean;
  action: ActionType;
  server: string;
  output: string;
  durationMs: number;
}

export function isActionRunning(server: string): boolean {
  return locks.has(server);
}

function runScript(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "bash",
      args,
      { cwd: PROJECT_ROOT, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (err && !output) return reject(new Error(err.message));
        if (err) {
          const error = new Error(output) as Error & { exitCode?: number };
          error.exitCode = typeof err.code === "number" ? err.code : 1;
          return reject(error);
        }
        resolve(output || "(no output)");
      },
    );
  });
}

export async function runAction(
  action: ActionType,
  server: string,
  backupFile?: string,
): Promise<ActionResult> {
  const existing = locks.get(server);
  if (existing)
    throw new Error("Another action is already running for this server");

  const spec = SCRIPTS[action];
  if (!spec) throw new Error(`Unknown action: ${action}`);

  const args =
    action === "restore"
      ? [spec.script, server, backupFile ?? "", "--force"]
      : [spec.script, server];

  const started = Date.now();
  const promise = runScript(args, spec.timeoutMs)
    .then((output): ActionResult => ({
      ok: true,
      action,
      server,
      output,
      durationMs: Date.now() - started,
    }))
    .finally(() => locks.delete(server));

  // Store a swallowed copy so concurrent callers get a friendly error
  const tracked = promise.catch(() => undefined) as Promise<ActionResult>;
  locks.set(server, tracked);
  return promise;
}

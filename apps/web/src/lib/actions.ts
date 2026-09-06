// Management actions: run the repo's own bash scripts (docker runtime) or the
// helm/kubectl backend (kubernetes runtime), with per-server locking.
import { execFile } from "node:child_process";
import { PROJECT_ROOT, getServerDef } from "@/lib/servers.js";
import { RUNTIME } from "@/lib/runtime.js";
import { runAction as k8sRunAction } from "@/lib/k8s.js";
import { withServerOperation } from "@/lib/serverOperations.js";
export { isServerOperationRunning as isActionRunning } from "@/lib/serverOperations.js";

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

export interface ActionResult {
  ok: boolean;
  action: ActionType;
  server: string;
  output: string;
  durationMs: number;
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
  return withServerOperation(server, async () => {
    // A request may have validated its parameter before a concurrent delete.
    if (!getServerDef(server)) throw new Error(`Unknown server: ${server}`);
    if (!Object.hasOwn(SCRIPTS, action)) {
      throw new Error(`Unknown action: ${action}`);
    }
    if (RUNTIME === "kubernetes") {
      return k8sRunAction(action, server, backupFile);
    }

    const spec = SCRIPTS[action];
    const args =
      action === "restore"
        ? [spec.script, server, backupFile ?? "", "--force"]
        : [spec.script, server];
    const started = Date.now();
    const output = await runScript(args, spec.timeoutMs);
    return {
      ok: true,
      action,
      server,
      output,
      durationMs: Date.now() - started,
    };
  });
}

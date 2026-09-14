// Shared kubectl plumbing: promisified exec, per-command timeouts and the
// label selector every panel-created workload carries.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { k8sNamespace } from "@/lib/runtime.js";

export const exec = promisify(execFile);

export const KUBECTL_TIMEOUT_MS = 20_000;
// Matches the docker runtime's action budgets (actions.ts) and the backup
// script's generous tar time for big worlds.
export const BACKUP_TIMEOUT_MS = 30 * 60_000;

export const PART_OF_LABEL = "app.kubernetes.io/part-of=minecraft-servers";

// alpine only to run tar/sha256sum inside one-off backup/restore Jobs.
export const JOB_IMAGE = process.env.MCPANEL_K8S_JOB_IMAGE || "alpine:3.20";

export function ns(): string {
  return k8sNamespace();
}

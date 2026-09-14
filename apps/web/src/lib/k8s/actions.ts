// Server lifecycle actions on the cluster: start/stop/restart via helm
// re-renders, backup/restore via one-off Jobs (same contract as the
// bash-script actions of the docker runtime).
import { getServerDef, type ServerDef } from "@/lib/servers.js";
import { releaseName } from "@/lib/runtime.js";
import {
  BACKUP_TIMEOUT_MS,
  exec,
  KUBECTL_TIMEOUT_MS,
  ns,
} from "@/lib/k8s/kubectl.js";
import { helmUpgrade } from "@/lib/k8s/helm.js";
import { getDeployment } from "@/lib/k8s/workload.js";
import { jobScript, runJob, safeBackupName } from "@/lib/k8s/jobs.js";
import { waitForScaleZero } from "@/lib/k8s/backups.js";

/** Same set as actions.ts ActionType; duplicated to avoid an import cycle. */
type K8sAction = "start" | "stop" | "restart" | "backup" | "restore";

export interface ActionResult {
  ok: boolean;
  action: K8sAction;
  server: string;
  output: string;
  durationMs: number;
}

export async function runAction(
  action: K8sAction,
  server: string,
  backupFile?: string,
): Promise<ActionResult> {
  const started = Date.now();
  const finish = (ok: boolean, output: string): ActionResult => ({
    ok,
    action,
    server,
    output,
    durationMs: Date.now() - started,
  });

  const def: ServerDef | null = getServerDef(server);
  if (!def) return finish(false, `Unknown server: ${server}`);
  const release = releaseName(server);

  try {
    if (action === "start") {
      const out = await helmUpgrade(def, 1);
      return finish(
        true,
        `Release ${release} deployed (replicaCount=1)\n${out}`,
      );
    }
    if (action === "stop") {
      const dep = await getDeployment(server);
      if (!dep) return finish(true, "Server is not deployed");
      const out = await helmUpgrade(def, 0);
      return finish(true, `Release ${release} scaled to 0\n${out}`);
    }
    if (action === "restart") {
      const dep = await getDeployment(server);
      if (!dep || dep.replicas === 0) {
        const out = await helmUpgrade(def, 1);
        return finish(
          true,
          `Release ${release} deployed (replicaCount=1)\n${out}`,
        );
      }
      // Re-render first — new chart shipped with the panel image, new env
      // from the catalog and the shared .env, new route — then force the pod
      // to roll: when helm renders an identical manifest (nothing changed),
      // only the rollout guarantees the running container actually restarts.
      const out = await helmUpgrade(def, 1);
      await exec(
        "kubectl",
        ["rollout", "restart", `deployment/${release}`, "--namespace", ns()],
        { timeout: KUBECTL_TIMEOUT_MS },
      );
      return finish(
        true,
        `Release ${release} re-rendered and rolling restart triggered\n${out}`,
      );
    }
    if (action === "backup") {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z");
      const file = `${server}-${stamp}.tar.gz`;
      const out = await runJob(
        `mc-${server}-backup-${Date.now().toString(36)}`,
        server,
        await jobScript("backup-create"),
        BACKUP_TIMEOUT_MS,
        [file],
      );
      return finish(true, out);
    }
    if (action === "restore") {
      const file = safeBackupName(backupFile ?? "");
      if (!file) return finish(false, "Invalid backup file");
      const dep = await getDeployment(server);
      if (dep && dep.replicas > 0) {
        await helmUpgrade(def, 0);
        await waitForScaleZero(server);
      }
      const out = await runJob(
        `mc-${server}-restore-${Date.now().toString(36)}`,
        server,
        await jobScript("backup-restore"),
        BACKUP_TIMEOUT_MS,
        [file],
      );
      return finish(true, `Server stopped; world restored.\n${out}`);
    }
    return finish(false, `Unknown action: ${action}`);
  } catch (err) {
    return finish(false, (err as Error).message);
  }
}

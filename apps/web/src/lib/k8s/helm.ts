// Helm release management: each server is a release (mc-<server>) of
// charts/minecraft-server; start = replicaCount=1, stop = scaled to 0.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ServerDef } from "@/lib/servers.js";
import { releaseName } from "@/lib/runtime.js";
import { buildServerValues, serverChartPath } from "@/lib/k8sValues.js";
import { exec, ns } from "@/lib/k8s/kubectl.js";

async function writeValuesFile(def: ServerDef, replicas: number) {
  const file = path.join(
    os.tmpdir(),
    `mcpanel-values-${def.name}-${process.pid}-${Date.now()}.yaml`,
  );
  await fs.writeFile(
    file,
    // JSON is valid YAML; immune to quoting issues with CurseForge keys etc.
    JSON.stringify(buildServerValues(def, replicas), null, 2),
  );
  return file;
}

export async function helmUpgrade(
  def: ServerDef,
  replicas: number,
): Promise<string> {
  const file = await writeValuesFile(def, replicas);
  try {
    const { stdout } = await exec(
      "helm",
      [
        "upgrade",
        releaseName(def.name),
        serverChartPath(),
        "--install",
        "--namespace",
        ns(),
        "--values",
        file,
        "--history-max",
        "5",
        "--set",
        `replicaCount=${replicas}`,
      ],
      { timeout: 4 * 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout.trim();
  } catch (err) {
    throw new Error(`helm upgrade failed: ${(err as Error).message}`);
  } finally {
    await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

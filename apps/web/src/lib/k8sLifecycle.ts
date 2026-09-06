// Strict lifecycle checks do not use the dashboard's cached/best-effort reads.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { k8sNamespace, releaseName } from "@/lib/runtime.js";

const exec = promisify(execFile);

interface PodSpec {
  volumes?: Array<{ persistentVolumeClaim?: { claimName?: string } }>;
}

interface Workload {
  kind: "Deployment" | "Pod" | "Job";
  metadata: { name: string; labels?: Record<string, string> };
  spec?: PodSpec & { replicas?: number; template?: { spec?: PodSpec } };
  status?: {
    replicas?: number;
    phase?: string;
    conditions?: Array<{ type: string; status: string }>;
  };
}

/** Check desired replicas, terminating/pending pods and backup/restore Jobs. */
export async function isServerStopped(server: string): Promise<boolean> {
  const release = releaseName(server);
  const { stdout } = await exec(
    "kubectl",
    [
      "get",
      "deployments,pods,jobs",
      "--namespace",
      k8sNamespace(),
      "--output",
      "json",
    ],
    { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 },
  );
  const response: { items: Workload[] } = JSON.parse(stdout);
  if (!Array.isArray(response.items))
    throw new Error("Invalid Kubernetes workload list");

  const usesServerStorage = (spec: PodSpec | undefined) =>
    spec?.volumes?.some((volume) =>
      [`${release}-data`, `${release}-backups`, `${release}-mods`].includes(
        volume.persistentVolumeClaim?.claimName ?? "",
      ),
    ) ?? false;

  for (const item of response.items) {
    if (
      !item?.metadata?.name ||
      !["Deployment", "Pod", "Job"].includes(item.kind)
    ) {
      throw new Error("Invalid Kubernetes workload entry");
    }
    const belongsToServer =
      item.metadata.name === release ||
      item.metadata.labels?.["app.kubernetes.io/instance"] === release ||
      usesServerStorage(
        item.kind === "Pod" ? item.spec : item.spec?.template?.spec,
      );
    if (!belongsToServer) continue;

    if (item.kind === "Deployment") {
      if (item.spec?.replicas !== 0 || (item.status?.replicas ?? 0) !== 0)
        return false;
    } else if (item.kind === "Pod") {
      if (item.status?.phase !== "Succeeded" && item.status?.phase !== "Failed")
        return false;
    } else {
      const finished = item.status?.conditions?.some(
        (condition) =>
          (condition.type === "Complete" || condition.type === "Failed") &&
          condition.status === "True",
      );
      if (!finished) return false;
    }
  }
  return true;
}

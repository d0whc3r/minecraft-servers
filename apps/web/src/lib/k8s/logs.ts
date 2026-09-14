// Log access and cluster version for the kubernetes runtime.
import { releaseName } from "@/lib/runtime.js";
import { exec, KUBECTL_TIMEOUT_MS, ns } from "@/lib/k8s/kubectl.js";

export async function getRecentLogs(
  server: string,
  tail: number,
): Promise<string> {
  try {
    const { stdout } = await exec(
      "kubectl",
      [
        "logs",
        `deployment/${releaseName(server)}`,
        "--container",
        "minecraft",
        "--namespace",
        ns(),
        `--tail=${tail}`,
      ],
      { timeout: KUBECTL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout;
  } catch (err) {
    return `kubectl logs failed: ${(err as Error).message}`;
  }
}

export function logFollow(server: string): {
  cmd: string;
  args: string[];
} {
  return {
    cmd: "kubectl",
    args: [
      "logs",
      `deployment/${releaseName(server)}`,
      "--container",
      "minecraft",
      "--namespace",
      ns(),
      "--tail=200",
      "--follow",
      "--pod-running-timeout=60s",
    ],
  };
}

export async function getVersion(): Promise<string | null> {
  try {
    const { stdout } = await exec("kubectl", ["version", "--output", "json"], {
      timeout: KUBECTL_TIMEOUT_MS,
    });
    const v = JSON.parse(stdout) as {
      serverVersion?: { gitVersion?: string };
    };
    return v.serverVersion?.gitVersion ?? null;
  } catch {
    return null;
  }
}

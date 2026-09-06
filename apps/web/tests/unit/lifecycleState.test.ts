import { beforeEach, describe, expect, it, vi } from "vitest";

const exec = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  return { execFile: Object.assign(vi.fn(), { [promisify.custom]: exec }) };
});

import { isServerStopped as dockerStopped } from "@/lib/docker";
import { isServerStopped as k8sStopped } from "@/lib/k8sLifecycle";

beforeEach(() => vi.resetAllMocks());

describe("Docker removal state", () => {
  it.each(["running", "restarting", "paused", "created", "removing"])(
    "blocks %s containers even when the UI could show stopped or unhealthy",
    async (state) => {
      exec.mockResolvedValue({
        stdout: JSON.stringify({
          Names: "mc-test",
          State: state,
          Status: "Up 10 minutes (unhealthy)",
        }),
      });
      expect(await dockerStopped("test")).toBe(false);
    },
  );

  it.each(["exited", "dead"])(
    "allows confirmed %s containers",
    async (state) => {
      exec.mockResolvedValue({
        stdout: JSON.stringify({ Names: "mc-test", State: state }),
      });
      expect(await dockerStopped("test")).toBe(true);
    },
  );

  it("allows absence only after a successful fresh query", async () => {
    exec.mockResolvedValue({ stdout: "" });
    expect(await dockerStopped("test")).toBe(true);
    expect(await dockerStopped("test")).toBe(true);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it("propagates command failures and malformed responses", async () => {
    exec.mockRejectedValueOnce(new Error("Docker unavailable"));
    await expect(dockerStopped("test")).rejects.toThrow("Docker unavailable");
    exec.mockResolvedValueOnce({ stdout: "not json" });
    await expect(dockerStopped("test")).rejects.toThrow();
    exec.mockResolvedValueOnce({ stdout: "{}" });
    await expect(dockerStopped("test")).rejects.toThrow("Unexpected Docker");
  });
});

const deployment = (replicas: number, observedReplicas = replicas) => ({
  kind: "Deployment",
  metadata: { name: "mc-test" },
  spec: { replicas },
  status: { replicas: observedReplicas },
});
const storage = {
  volumes: [{ persistentVolumeClaim: { claimName: "mc-test-data" } }],
};
const pod = (phase: string) => ({
  kind: "Pod",
  metadata: {
    name: "mc-test-abc-123",
    labels: { "app.kubernetes.io/instance": "mc-test" },
  },
  spec: storage,
  status: { phase },
});
function workloads(items: unknown[]) {
  exec.mockResolvedValue({ stdout: JSON.stringify({ items }) });
}

describe("Kubernetes removal state", () => {
  it("blocks a desired deployment before its first pod starts", async () => {
    workloads([deployment(1, 0)]);
    expect(await k8sStopped("test")).toBe(false);
  });

  it("blocks a scale-down until observed replicas have stopped", async () => {
    workloads([deployment(0, 1)]);
    expect(await k8sStopped("test")).toBe(false);
  });

  it.each(["Pending", "Running", "Unknown", ""])(
    "blocks remaining %s pods after scale-down",
    async (phase) => {
      workloads([deployment(0), pod(phase)]);
      expect(await k8sStopped("test")).toBe(false);
    },
  );

  it("blocks unfinished backup Jobs even before their pods exist", async () => {
    workloads([
      deployment(0),
      {
        kind: "Job",
        metadata: { name: "mc-test-backup-123" },
        spec: { template: { spec: storage } },
        status: {},
      },
    ]);
    expect(await k8sStopped("test")).toBe(false);
  });

  it("recognizes old backup pods by PVC even without server labels", async () => {
    workloads([{ ...pod("Pending"), metadata: { name: "backup-pod" } }]);
    expect(await k8sStopped("test")).toBe(false);
  });

  it("allows scale-zero with only terminal pods and Jobs", async () => {
    workloads([
      deployment(0),
      pod("Succeeded"),
      {
        kind: "Job",
        metadata: { name: "old-backup" },
        spec: { template: { spec: storage } },
        status: { conditions: [{ type: "Complete", status: "True" }] },
      },
    ]);
    expect(await k8sStopped("test")).toBe(true);
  });

  it("allows a confirmed absent server and ignores other servers", async () => {
    workloads([{ ...deployment(1), metadata: { name: "mc-other" } }]);
    expect(await k8sStopped("test")).toBe(true);
    workloads([]);
    expect(await k8sStopped("test")).toBe(true);
  });

  it("propagates API errors and malformed state instead of assuming absence", async () => {
    exec.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(k8sStopped("test")).rejects.toThrow("Forbidden");
    exec.mockResolvedValueOnce({ stdout: "{}" });
    await expect(k8sStopped("test")).rejects.toThrow("Invalid Kubernetes");
    workloads([{}]);
    await expect(k8sStopped("test")).rejects.toThrow("Invalid Kubernetes");
  });
});

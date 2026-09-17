// Kubernetes log access and cluster version: kubectl argument construction,
// namespace resolution per call, and the graceful degradation of `getVersion`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  return {
    execFile: Object.assign(vi.fn(), { [promisify.custom]: mocks.exec }),
  };
});

import { getRecentLogs, getVersion, logFollow } from "@/lib/k8s/logs.js";

beforeEach(() => {
  process.env.MCPANEL_K8S_NAMESPACE = "panel-ns";
  delete process.env.NAMESPACE;
  mocks.exec.mockResolvedValue({ stdout: "" });
});

describe("getRecentLogs", () => {
  it("reads the minecraft container of the server's deployment", async () => {
    mocks.exec.mockResolvedValue({ stdout: "[Server] Done!\n" });
    const logs = await getRecentLogs("vanilla", 99);
    expect(logs).toBe("[Server] Done!\n");
    expect(mocks.exec).toHaveBeenCalledWith(
      "kubectl",
      [
        "logs",
        "deployment/mc-vanilla",
        "--container",
        "minecraft",
        "--namespace",
        "panel-ns",
        "--tail=99",
      ],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 },
    );
  });

  it("returns an error note instead of throwing when kubectl fails", async () => {
    mocks.exec.mockRejectedValue(new Error("Not found"));
    await expect(getRecentLogs("vanilla", 10)).resolves.toBe(
      "kubectl logs failed: Not found",
    );
  });
});

describe("logFollow", () => {
  it("builds the long-running follow command for the SSE stream", () => {
    expect(logFollow("vanilla")).toEqual({
      cmd: "kubectl",
      args: [
        "logs",
        "deployment/mc-vanilla",
        "--container",
        "minecraft",
        "--namespace",
        "panel-ns",
        "--tail=200",
        "--follow",
        "--pod-running-timeout=60s",
      ],
    });
  });

  it("resolves the namespace at call time, not import time", () => {
    logFollow("vanilla");
    process.env.MCPANEL_K8S_NAMESPACE = "other-ns";
    expect(logFollow("vanilla").args).toContain("other-ns");
  });
});

describe("getVersion", () => {
  it("returns the server's git version", async () => {
    mocks.exec.mockResolvedValue({
      stdout: JSON.stringify({ serverVersion: { gitVersion: "v1.30.4" } }),
    });
    await expect(getVersion()).resolves.toBe("v1.30.4");
  });

  it("degrades to null when the cluster is unreachable or the field is missing", async () => {
    mocks.exec.mockRejectedValue(new Error("forbidden"));
    await expect(getVersion()).resolves.toBeNull();
    mocks.exec.mockResolvedValue({ stdout: "{}" });
    await expect(getVersion()).resolves.toBeNull();
  });
});

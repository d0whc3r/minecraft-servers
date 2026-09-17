// Kubernetes workload mapping: deployments of the panel namespace must become
// the same ContainerInfo/ContainerStats shapes the docker runtime produces —
// scaled-to-zero reads as a stopped container, a not-ready deployment as
// "starting", and stats are percentages against the deployment's own limits.
// The kubectl CLI is stubbed on PATH (same approach as dockerBackend.test.ts).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = Date.UTC(2026, 0, 1);
// workload.ts caches stats for 4s across calls; each test gets its own minute
// on the fake clock so no cache (or limits stash timestamp) leaks between tests.
let clockTick = 0;
let now = BASE;
/** ISO timestamp `ms` before this test's fake "now". */
const ago = (ms: number) => new Date(now - ms).toISOString();

let stubDir: string;
let fixtureDir: string;
const originalPath = process.env.PATH;

function writeFixture(name: string, content: string) {
  fs.writeFileSync(path.join(fixtureDir, name), content);
}

function deployment(name: string, extra: Record<string, unknown> = {}) {
  return {
    metadata: { name },
    spec: { replicas: 1 },
    status: {},
    ...extra,
  };
}

beforeEach(() => {
  clockTick += 1;
  now = BASE + clockTick * 60_000;
  vi.useFakeTimers({ now });

  stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-kubectl-stub-"));
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-kubectl-fix-"));
  const stub = path.join(stubDir, "kubectl");
  fs.writeFileSync(
    stub,
    `#!/bin/sh
if [ -n "$MCPANEL_K8S_FAIL" ]; then
  echo "connection refused" >&2
  exit 1
fi
case "$1" in
  get)
    if [ "$2" = "deployments" ]; then
      cat "$MCPANEL_K8S_FIXTURE_DIR/deployments.json"
    else
      cat "$MCPANEL_K8S_FIXTURE_DIR/deployment-$3.json" 2>/dev/null || exit 1
    fi
    ;;
  top)
    cat "$MCPANEL_K8S_FIXTURE_DIR/top.txt"
    ;;
  *)
    echo "kubectl stub: unexpected args: $*" >&2
    exit 64
    ;;
esac
`,
  );
  fs.chmodSync(stub, 0o755);
  process.env.PATH = `${stubDir}:${process.env.PATH}`;
  process.env.MCPANEL_K8S_FIXTURE_DIR = fixtureDir;
  delete process.env.MCPANEL_K8S_FAIL;
  delete process.env.MCPANEL_K8S_NAMESPACE;
  delete process.env.NAMESPACE;
});

afterEach(() => {
  vi.useRealTimers();
  process.env.PATH = originalPath;
  delete process.env.MCPANEL_K8S_FIXTURE_DIR;
  delete process.env.MCPANEL_K8S_FAIL;
  fs.rmSync(stubDir, { recursive: true, force: true });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

import { getDeployment, getStats, listContainers } from "@/lib/k8s/workload.js";

describe("listContainers", () => {
  it("maps a ready deployment to a healthy running container", async () => {
    writeFixture(
      "deployments.json",
      JSON.stringify({
        items: [
          deployment("mc-ready", {
            metadata: {
              name: "mc-ready",
              creationTimestamp: ago(600_000),
            },
            spec: {
              replicas: 1,
              template: {
                spec: {
                  containers: [
                    { resources: { limits: { cpu: "2", memory: "2Gi" } } },
                  ],
                },
              },
            },
            status: {
              readyReplicas: 1,
              conditions: [{ type: "Ready", lastTransitionTime: ago(60_000) }],
            },
          }),
        ],
      }),
    );

    const map = await listContainers();
    const info = map.get("mc-ready")!;
    expect(info.state).toBe("running");
    expect(info.health).toBe("healthy");
    expect(info.statusText).toBe("Ready 1/1");
    // Uptime comes from the Ready condition, not the deployment age.
    expect(info.uptimeSec).toBeGreaterThanOrEqual(59);
    expect(info.uptimeSec).toBeLessThanOrEqual(61);
  });

  it("maps a desired-but-not-ready deployment to starting", async () => {
    writeFixture(
      "deployments.json",
      JSON.stringify({
        items: [
          deployment("mc-warming-up", {
            metadata: {
              name: "mc-warming-up",
              creationTimestamp: ago(30_000),
            },
            status: { readyReplicas: 0 },
          }),
        ],
      }),
    );

    const map = await listContainers();
    const info = map.get("mc-warming-up")!;
    expect(info.state).toBe("running"); // desired > 0: it is coming up
    expect(info.health).toBe("starting");
    expect(info.statusText).toBe("0/1 ready");
    expect(info.uptimeSec).toBeGreaterThanOrEqual(29);
  });

  it("maps a scale-to-zero deployment to a stopped container", async () => {
    writeFixture(
      "deployments.json",
      JSON.stringify({
        items: [deployment("mc-scaled-to-zero", { spec: { replicas: 0 } })],
      }),
    );

    const map = await listContainers();
    expect(map.get("mc-scaled-to-zero")).toEqual({
      name: "mc-scaled-to-zero",
      state: "exited",
      statusText: "Stopped (scaled to 0)",
      health: null,
      uptimeSec: null,
    });
  });

  it("skips nameless entries and returns an empty map when the cluster is unreachable", async () => {
    writeFixture(
      "deployments.json",
      JSON.stringify({ items: [{ metadata: {} }, deployment("mc-fine")] }),
    );
    expect([...(await listContainers()).keys()]).toEqual(["mc-fine"]);

    process.env.MCPANEL_K8S_FAIL = "1";
    expect((await listContainers()).size).toBe(0);
  });
});

describe("getStats", () => {
  it("computes percentages against each deployment's own limits", async () => {
    writeFixture(
      "deployments.json",
      JSON.stringify({
        items: [
          deployment("mc-ready", {
            spec: {
              replicas: 1,
              template: {
                spec: {
                  containers: [
                    { resources: { limits: { cpu: "2", memory: "2Gi" } } },
                  ],
                },
              },
            },
            status: { readyReplicas: 1 },
          }),
          deployment("mc-millicore-limit", {
            spec: {
              replicas: 1,
              template: {
                spec: {
                  containers: [
                    { resources: { limits: { cpu: "500m", memory: "1Gi" } } },
                  ],
                },
              },
            },
            status: { readyReplicas: 1 },
          }),
          deployment("mc-no-limits", {
            status: { readyReplicas: 1 },
          }),
        ],
      }),
    );
    writeFixture(
      "top.txt",
      [
        "mc-ready           500m   256Mi",
        "mc-millicore-limit 250m   512Mi",
        "mc-no-limits       100m   128Mi",
        "mc-weird-metrics   100m   n/a",
      ].join("\n"),
    );

    await listContainers(); // stashes the limits getStats reads
    const stats = await getStats();

    expect(stats.get("mc-ready")).toEqual({
      cpuPerc: 25, // 500m of a 2-core limit
      memUsed: "256MiB",
      memLimit: "2.00GiB",
      memPerc: 12.5,
    });
    // "500m"-style limits parse as millicores, not cores.
    expect(stats.get("mc-millicore-limit")).toMatchObject({
      cpuPerc: 50,
      memPerc: 50,
    });
    // Without limits the usage cannot be turned into a percentage.
    expect(stats.get("mc-no-limits")).toEqual({
      cpuPerc: 0,
      memUsed: "128MiB",
      memLimit: "?",
      memPerc: 0,
    });
    // Unparseable metrics pass through raw instead of becoming 0 MiB.
    expect(stats.get("mc-weird-metrics")).toMatchObject({
      memUsed: "n/a",
      memPerc: 0,
    });
  });

  it("serves the cached stats map within the TTL without re-querying", async () => {
    writeFixture("deployments.json", JSON.stringify({ items: [] }));
    writeFixture("top.txt", "mc-ready 100m 64Mi");

    await listContainers();
    const first = await getStats();
    const second = await getStats();
    expect(second).toBe(first);
  });

  it("returns an empty map when metrics-server is missing", async () => {
    writeFixture("deployments.json", JSON.stringify({ items: [] }));
    writeFixture("top.txt", "");
    process.env.MCPANEL_K8S_FAIL = "1";
    expect((await getStats()).size).toBe(0);
  });
});

describe("getDeployment", () => {
  it("summarizes replicas, ready-since and resource limits", async () => {
    writeFixture(
      "deployment-mc-ready.json",
      JSON.stringify(
        deployment("mc-ready", {
          metadata: { name: "mc-ready", creationTimestamp: ago(600_000) },
          spec: {
            replicas: 2,
            template: {
              spec: {
                containers: [
                  { resources: { limits: { cpu: "1500m", memory: "6Gi" } } },
                ],
              },
            },
          },
          status: {
            readyReplicas: 1,
            conditions: [{ type: "Ready", lastTransitionTime: ago(45_000) }],
          },
        }),
      ),
    );

    const dep = await getDeployment("ready");
    expect(dep).toMatchObject({
      replicas: 2,
      ready: 1,
      readySince: ago(45_000),
      limits: { cpu: "1500m", memory: "6Gi" },
    });
  });

  it("returns null for a not-deployed server instead of throwing", async () => {
    await expect(getDeployment("ghost")).resolves.toBeNull();
  });
});

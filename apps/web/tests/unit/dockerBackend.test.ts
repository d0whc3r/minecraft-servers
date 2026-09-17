// Unit tests for the docker backend's container-state parsing. The panel must
// read both real Docker's `ps --format '{{json .}}'` output and Podman's
// docker-compatible variant (Names as an array, bare "healthy" status without
// the "Up …" prose, unix StartedAt instead of prose uptime).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listContainers,
  isServerStopped,
  getStats,
  getRecentLogs,
  getDockerVersion,
} from "@/lib/docker.js";

const now = Math.floor(Date.now() / 1000);

// One JSON object per line, exactly like the CLI emits.
const FIXTURE = [
  // Podman shape: array Names, bare status, unix StartedAt
  `{"Names":["mc-podman-run"],"State":"running","Status":"healthy","Image":"itzg","CreatedAt":"c","StartedAt":${now - 600}}`,
  `{"Names":["mc-podman-stopped"],"State":"exited","Status":"healthy","Image":"itzg","CreatedAt":"c","StartedAt":${now - 100000}}`,
  // Real Docker shape: string Names, prose status, no StartedAt
  `{"Names":"mc-docker-run","State":"running","Status":"Up 5 minutes (healthy)","Image":"itzg","CreatedAt":"c"}`,
  `{"Names":"mc-docker-starting","State":"running","Status":"Up 3 seconds (health: starting)","Image":"itzg","CreatedAt":"c"}`,
  `{"Names":"mc-docker-unhealthy","State":"running","Status":"Up 2 hours (unhealthy)","Image":"itzg","CreatedAt":"c"}`,
  `{"Names":"mc-docker-exited","State":"exited","Status":"Exited (0) 2 days ago","Image":"itzg","CreatedAt":"c"}`,
].join("\n");

let stubDir: string;
let workDir: string;
const originalPath = process.env.PATH;

function stubDocker(behavior: "fixture" | "fail") {
  // Emulates `ps --filter name=^/mc-x$`: with a name filter only the matching
  // container is returned (listContainers' `name=mc-` substring filter is a
  // no-op for the fixtures, so unfiltered output is fine there).
  const script =
    behavior === "fixture"
      ? `#!/bin/sh
case "$1" in
  ps)
    name=$(printf '%s\\n' "$*" | sed -n 's/.*name=\\^\\/\\([^$]*\\)\\$.*/\\1/p')
    if [ -n "$name" ]; then
      grep -F "\\"$name\\"" "$MCPANEL_DOCKER_FIXTURE" || true
    else
      cat "$MCPANEL_DOCKER_FIXTURE"
    fi
    ;;
  stats)
    if [ -f "$MCPANEL_DOCKER_STATS_FIXTURE" ]; then
      cat "$MCPANEL_DOCKER_STATS_FIXTURE"
    else
      exit 1
    fi
    ;;
  logs)
    printf 'log line 1\\nlog line 2\\n'
    ;;
  version)
    echo "27.1.1"
    ;;
  *)
    exit 1
    ;;
esac
`
      : "#!/bin/sh\nexit 1\n";
  const file = path.join(stubDir, "docker");
  fs.writeFileSync(file, script);
  fs.chmodSync(file, 0o755);
}

beforeEach(() => {
  stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-docker-stub-"));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-docker-fixture-"));
  fs.writeFileSync(path.join(workDir, "ps.json"), FIXTURE);
  stubDocker("fixture");
  process.env.MCPANEL_DOCKER_FIXTURE = path.join(workDir, "ps.json");
  process.env.PATH = `${stubDir}:${process.env.PATH}`;
});

afterEach(() => {
  process.env.PATH = originalPath;
  delete process.env.MCPANEL_DOCKER_FIXTURE;
  fs.rmSync(stubDir, { recursive: true, force: true });
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe("listContainers (docker + podman output)", () => {
  it("keys containers by name in both output shapes", async () => {
    const map = await listContainers();
    // Regression: Podman's array Names used to become the Map key itself, so
    // every lookup by "mc-<name>" missed and all servers showed as missing.
    expect([...map.keys()].sort()).toEqual([
      "mc-docker-exited",
      "mc-docker-run",
      "mc-docker-starting",
      "mc-docker-unhealthy",
      "mc-podman-run",
      "mc-podman-stopped",
    ]);
  });

  it("parses health from prose statuses and bare podman statuses", async () => {
    const map = await listContainers();
    expect(map.get("mc-docker-run")!.health).toBe("healthy");
    expect(map.get("mc-docker-unhealthy")!.health).toBe("unhealthy");
    // "(health: starting)" never matched the old paren-only regex
    expect(map.get("mc-docker-starting")!.health).toBe("starting");
    expect(map.get("mc-podman-run")!.health).toBe("healthy");
    expect(map.get("mc-docker-exited")!.health).toBeNull();
  });

  it("parses uptime from prose and from podman's StartedAt", async () => {
    const map = await listContainers();
    expect(map.get("mc-docker-run")!.uptimeSec).toBe(300);
    expect(map.get("mc-docker-starting")!.uptimeSec).toBe(3);
    expect(map.get("mc-docker-exited")!.uptimeSec).toBe(2 * 86400);
    const podmanUptime = map.get("mc-podman-run")!.uptimeSec!;
    expect(podmanUptime).toBeGreaterThanOrEqual(595);
    expect(podmanUptime).toBeLessThanOrEqual(605);
  });

  it("returns an empty map when the engine is unreachable", async () => {
    stubDocker("fail");
    const map = await listContainers();
    expect(map.size).toBe(0);
  });

  it("skips unparseable ps lines instead of failing the whole listing", async () => {
    fs.writeFileSync(
      path.join(workDir, "ps.json"),
      [
        '{"Names":"mc-good","State":"running","Status":"Up 1 minute","Image":"itzg","CreatedAt":"c"}',
        "garbage {{{ not json",
        "",
      ].join("\n"),
    );
    const map = await listContainers();
    expect([...map.keys()]).toEqual(["mc-good"]);
    expect(map.get("mc-good")!.uptimeSec).toBe(60);
  });
});

describe("isServerStopped (docker + podman output)", () => {
  it("treats podman's array Names as the container name", async () => {
    await expect(isServerStopped("podman-stopped")).resolves.toBe(true);
    await expect(isServerStopped("podman-run")).resolves.toBe(false);
  });

  it("treats dead containers as stopped", async () => {
    fs.writeFileSync(
      path.join(workDir, "ps.json"),
      '{"Names":["mc-dead"],"State":"dead","Status":"Dead","Image":"i","CreatedAt":"c"}',
    );
    await expect(isServerStopped("dead")).resolves.toBe(true);
  });

  it("propagates malformed responses", async () => {
    fs.writeFileSync(
      path.join(workDir, "ps.json"),
      '{"Names":"mc-x","State":42,"Status":"?"}',
    );
    await expect(isServerStopped("x")).rejects.toThrow(
      "Unexpected Docker container state response",
    );
  });
});

describe("getStats", () => {
  // getStats caches for 4s at module level; each test gets its own minute on
  // the fake clock so no cached map leaks between tests.
  let statsClock = 0;
  const writeStatsFixture = (lines: string[]) =>
    fs.writeFileSync(path.join(workDir, "stats.txt"), lines.join("\n"));

  beforeEach(() => {
    statsClock += 1;
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 1, 0, statsClock) });
  });
  afterEach(() => vi.useRealTimers());

  it("parses stats columns and keeps only mc- containers", async () => {
    writeStatsFixture([
      "mc-web\t10.5%\t100MiB / 2GiB\t5.0%",
      "unrelated-nginx\t90.0%\t1GiB / 4GiB\t25.0%",
      "mc-broken", // no cpu column: unusable row
      "",
    ]);
    process.env.MCPANEL_DOCKER_STATS_FIXTURE = path.join(workDir, "stats.txt");

    const stats = await getStats();
    expect(stats.get("mc-web")).toEqual({
      cpuPerc: 10.5,
      memUsed: "100MiB",
      memLimit: "2GiB",
      memPerc: 5,
    });
    // Usage of non-minecraft containers must never leak into the panel.
    expect(stats.has("unrelated-nginx")).toBe(false);
    expect(stats.has("mc-broken")).toBe(false);
  });

  it("serves the cached map within the TTL instead of shelling out again", async () => {
    writeStatsFixture(["mc-x\t1%\t1MiB / 2MiB\t50%"]);
    process.env.MCPANEL_DOCKER_STATS_FIXTURE = path.join(workDir, "stats.txt");

    const first = await getStats();
    const second = await getStats();
    expect(second).toBe(first);
  });

  it("returns an empty map when docker stats is unavailable", async () => {
    // No stats fixture: the stub's stats branch exits 1.
    const stats = await getStats();
    expect(stats.size).toBe(0);
  });
});

describe("getRecentLogs / getDockerVersion", () => {
  it("returns the raw logs output", async () => {
    await expect(getRecentLogs("mc-vanilla", 50)).resolves.toBe(
      "log line 1\nlog line 2\n",
    );
  });

  it("degrades to empty logs when docker logs fails", async () => {
    stubDocker("fail");
    await expect(getRecentLogs("mc-vanilla", 50)).resolves.toBe("");
  });

  it("trims the engine version", async () => {
    await expect(getDockerVersion()).resolves.toBe("27.1.1");
  });

  it("reports no version when the engine is unreachable", async () => {
    stubDocker("fail");
    await expect(getDockerVersion()).resolves.toBeNull();
  });
});

// Lifecycle actions: runAction resolves the server, picks the repo script for
// the docker runtime (or delegates everything to the k8s backend), enforces
// per-server mutual exclusion, and converts script failures into errors that
// carry the script output. All of that is endpoint-facing behavior.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionType } from "@/lib/actions.js";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  k8sRunAction: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
vi.mock("@/lib/k8s.js", () => ({ runAction: mocks.k8sRunAction }));

// Isolated registry fixture: actions.ts resolves PROJECT_ROOT and the server
// list at import time, so the env must be in place before the dynamic import.
let root: string;

function write(rel: string, content: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const loadActions = () => import("@/lib/actions.js");

beforeEach(() => {
  vi.resetModules();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-actions-"));
  process.env.MCPANEL_ROOT = root;
  write(".env", "RCON_PASSWORD=shared\nMC_ROUTER_DOMAIN=mc.test\n");
  write(
    "config/modpacks/alpha.env",
    "TYPE=PAPER\nVERSION=1.21.1\nRCON_PORT=26565\n",
  );
  delete process.env.MCPANEL_RUNTIME;
  mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
    cb(null, "done", ""),
  );
});

afterEach(() => {
  delete process.env.MCPANEL_ROOT;
  delete process.env.MCPANEL_RUNTIME;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("runAction (docker runtime)", () => {
  it("runs the repo script through bash with the action's timeout budget", async () => {
    const { runAction } = await loadActions();
    const result = await runAction("start", "alpha");

    expect(mocks.execFile).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mocks.execFile.mock.calls[0];
    expect(cmd).toBe("bash");
    expect(args).toEqual(["scripts/start-server.sh", "alpha"]);
    expect(opts.cwd).toBe(path.resolve(root));
    expect(opts.timeout).toBe(5 * 60_000);
    expect(result).toMatchObject({
      ok: true,
      action: "start",
      server: "alpha",
      output: "done",
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("maps each action to its script and budget", async () => {
    const { runAction } = await loadActions();
    const budgets: Array<[ActionType, string, number]> = [
      ["stop", "scripts/stop-server.sh", 3 * 60_000],
      ["restart", "scripts/restart-server.sh", 8 * 60_000],
      ["backup", "scripts/backup.sh", 30 * 60_000],
    ];
    for (const [action, script, timeout] of budgets) {
      mocks.execFile.mockClear();
      await runAction(action, "alpha");
      const [, args, opts] = mocks.execFile.mock.calls[0];
      expect(args).toEqual([script, "alpha"]);
      expect(opts.timeout).toBe(timeout);
    }
  });

  it("passes the backup file and --force to restore (an undo must not ask twice)", async () => {
    const { runAction } = await loadActions();
    await runAction("restore", "alpha", "backups/world-2026.tar.gz");
    expect(mocks.execFile.mock.calls[0][1]).toEqual([
      "scripts/restore.sh",
      "alpha",
      "backups/world-2026.tar.gz",
      "--force",
    ]);
  });

  it("substitutes an empty file when restore is called without one", async () => {
    const { runAction } = await loadActions();
    await runAction("restore", "alpha");
    expect(mocks.execFile.mock.calls[0][1]).toEqual([
      "scripts/restore.sh",
      "alpha",
      "",
      "--force",
    ]);
  });

  it("rejects unknown servers before touching the shell", async () => {
    const { runAction } = await loadActions();
    await expect(runAction("start", "ghost")).rejects.toThrow(
      "Unknown server: ghost",
    );
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("rejects unknown actions even for real servers", async () => {
    const { runAction } = await loadActions();
    await expect(runAction("deploy" as ActionType, "alpha")).rejects.toThrow(
      "Unknown action: deploy",
    );
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("surfaces the script output as the error and keeps its exit code", async () => {
    const { runAction } = await loadActions();
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(
        Object.assign(new Error("bash exited"), { code: 2 }),
        "",
        "boom: world locked",
      ),
    );
    const err = await runAction("stop", "alpha").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom: world locked");
    expect(err.exitCode).toBe(2);
  });

  it("falls back to the exec error message when the script printed nothing", async () => {
    const { runAction } = await loadActions();
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(
        Object.assign(new Error("spawn bash ENOENT"), { code: "ENOENT" }),
        "",
        "",
      ),
    );
    await expect(runAction("stop", "alpha")).rejects.toThrow(
      "spawn bash ENOENT",
    );
  });

  it("reports (no output) for silent successes", async () => {
    const { runAction } = await loadActions();
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(null, "", ""),
    );
    const result = await runAction("start", "alpha");
    expect(result.output).toBe("(no output)");
  });

  it("excludes concurrent actions on the same server, then releases the lock", async () => {
    const { runAction, isActionRunning } = await loadActions();
    let release!: (output: string) => void;
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      release = (output) => cb(null, output, "");
    });

    const first = runAction("restart", "alpha");
    expect(isActionRunning("alpha")).toBe(true);
    await expect(runAction("start", "alpha")).rejects.toThrow(
      "Another action is already running for this server",
    );

    release("restarted");
    await expect(first).resolves.toMatchObject({ output: "restarted" });
    expect(isActionRunning("alpha")).toBe(false);

    // The lock must be gone: a follow-up action on the same server runs.
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(null, "ok", ""),
    );
    await expect(runAction("start", "alpha")).resolves.toMatchObject({
      ok: true,
    });
  });

  it("releases the lock when the script fails", async () => {
    const { runAction, isActionRunning } = await loadActions();
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(Object.assign(new Error("x"), { code: 1 }), "", "fail"),
    );
    await expect(runAction("stop", "alpha")).rejects.toThrow("fail");
    expect(isActionRunning("alpha")).toBe(false);
  });

  it("allows the same action on different servers at once", async () => {
    const { runAction } = await loadActions();
    write("config/modpacks/beta.env", "TYPE=PAPER\n");
    mocks.execFile.mockImplementation((_cmd, _args, _opts, cb) =>
      cb(null, "ok", ""),
    );
    const [a, b] = await Promise.all([
      runAction("start", "alpha"),
      runAction("start", "beta"),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.server).toBe("beta");
  });
});

describe("runAction (kubernetes runtime)", () => {
  it("delegates the whole action to the k8s backend untouched", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    const { runAction } = await loadActions();
    mocks.k8sRunAction.mockResolvedValue({
      ok: true,
      action: "backup",
      server: "alpha",
      output: "job completed",
      durationMs: 42,
    });

    const result = await runAction("backup", "alpha", "manual.tar.gz");

    expect(mocks.k8sRunAction).toHaveBeenCalledWith(
      "backup",
      "alpha",
      "manual.tar.gz",
    );
    expect(result).toMatchObject({ ok: true, output: "job completed" });
    // The bash scripts are a docker-runtime implementation detail.
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("still validates server and action before delegating", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    const { runAction } = await loadActions();
    await expect(runAction("start", "ghost")).rejects.toThrow(
      "Unknown server: ghost",
    );
    expect(mocks.k8sRunAction).not.toHaveBeenCalled();
  });
});

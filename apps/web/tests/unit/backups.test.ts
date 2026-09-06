// Unit tests for backup file resolution (path traversal and charset guards),
// using an isolated MCPANEL_ROOT fixture.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;

beforeEach(() => {
  vi.resetModules();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-backups-"));
  process.env.MCPANEL_ROOT = root;
  // findProjectRoot validates the override against config/modpacks
  fs.mkdirSync(path.join(root, "config", "modpacks"), { recursive: true });
  const dir = path.join(root, "backups", "vanilla");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "vanilla-20260101-000000.tar.gz"), "data");
  fs.writeFileSync(
    path.join(dir, "vanilla-20260101-000000.tar.gz.sha256"),
    "x",
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function loadBackups() {
  return import("@/lib/backups");
}

describe("resolveBackupFile", () => {
  it("resolves an existing file inside the backup dir", async () => {
    const backups = await loadBackups();
    const full = backups.resolveBackupFile(
      "vanilla",
      "vanilla-20260101-000000.tar.gz",
    );
    expect(full).toBe(
      path.join(root, "backups", "vanilla", "vanilla-20260101-000000.tar.gz"),
    );
  });

  it("rejects traversal attempts and weird names", async () => {
    const backups = await loadBackups();
    for (const name of [
      "../.env",
      "..",
      "a/b.tar.gz",
      ".hidden.tar.gz",
      "no spaces.tar.gz",
      "x$y.tar.gz",
      "",
    ]) {
      expect(backups.resolveBackupFile("vanilla", name), name).toBeNull();
    }
  });

  it("rejects names for files that do not exist", async () => {
    const backups = await loadBackups();
    expect(backups.resolveBackupFile("vanilla", "missing.tar.gz")).toBeNull();
    expect(backups.resolveBackupFile("unknown-server", "x.tar.gz")).toBeNull();
  });
});

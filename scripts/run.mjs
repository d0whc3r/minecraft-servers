#!/usr/bin/env node
// run.mjs - Cross-platform script dispatcher.
//
// Runs the PowerShell port (<name>.ps1) on Windows and the bash script
// (<name>.sh) on macOS/Linux. Used by package.json so the same npm/pnpm
// scripts work on every platform.
//
// Usage: node scripts/run.mjs <script-name> [args...]

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const [name, ...rest] = process.argv.slice(2);

if (!name) {
  console.error('Usage: node scripts/run.mjs <script-name> [args...]');
  process.exit(2);
}

// Pick a PowerShell executable: prefer PowerShell 7 (pwsh), fall back to
// Windows PowerShell (powershell), which ships with every Windows install.
function pickPowerShell() {
  const probe = spawnSync(
    'pwsh',
    ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'],
    {
      stdio: 'ignore',
    }
  );
  return !probe.error && probe.status === 0 ? 'pwsh' : 'powershell';
}

let cmd;
let cmdArgs;

if (process.platform === 'win32') {
  const ps1 = join(scriptsDir, `${name}.ps1`);
  cmd = pickPowerShell();
  cmdArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...rest];
} else {
  const sh = join(scriptsDir, `${name}.sh`);
  cmd = 'bash';
  cmdArgs = [sh, ...rest];
}

const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });

if (result.error) {
  console.error(`Failed to run ${name} (${cmd}): ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

#!/usr/bin/env node
// Formats shell scripts with shfmt (WASM). oxfmt does not handle bash, so the
// repo's *.sh files are formatted here as part of `pnpm run lint` / `lint:fix`.
//
// Usage:
//   node scripts/format-shell.mjs            format *.sh in place
//   node scripts/format-shell.mjs --check    report unformatted files, exit 1 if any
//
// shfmt options reproduce the style the scripts are already written in, so
// formatting is a no-op on the existing files. indent=2 matches .editorconfig.

import { format } from '@wasm-fmt/shfmt';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHFMT_OPTIONS = {
  indent: 2,
  binaryNextLine: true,
  switchCaseIndent: true,
  spaceRedirects: true,
};

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.husky',
  'servers',
  'backups',
]);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.sh')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const check = process.argv.includes('--check');
const files = collect(process.cwd());
const unformatted = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const formatted = format(source, file, SHFMT_OPTIONS);
  if (formatted === source) continue;
  if (check) {
    unformatted.push(file);
  } else {
    writeFileSync(file, formatted);
    console.log(`formatted ${file}`);
  }
}

if (check && unformatted.length > 0) {
  console.error('Shell scripts need formatting (run `pnpm run lint:fix`):');
  for (const file of unformatted) console.error(`  ${file}`);
  process.exit(1);
}

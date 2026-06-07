#!/usr/bin/env node
/**
 * build-wiki.mjs — Documentation -> GitHub Wiki pipeline.
 *
 * Copies every Markdown file under docs/ into a GitHub Wiki working copy,
 * rewriting links so they resolve inside the wiki:
 *   - links between docs        -> wiki page slug (no ".md")
 *   - links outside docs/       -> absolute GitHub "blob" URL
 *   - external / anchor links   -> left untouched
 * It also generates Home.md, _Sidebar.md and _Footer.md for navigation.
 *
 * Zero dependencies. Owner/repo are read from package.json (not hardcoded).
 *
 * Usage:
 *   node scripts/build-wiki.mjs [--out <dir>] [--branch <name>] [--clean] [--check]
 *
 *   --out <dir>      Output directory (default: .wiki-build/). The publish
 *                    workflow points this at a clone of the <repo>.wiki.git repo.
 *   --branch <name>  Branch used for blob URLs of non-doc files (default: master).
 *   --clean          Delete *.md at the output root before writing (used by CI so
 *                    deleted docs disappear from the wiki). Never touches .git.
 *   --check          Validate only: build in memory, report dangling links, do
 *                    not write. Exits non-zero if any internal link is broken.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DOCS = join(ROOT, 'docs');

// --- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const OUT = resolve(opt('--out', join(ROOT, '.wiki-build')));
const BRANCH = opt('--branch', 'master');
const CLEAN = argv.includes('--clean');
const CHECK_ONLY = argv.includes('--check');

// --- repo identity ----------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const repoMatch = (pkg.repository?.url || '').match(
  /github\.com[:/]+([^/]+)\/([^/.]+)/
);
if (!repoMatch) {
  console.error(
    'Cannot determine GitHub owner/repo from package.json "repository.url".'
  );
  process.exit(1);
}
const [, OWNER, REPO] = repoMatch;
const BLOB = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}`;

// --- page registry ----------------------------------------------------------
// Top-level docs get explicit, human-friendly names. group drives the sidebar.
const TOP_LEVEL = {
  'QUICKSTART.md': {
    slug: 'Quick-Start',
    title: 'Quick Start',
    group: 'Getting Started',
  },
  'ARCHITECTURE.md': {
    slug: 'Architecture',
    title: 'Architecture',
    group: 'Getting Started',
  },
  'BACKUP_RESTORE.md': {
    slug: 'Backup-and-Restore',
    title: 'Backup & Restore',
    group: 'Operations',
  },
  'MONITORING.md': {
    slug: 'Monitoring',
    title: 'Monitoring',
    group: 'Operations',
  },
  'TROUBLESHOOTING.md': {
    slug: 'Troubleshooting',
    title: 'Troubleshooting',
    group: 'Operations',
  },
  'CI_CD.md': { slug: 'CI-CD', title: 'CI/CD', group: 'Operations' },
  'ADDING_MODPACKS.md': {
    slug: 'Adding-Modpacks',
    title: 'Adding Modpacks',
    group: 'Configuration',
  },
  'ADD_NEW_MODPACK_CONFIG.md': {
    slug: 'Add-New-Modpack-Config',
    title: 'Add New Modpack Config',
    group: 'Configuration',
  },
  'ENVIRONMENT_VARIABLES.md': {
    slug: 'Environment-Variables',
    title: 'Environment Variables',
    group: 'Configuration',
  },
  'FAILED_SERVERS_ANALYSIS.md': {
    slug: 'Failed-Servers-Analysis',
    title: 'Failed Servers Analysis',
    group: 'Reference',
  },
};
const GROUP_ORDER = [
  'Getting Started',
  'Operations',
  'Configuration',
  'Reference',
  'Modpacks',
];

// Display-title overrides for modpacks whose casing/spacing Title Case cannot
// infer (acronyms, version numbers). Keyed by filename base. Slugs stay derived
// from the filename, so overriding a title never breaks link resolution.
const MODPACK_TITLES = {
  rlcraft: 'RLCraft',
  skyfactory4: 'SkyFactory 4',
  'amazing-fps-booster': 'Amazing FPS Booster',
  'solocraft-modpack': 'SoloCraft',
};

const titleCase = (kebab) =>
  kebab
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

// Discover sources: top-level docs + flattened modpack guides.
const sources = [];
for (const [file, meta] of Object.entries(TOP_LEVEL)) {
  const abs = join(DOCS, file);
  if (existsSync(abs)) sources.push({ abs, rel: `docs/${file}`, ...meta });
  else console.warn(`! listed doc not found, skipping: docs/${file}`);
}
const modpackDir = join(DOCS, 'modpacks');
if (existsSync(modpackDir)) {
  for (const file of readdirSync(modpackDir)
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const base = basename(file, '.md');
    const derived = titleCase(base);
    sources.push({
      abs: join(modpackDir, file),
      rel: `docs/modpacks/${file}`,
      slug: 'Modpack-' + derived.replace(/ /g, '-'),
      title: MODPACK_TITLES[base] || derived,
      group: 'Modpacks',
    });
  }
}

// Resolution map: absolute source path -> page meta (for link rewriting).
const byAbs = new Map(sources.map((s) => [resolve(s.abs), s]));
const slugSet = new Set(sources.map((s) => s.slug));

// --- link rewriting ---------------------------------------------------------
const warnings = [];
let rewriteCount = 0;
let blobCount = 0;

const splitHash = (u) => {
  const i = u.indexOf('#');
  return i < 0 ? [u, ''] : [u.slice(0, i), u.slice(i + 1)];
};
const toPosix = (p) => p.split('\\').join('/');

function rewriteTarget(url, fromAbs) {
  if (/^(https?:|mailto:|tel:|ftp:|#|\/\/)/i.test(url)) return null; // external / anchor
  const [path, frag] = splitHash(url);
  if (!path) return null;
  const targetAbs = resolve(dirname(fromAbs), decodeURIComponent(path));
  const hit = byAbs.get(targetAbs);
  if (hit) {
    rewriteCount++;
    return hit.slug + (frag ? `#${frag}` : '');
  }
  const relFromRoot = relative(ROOT, targetAbs);
  if (!relFromRoot.startsWith('..') && existsSync(targetAbs)) {
    blobCount++;
    return `${BLOB}/${toPosix(relFromRoot)}${frag ? `#${frag}` : ''}`;
  }
  warnings.push(
    `${relative(ROOT, fromAbs)}: unresolved link "${url}" (left as-is)`
  );
  return null;
}

// [text](url "title") and ![alt](url) — skips fenced code blocks.
const LINK_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;

function transform(content, fromAbs) {
  const out = [];
  let inFence = false;
  let fenceChar = '';
  for (const line of content.split('\n')) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (line.trim().startsWith(fenceChar)) {
        inFence = false;
      }
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(
      line.replace(LINK_RE, (full, bang, text, url, title) => {
        const next = rewriteTarget(url, fromAbs);
        return next === null ? full : `${bang}[${text}](${next}${title || ''})`;
      })
    );
  }
  return out.join('\n');
}

function banner(rel) {
  return (
    `> 🤖 _This page is auto-generated from [\`${rel}\`](${BLOB}/${rel}). ` +
    `Edit the source file in the repository — changes made directly in the wiki are overwritten._\n\n`
  );
}

// --- navigation pages -------------------------------------------------------
const groups = () => {
  const g = {};
  for (const s of sources) (g[s.group] ||= []).push(s);
  for (const k of Object.keys(g))
    g[k].sort((a, b) => a.title.localeCompare(b.title));
  return g;
};

function buildSidebar() {
  const g = groups();
  const lines = ['### 📚 Documentation', '', '- [Home](Home)'];
  for (const group of GROUP_ORDER) {
    if (!g[group]) continue;
    lines.push('', `**${group}**`);
    for (const s of g[group]) lines.push(`- [${s.title}](${s.slug})`);
  }
  lines.push(
    '',
    '---',
    `[⬅ Back to repository](https://github.com/${OWNER}/${REPO})`
  );
  return lines.join('\n') + '\n';
}

function buildHome() {
  const g = groups();
  const h1 = (readFileSync(join(ROOT, 'README.md'), 'utf8').match(
    /^#\s+(.+)$/m
  ) || [, REPO])[1];
  const lines = [
    `# 📖 ${h1} — Wiki`,
    '',
    pkg.description || '',
    '',
    `> This wiki is **auto-generated** from the [\`docs/\`](${BLOB}/docs) folder of the ` +
      `[repository](https://github.com/${OWNER}/${REPO}). Edit the source files there, not the wiki.`,
    '',
    '## Contents',
  ];
  for (const group of GROUP_ORDER) {
    if (!g[group]) continue;
    lines.push('', `### ${group}`);
    for (const s of g[group]) lines.push(`- [${s.title}](${s.slug})`);
  }
  return lines.join('\n') + '\n';
}

function buildFooter() {
  return (
    `_📖 [Wiki Home](Home) · ` +
    `[Repository](https://github.com/${OWNER}/${REPO}) · ` +
    `[Issues](https://github.com/${OWNER}/${REPO}/issues)_\n`
  );
}

// --- build ------------------------------------------------------------------
const pages = sources.map((s) => ({
  slug: s.slug,
  body: banner(s.rel) + transform(readFileSync(s.abs, 'utf8'), resolve(s.abs)),
}));
pages.push({ slug: 'Home', body: buildHome() });
pages.push({ slug: '_Sidebar', body: buildSidebar() });
pages.push({ slug: '_Footer', body: buildFooter() });

// Validate: every wiki-internal link must point at a slug we generated.
const KNOWN = new Set([...slugSet, 'Home', '_Sidebar', '_Footer']);
const dangling = [];
const leftoverMd = [];
for (const p of pages) {
  for (const m of p.body.matchAll(LINK_RE)) {
    const url = m[3];
    if (/^(https?:|mailto:|tel:|ftp:|#|\/\/)/i.test(url)) continue;
    const slug = splitHash(url)[0];
    if (slug.endsWith('.md')) leftoverMd.push(`${p.slug}.md -> ${url}`);
    else if (slug && !KNOWN.has(slug)) dangling.push(`${p.slug}.md -> ${url}`);
  }
}

// --- report -----------------------------------------------------------------
console.log(`Wiki build (${OWNER}/${REPO}@${BRANCH})`);
console.log(
  `  pages:            ${pages.length} (${sources.length} docs + Home/_Sidebar/_Footer)`
);
console.log(`  internal links:   ${rewriteCount} rewritten to wiki slugs`);
console.log(`  external repo:     ${blobCount} rewritten to blob URLs`);
if (warnings.length) {
  console.log(`  unresolved links: ${warnings.length}`);
  for (const w of warnings) console.log(`    - ${w}`);
}
let failed = false;
if (leftoverMd.length) {
  failed = true;
  console.error(`  ✗ ${leftoverMd.length} link(s) still point to ".md" files:`);
  for (const l of leftoverMd) console.error(`    - ${l}`);
}
if (dangling.length) {
  failed = true;
  console.error(`  ✗ ${dangling.length} dangling internal link(s):`);
  for (const l of dangling) console.error(`    - ${l}`);
}

if (CHECK_ONLY) {
  console.log(failed ? '✗ check failed' : '✓ check passed (no write)');
  process.exit(failed ? 1 : 0);
}
if (failed) {
  console.error('✗ refusing to write: fix the broken links above');
  process.exit(1);
}

// --- write ------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
if (CLEAN) {
  for (const f of readdirSync(OUT).filter((f) => f.endsWith('.md')))
    rmSync(join(OUT, f));
}
for (const p of pages) writeFileSync(join(OUT, `${p.slug}.md`), p.body);
console.log(`✓ wrote ${pages.length} pages to ${relative(ROOT, OUT) || OUT}`);

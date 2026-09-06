# Web Panel — minecraft-servers

Browser panel to visualize and manage the Minecraft (Docker) servers in this
repository. Built with **Astro + React + Tailwind CSS** (SSR via the Node
adapter) and part of the pnpm workspace (`apps/web`).

- **Visualization** (`/`): live status of every configured server — running
  state, players, RAM, CPU, uptime, ping, health. Public by default
  (configurable).
- **Admin** (`/admin`): protected with user and password — start/stop/restart,
  backups (create/restore/download), live RCON console and logs, host
  information.

## Requirements

- Node.js 20+ and pnpm
- Docker reachable from wherever the panel runs (user in the `docker` group)
- Run it on the same machine as the servers (it shells out to `docker` and to
  the scripts in `scripts/`)
- For the e2e suite only: Google Chrome installed on the host

## Quick start

```bash
pnpm install                      # from the repo root (workspace install)
pnpm --filter @minecraft-servers/web build
pnpm --filter @minecraft-servers/web start   # serves http://localhost:4321
```

Development with hot reload:

```bash
pnpm web:dev
```

To serve it on your LAN:

```bash
PORT=3777 HOST=0.0.0.0 pnpm --filter @minecraft-servers/web start   # → http://<server-ip>:3777
```

## Run in Docker (recommended)

The image is a multi-stage build; the container joins the `minecraft-network`
bridge, reaches mc-router and each `mc-<server>` container by DNS, publishes
only the web UI, and mounts the repo checkout plus the Docker socket so it can
run the management scripts.

**From the repo root** (simplest — it also sets `MCPANEL_HOST_ROOT` for you,
see [Starting servers from the panel](#starting-servers-from-the-panel)):

```bash
pnpm run panel:start
```

Or with plain compose:

```bash
cd apps/web
cp .env.example .env       # set the admin credentials (MCPANEL_USER/PASSWORD)
MCPANEL_HOST_ROOT=$PWD/../../ docker compose up -d --build
```

The UI is then on `http://<host>:3777` (change with `PANEL_PORT` in
`apps/web/.env`). Requirements: the `minecraft-network` bridge exists (it is
created the first time any server starts) and the `minecraft-router` container
is running — `./scripts/router.sh start`.

### Starting servers from the panel

The panel's Start/Stop/Restart buttons run this repo's own scripts
(`scripts/start-server.sh`, …) **inside the panel container**, and those
scripts hand the bind-mount directories (`servers/<name>/data`,
`backups/<name>/`, …) to the host's Docker daemon. The daemon only
understands **host paths**, but the checkout is mounted at `/repo` inside the
container — a path that does not exist on the host. `MCPANEL_HOST_ROOT`
bridges the gap: it tells the scripts where the repo lives on the host
(`pnpm run panel:start` sets it to the directory you launch from). Without
it, starting a server fails with
`mounts denied: The path /repo/... is not shared from the host`.

Admin credentials in Docker work exactly like a native run:

- Set `MCPANEL_USER` / `MCPANEL_PASSWORD` in `apps/web/.env` before the first
  `docker compose up -d` — that pins them.
- Leave `MCPANEL_PASSWORD` empty and the panel generates one on first boot;
  read it with `docker compose logs panel` (printed once).
- Credentials persist in the `mc-panel-data` volume, so they survive image
  updates and container recreation.
- **Change the password:** edit `MCPANEL_PASSWORD` in `apps/web/.env` then
  `docker compose up -d --force-recreate`. Or wipe everything (credentials +
  sessions) with `docker compose down -v && docker compose up -d --build`.

Trust note: the panel mounts the Docker socket and the repo checkout — it can
manage every container and file on this host. Keep it off the public internet
(or behind HTTPS auth) — see [Security](#security).

## Admin credentials

- **First boot:** if no credentials exist yet, the panel generates a random
  12-character password for the `admin` user and prints it **once to the server
  console**, next to the panel banner:

  ```
  ┌──────────────────────────────────────────────────────┐
  │  Minecraft Servers admin panel                       │
  │  User: admin                                         │
  │  Generated password: 4916cfe2a1b3                      │
  │  (store it now, or set MCPANEL_PASSWORD instead)     │
  └──────────────────────────────────────────────────────┘
  ```

  Launch it with `pnpm --filter @minecraft-servers/web start` in a terminal (or read your service's log,
  e.g. `journalctl` / `docker logs`) right after the first start to copy the
  password.

- **Where they live:** credentials are stored hashed (scrypt) in
  `auth.json` next to the session signing key `secret.key` — in
  `apps/web/data/` for native runs, or in the `mc-panel-data` volume
  (`/data` inside the container) when running in Docker. The password itself
  is never stored in plain text.

### Changing the admin password

Pick whichever fits:

```bash
# 1. Set explicit credentials through the environment (recommended).
#    Restart the panel afterwards; the env value wins over auth.json.
MCPANEL_USER=myadmin MCPANEL_PASSWORD='a long passphrase' pnpm --filter @minecraft-servers/web start

# 2. Regenerate a random password: wipe the data dir and restart.
#    A new password is printed to the console on the first request.
#    (Also invalidates all current browser sessions.)
rm -rf apps/web/data
pnpm --filter @minecraft-servers/web start

# 3. Change the password but keep the session key (browser sessions
#    stay signed in): regenerate only auth.json, then restart.
rm apps/web/data/auth.json
MCPANEL_PASSWORD='new-pass' pnpm --filter @minecraft-servers/web start
```

Other useful facts:

- Sessions last **24 h** (HMAC-signed cookie, `HttpOnly`, `SameSite=Lax`).
- Sign-in is rate limited: **8 failed attempts per IP every 10 minutes**.
- `MCPANEL_PUBLIC_VIEW=false` locks the dashboard behind the login too.
- Forgot the password and lost the console log? Just `rm -rf apps/web/data`
  and restart — a new one is generated.

## Daily use

| Task                      | Where                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| See what's running        | `/` — cards refresh every 5 s; filter or search                   |
| Start / stop a server     | `/admin` → row buttons, or the card on the dashboard              |
| **Create a new server**   | `/admin` → **+ New server** (type, version, memory, modpack URL…) |
| Watch server logs live    | `/admin` → **Logs** (SSE stream of `docker logs -f`)              |
| Run a server command      | `/admin` → **Console** (RCON; no leading slash, e.g. `list`)      |
| Create / restore a backup | `/admin` → **Backups** (restores require typing a confirm)        |
| Host health               | `/admin` → **System** (RAM, disk, CPU, Docker version)            |

### Creating servers from the panel

**+ New server** writes a regular itzg env file (`TYPE`, `VERSION`,
`MEMORY`, `SERVER_NAME`, a free `RCON_PORT` from the managed range, …) and
the server joins the table on the next status poll — no panel restart, and
you can start it right away from the same dialog. Where the file lands:

- **Docker runtime**: `config/modpacks/<name>.env` — the same catalog the CLI
  (`scripts/add-modpack.sh`) uses, so it is visible to git and every script.
- **Kubernetes runtime**: `<MCPANEL_DATA_DIR>/servers/<name>.env` (the PVC
  backed panel data), because the catalog mounts read-only from a ConfigMap.

Panel-created servers are marked **custom** in the table and can be removed
with **Delete** (stopped servers only; world data and backups on disk are
kept). Catalog servers from the repo are never deletable from the panel.

## Configuration (environment variables)

| Variable                 | Default         | Description                                                                                                              |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                   | `4321`          | HTTP port of the panel                                                                                                   |
| `HOST`                   | `0.0.0.0`       | Listen interface (`127.0.0.1` for local-only access)                                                                     |
| `MCPANEL_USER`           | `admin`         | Admin username                                                                                                           |
| `MCPANEL_PASSWORD`       | (generated)     | Admin password; if unset, one is generated and printed once                                                              |
| `MCPANEL_PUBLIC_VIEW`    | `true`          | `false` → the dashboard requires sign-in too                                                                             |
| `MCPANEL_SECURE_COOKIES` | `false`         | `true` when serving the panel behind HTTPS                                                                               |
| `MCPANEL_TRUST_PROXY`    | `false`         | `true` behind a reverse proxy: login throttling then keys on the proxy-forwarded client IP                               |
| `MCPANEL_ROOT`           | (auto)          | Repo root override if auto-detection fails                                                                               |
| `MCPANEL_HOST_ROOT`      | (unset)         | Repo path **on the host** — needed for start/stop from the containerized panel ([why](#starting-servers-from-the-panel)) |
| `MCPANEL_DATA_DIR`       | `apps/web/data` | Where `auth.json`, `secret.key` and panel-created servers live                                                           |
| `MCPANEL_RUNTIME`        | `docker`        | `kubernetes` → actions use helm/kubectl instead of the repo scripts ([Kubernetes](../../docs/KUBERNETES.md))             |
| `MCPANEL_K8S_NAMESPACE`  | `default`       | (kubernetes runtime) namespace where the `mc-<server>` releases are managed                                              |
| `MCPANEL_CHARTS_DIR`     | `<root>/charts` | (kubernetes runtime) location of the `minecraft-server` chart                                                            |
| `MCPANEL_K8S_JOB_IMAGE`  | `alpine:3.20`   | (kubernetes runtime) image for one-off backup/restore Jobs                                                               |

## Kubernetes runtime

With `MCPANEL_RUNTIME=kubernetes` (the `charts/web-panel` chart sets it
automatically) the panel drives the cluster instead of Docker: every
start/stop from the UI maps to `helm upgrade --install mc-<server>` /
`--set replicaCount=0` of `charts/minecraft-server`, logs come from
`kubectl logs`, backups/restore run as short Jobs mounting the server's PVCs,
and RCON goes to the server's in-cluster Service. Full guide:
[docs/KUBERNETES.md](../../docs/KUBERNETES.md).

## How it works

- The server list comes from `config/modpacks/*.env` plus any servers created
  from the panel (titles and descriptions from `docs/modpacks/*.md`) — there
  is no duplicated list to maintain.
- **mc-router only**: there are no per-server game ports. Players (and the
  panel's status ping) go through the single mc-router entry point
  (`MC_ROUTER_PORT`, default `25565`) using each server's routed hostname
  `<server>.<MC_ROUTER_DOMAIN>`. The panel shows that address as the
  **Connect** value on every card/row (click to copy).
- Live status: `docker ps` / `docker stats` plus a Server List Ping through
  mc-router with the routed hostname (exactly what a player does), with an
  RCON `list` fallback on the per-server RCON port (loopback natively,
  container DNS `mc-<server>` when the panel runs containerized).
- Actions (start/stop/restart/backup/restore) **reuse the repo scripts in
  `scripts/`** — same behavior as the CLI, with one action at a time per
  server.
- Live logs stream over SSE (`docker logs -f`); the RCON console uses a small
  built-in client (no extra dependencies).
- Backups: list, download and restore from `backups/<server>/` with file-name
  validation against path traversal.

See `docs/ROUTER.md` for the routing setup (`MC_ROUTER_DOMAIN`,
`MC_ROUTER_DEFAULT`, nip.io, …).

## Security

Authorization is enforced centrally in `src/middleware.ts` (single choke point,
impossible to bypass by adding a new route):

- **Public API surface is an explicit allowlist**: `POST /api/auth/login`,
  `GET /api/auth/me`, `POST /api/auth/logout` and (unless
  `MCPANEL_PUBLIC_VIEW=false`) `GET /api/status`. **Every other `/api/*`
  route requires a valid session and answers `401` otherwise.**
- **Mutating API calls need the `x-mcpanel: 1` header** (CSRF mitigation)
  plus Astro's origin check for form posts.
- `/admin` renders only the sign-in shell to anonymous visitors — every piece
  of admin data lives behind the gated API; the dashboard redirects to the
  sign-in shell when `MCPANEL_PUBLIC_VIEW=false`.
- Individual routes keep their own `guardAuth`/`guardCsrf` checks as defense
  in depth.
- Hardening headers on every response: `X-Frame-Options: DENY`, CSP
  (`frame-ancestors 'none'`), `nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy`.
- Password hashed with scrypt; HMAC-SHA256 signed sessions (stateless — no
  storage lookup per request); `HttpOnly` `SameSite=Lax` cookie, 24 h TTL.
- Login rate limiting: 8 failed attempts per 10 minutes per IP. The IP is
  the socket address; `X-Forwarded-For` is only honored with
  `MCPANEL_TRUST_PROXY=true` (otherwise a client could spoof it to dodge
  the limit).
- Secrets (`RCON_PASSWORD`, `CF_API_KEY`, …) are masked in the config view.
- `apps/web/data/` (credentials and signing key) is not version controlled.

Credential/bootstrap state is memoized per process, so authorization checks
after the first request cost one in-memory HMAC — no filesystem or database
lookups. Changing credentials requires a panel restart.

If you expose the panel beyond your LAN, put it behind an HTTPS reverse proxy
(`MCPANEL_SECURE_COOKIES=true`) or bind `HOST=127.0.0.1` and reach it through
an SSH tunnel.

## Testing

Everything runs inside `apps/web` (or through the root `web:*` scripts).

```bash
# Unit tests (Vitest): libs and API guards, no Docker or network needed
pnpm web:test
pnpm --filter @minecraft-servers/web test:watch   # watch mode

# E2E tests (Playwright, real browser)
# Builds and boots the real panel on :4599 with throwaway credentials and an
# isolated data dir; never touches production data or runs server actions.
pnpm --filter @minecraft-servers/web test:e2e
```

- Unit tests cover: byte/uptime/time formatters, the auth module (bootstrap,
  scrypt verification, session signing + expiry, rate limiting), the server
  registry (env merging, platforms, secret masking), backup path-traversal
  guards, the Minecraft Server List Ping (against a fake status server), the
  RCON client (against a fake RCON server) and the API route guards.
- E2E tests cover: public dashboard rendering, public status API, login
  (rejection + success), servers table, logs modal, backups empty state,
  system tab and sign-out. They deliberately do **not** click start/stop or
  restore actions.
- E2E artifacts (`test-results/`, `playwright-report/`, `test-e2e-data/`) are
  gitignored.

## Structure

```
apps/web/
├── src/
│   ├── lib/          # server logic: docker, MC ping, RCON, auth, backups
│   ├── pages/api/    # REST endpoints (Astro API routes)
│   ├── components/   # React islands (Dashboard, AdminApp) + reusable UI kit
│   ├── layouts/      # Layout.astro (shared header and footer)
│   ├── styles/       # global.css (Tailwind v4 entry + @theme tokens)
│   └── middleware.ts # access control + first-boot credential bootstrap
├── tests/
│   ├── unit/         # Vitest suites
│   └── e2e/          # Playwright specs
├── Dockerfile        # multi-stage build (node + docker CLI + compose plugin)
├── docker-compose.yml# container deploy (joins minecraft-network)
├── data/             # credentials and session key (gitignored)
└── dist/             # production build (gitignored)
```

# Changelog

All notable changes to the Minecraft Multi-Server System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Minecraft Multi-Server System
- Support for 14+ pre-configured modpacks
- Automated backup system with integrity verification
- Health monitoring and auto-restart capabilities
- Template-based Docker Compose orchestration
- Comprehensive management scripts
- GitHub Actions CI/CD pipeline with parallel testing
- Extensive documentation and guides
- 6 new top-downloaded servers: `better-mc-bmc4`, `prominence-2`, `pixelmon`,
  `deceasedcraft`, `cursed-walking` and `all-the-mods-10-sky`
- 7 new trending servers (2026 community picks): `stoneblock4` (FTB StoneBlock 4),
  `dawncraft`, `better-mc-bmc5`, `all-the-mods-11`, `homestead`,
  `zombie-invade-100-days` and `cobblemon`
- New `add-modpack.sh` templates (`bmc4`, `pixelmon`, `atm10sky`, `deceasedcraft`,
  `cursed-walking`) with Modrinth template support
- **mc-router single entry point**: all servers sit behind `itzg/mc-router`
  (`docker-compose.router.yml`, managed by `./scripts/router.sh`); players connect
  once to `MC_ROUTER_PORT` (25565) and routes are chosen by hostname
  (`<server>.<MC_ROUTER_DOMAIN>`, auto-discovered from container labels).
  [nip.io](https://nip.io) (`MC_ROUTER_DOMAIN=<lan-ip>.nip.io`) is the recommended
  no-domain setup for LAN/remote play — zero DNS or hosts-file configuration;
  `router.sh start/status` prints the exact nip.io domain to use
- Router deployment aligned with the upstream `itzg/mc-router` README: host
  timezone (`TZ`) passed for local log timestamps, `router.sh routes` sends the
  documented `Accept: application/json` header, socket-group docs use
  `stat -c '%g' /var/run/docker.sock`, and `docs/ROUTER.md` now documents the
  built-in scanner rate-limit, the full REST API, and unused-but-available
  features (multi-hostname labels, webhooks, metrics, Docker auto-scaling)
- Router settings in `.env` (`MC_ROUTER_DOMAIN`, `MC_ROUTER_PORT`,
  `MC_ROUTER_API_PORT`, `MC_ROUTER_DOCKER_GID` — see `.env.example` and
  `docs/ROUTER.md`)
- **Terminal UI**: `./scripts/tui.sh` (or `pnpm tui`) builds and launches `mc-tui`,
  a Go/Bubble Tea dashboard to start, stop, restart, back up, filter servers,
  follow container logs and open an RCON console — reusing the management
  scripts; headless output available via `bin/mc-tui --dump table|json`.
  Source lives in `apps/tui` as a pnpm workspace package (`@minecraft-servers/tui`)
- **pnpm workspace**: root `pnpm-workspace.yaml` now groups `apps/*` (the TUI)
  and `web` (the Astro management panel) into a single workspace

### Changed

- **CI pipeline split by cost**: the fast BATS suite (`tests/bats/config-validation.bats`,
  no server startup) now runs on every push/PR in `bats-tests.yml`; the heavy
  end-to-end startup test (`tests/bats/server-startup.bats`, `US1-TC007`) moved
  to a manual `e2e-tests.yml` workflow. All workflow shell logic was extracted
  from the YAML into `scripts/ci/` (`load-config.sh`, `generate-test-matrix.sh`,
  `pull-minecraft-images.sh`, `generate-summary.sh`, `create-test-env.sh`,
  `filter-modpacks.sh`) so the pipeline logic is versioned and testable like
  any other script
- `pnpm run test:quick` and `make test-sh` run the full fast suite
  (`config-validation.bats`) instead of a name filter over the old monolithic file
- **Web panel tables on TanStack Table v9**: `DataTable` now declares features,
  row models and filter-fn registries up front (`tableFeatures`/`useTable`) and
  exports a `DataTableColumn` type; Dashboard and AdminApp adopt it
- Root `package.json` trimmed: dead `docker:*`, `ci`, `test:verbose`,
  `dev:setup`, `backup:all` and redundant `web:*`/`tui:build` filters removed
  (use the workspace filter or `scripts/tui.sh` directly); engines now require
  pnpm >= 10
- **Router-only architecture**: all game traffic goes through mc-router, always.
  The per-server `SERVER_PORT` variable is gone from every config — servers have
  no game port at all, and `RCON_PORT` (unique, managed range 26565-26664,
  loopback-only) is the only per-server port left. `add-modpack.sh` auto-assigns
  `RCON_PORT` directly (`--rcon-port=` replaces `--port=`)
- mc-router is mandatory infrastructure: `MC_ROUTER_ENABLED` and
  `MC_ROUTER_PUBLISH_PORTS` (hybrid mode) were removed along with
  `docker-compose.published-ports.yml`; there is no direct `IP:port` access
- [nip.io](https://nip.io) (`MC_ROUTER_DOMAIN=<lan-ip>.nip.io`) is the recommended
  setup without an own domain: zero DNS or hosts-file configuration for LAN/remote
  players; `router.sh start/status` prints the exact domain to use
- Legacy dead settings removed from `.env.example` (`BASE_PORT`, `NETWORK_NAME`,
  `COMPOSE_PROJECT_NAME` — none were read by the scripts)
- RCON ports are bound to `127.0.0.1` — host-local admin only, not exposed to the network
- `list-servers.sh` shows the route hostname as the connection address and includes
  `route` in JSON output (the `port` field is gone); `add-modpack.sh` prints the
  new server's route
- Verified every server against live CurseForge/Modrinth/Paper/Mojang APIs (2026-09-06)
- `my-hero-adventure`: corrected MC version 1.12.2 → 1.16.5 (the pack's only
  release, MHA-1.0.0, targets 1.16.5)
- `unofficial-dragon-block-c`: corrected MC version 1.12.2 → 1.7.10 (Dragon
  Block C is a 1.7.10 mod; latest pack 4.1.25)
- `solo-leveling-reawakening`: MC 1.20.1 → 1.21.1 (SLR 1.7.7 moved to
  NeoForge 1.21.1)
- `slimes-adventure`: MC 1.19.2 (Forge) → 1.21.1 (Fabric); modpack 1.13.x
  dropped Forge
- `vanilla`: Paper 1.20.4 → 26.2 (latest stable Mojang/Paper release)
- Modpack files without an explicit pin (`CF_FILE_ID` / `MODRINTH_MODPACK_VERSION`)
  auto-download the latest release on start; verified pins for
  `plants-vs-zombies` (3.2.0) and `deceasedcraft` (5.10.17) point at the
  current latest

### Deprecated

- N/A

### Removed

- `SERVER_PORT` from every server config — game traffic has no per-server port
- `MC_ROUTER_ENABLED`, `MC_ROUTER_PUBLISH_PORTS` and
  `docker-compose.published-ports.yml` — the router always runs and game ports
  are never published
- CI `prepare-images` job and Docker-image/server-data caches — the image cache
  was never shared between jobs of the same run, and cached world data risked
  stale-state false positives; E2E runners now pull the tags they need
  (`scripts/ci/pull-minecraft-images.sh`) and always start from clean data
- Dead keys in `.github/workflows/config` (`CHUNK_STRATEGY`, `CACHE_*`,
  `ARTIFACT_RETENTION_DAYS`, `ENABLE_DEBUG_LOGS`, `VERBOSE_TEST_OUTPUT` — none
  were read by any workflow)

### Fixed

- `start-server.sh` now exports `RCON_PORT` to Docker Compose so each server binds
  its own RCON port (`SERVER_PORT + 1000`) instead of every server colliding on 25575
- `add-modpack.sh` writes a valid `SERVER_NAME` (server slug, not the display name)
  and includes `RCON_PORT` in generated configs

### Security

- N/A

## [1.0.0] - 2025-11-10

### Added

- Complete Docker-based multi-server system
- Pre-configured modpacks from CurseForge and Modrinth
- Automated backup and restore functionality
- Health monitoring with auto-restart
- Comprehensive validation and troubleshooting tools
- GitHub Actions CI/CD with parallel testing
- Full documentation suite
- MIT License
- Contributing guidelines and code of conduct

### Technical Details

- Template-based orchestration supporting unlimited servers
- Isolated server configurations and data
- BATS testing framework integration
- pnpm dependency management
- Docker Compose v2 compatibility
- Bash 4.0+ script compatibility

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Version Format

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

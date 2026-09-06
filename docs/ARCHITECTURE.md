# Architecture Overview

This document describes how the minecraft-servers system works internally: the
template-based orchestration pattern, the environment layering, and the lifecycle of a
server from script call to running container.

## Core Design Principles

### 1. Template-Based Orchestration

**Problem**: Traditional Docker Compose multi-server setups require editing the compose
file for each new server, leading to configuration drift, duplicated service definitions,
and manual port management.

**Solution**: a **single service template** instantiated once per server. Each server runs
as its own Compose project (`-p mc-<name>`) created from the same `docker-compose.yml`,
parameterized entirely by environment variables:

```yaml
# docker-compose.yml — the only service definition in the whole system
services:
  minecraft-server:
    image: itzg/minecraft-server:${JAVA_VERSION:-latest}
    container_name: ${CONTAINER_NAME:-mc-server}
    env_file:
      - .env # 1) shared defaults
      - ${SERVER_CONFIG_FILE} # 2) per-server overrides (config/modpacks/<name>.env)
    labels:
      - 'mc-router.host=${SERVER_NAME}.${MC_ROUTER_DOMAIN}' # player route
    ports:
      - '127.0.0.1:${RCON_PORT:-25575}:${RCON_PORT:-25575}' # RCON, loopback only
    environment:
      SERVER_PORT: 25565 # inside the container it is always 25565; mc-router routes to it
    volumes:
      - ${SERVER_DATA_DIR:-./data}:/data
      - ${SERVER_MODS_DIR:-./mods}:/mods
      - ${SERVER_BACKUP_DIR:-./backups}:/backups
    networks:
      - minecraft-network # external, shared by all servers
    stdin_open: true
    tty: true
    healthcheck:
      test: mc-health
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5m
```

The substitution variables (`CONTAINER_NAME`, `SERVER_CONFIG_FILE`, `SERVER_NAME`,
`MC_ROUTER_DOMAIN`, `RCON_PORT`, `JAVA_VERSION`, `SERVER_*_DIR`) are computed by `scripts/common.sh` for each
server before invoking `docker compose -p mc-<name> up -d`.

**Benefits**:

- ✅ Zero compose file changes when adding servers
- ✅ Isolated per-server configuration and data
- ✅ Unique container names (`mc-<name>`) and Compose projects (`mc-<name>`) prevent collisions
- ✅ Per-server Java version via the image tag (`itzg/minecraft-server:java8|java11|java17|java21|java25|latest`)
- ✅ Unlimited horizontal scaling (bounded only by host resources)

### 2. Environment-Driven Configuration

Configuration is layered. Later sources override earlier ones:

```
.env.example → copied to .env (shared, git-ignored)
│   EULA, NETWORK_NAME, BASE_PORT, COMPOSE_PROJECT_NAME,
│   CF_API_KEY, ENABLE_RCON, RCON_PASSWORD, USE_AIKAR_FLAGS, ...
│
config/modpacks/<name>.env (per server, committed)
    TYPE, VERSION, MEMORY, SERVER_NAME, RCON_PORT,
    modpack source (CF_PAGE_URL / MODRINTH_MODPACK), gameplay tuning, ...
│
docker compose substitution (computed by scripts/common.sh, never edited)
    CONTAINER_NAME, SERVER_CONFIG_FILE, SERVER_NAME, MC_ROUTER_DOMAIN,
    RCON_PORT, JAVA_VERSION, SERVER_DATA_DIR, SERVER_MODS_DIR, SERVER_BACKUP_DIR
```

\* `RCON_PORT` is read from the server config file — the only per-server port
(unique, managed range 26565-26664, bound to `127.0.0.1`). Game traffic has no
per-server port: mc-router (docker-compose.router.yml) routes every player by
hostname to the container's internal port 25565.

Note the split: variables consumed by **docker compose itself** (ports, image tag,
container name, volume paths) are exported into the environment by the scripts, while
variables consumed by **the container** (Minecraft settings) flow through the two
`env_file` entries.

### 3. Contract-Based Scripting

All management scripts share `scripts/common.sh`, which provides validation, colored
output, Docker/Compose helpers, and the naming conventions:

| Concept         | Value                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server name     | `^[a-z0-9-]+$`                                                                                                                                                                                         |
| Config file     | `config/modpacks/<name>.env`                                                                                                                                                                           |
| Container name  | `mc-<name>`                                                                                                                                                                                            |
| Compose project | `mc-<name>`                                                                                                                                                                                            |
| Data dir        | `servers/<name>/data`                                                                                                                                                                                  |
| Mods dir        | `servers/<name>/mods`                                                                                                                                                                                  |
| Backups dir     | `backups/<name>`                                                                                                                                                                                       |
| Player route    | `<name>.<MC_ROUTER_DOMAIN>` via mc-router                                                                                                                                                              |
| RCON port       | `RCON_PORT` (unique, 26565–26664, loopback)                                                                                                                                                            |
| Exposed ports   | **only** `MC_ROUTER_PORT` (router) reaches the network — server RCON and the router API bind to `127.0.0.1`; servers have no game port and need no `expose:` to be reachable through the shared bridge |

**Exit code contract** (consistent across scripts):

- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: Resource not found
- `4`: Validation failure (e.g. port conflict, already running)

## System Components

### Directory Structure

```
minecraft-servers/
├── docker-compose.yml          # Single template service definition
├── .env                        # Shared configuration (from .env.example, git-ignored)
├── scripts/                    # Management scripts
│   ├── common.sh               # Shared library (sourced by all management scripts)
│   ├── start-server.sh         # Single server startup
│   ├── stop-server.sh          # Single server stop (--purge and granular removal options)
│   ├── start-all.sh            # Bulk startup
│   ├── stop-all.sh             # Graceful bulk shutdown
│   ├── restart-server.sh       # Restart with validation
│   ├── list-servers.sh         # Status table (or JSON)
│   ├── health-check.sh         # Health report (text or JSON)
│   ├── auto-restart.sh         # Auto-restart daemon
│   ├── backup.sh               # Atomic backup with checksum
│   ├── restore.sh              # Verified restore
│   ├── add-modpack.sh          # New server configuration generator
│   ├── validate-config.sh      # Configuration validation suite
│   ├── diagnose-failed-servers.sh  # Log analysis helper for failed starts
│   └── analyze-java-versions.sh    # Java version report (used by CI)
├── config/
│   ├── modpacks/               # Per-server .env files (15 pre-configured)
│   └── templates/              # Configuration templates
├── servers/<name>/             # Runtime data (git-ignored)
│   ├── data/                   # World, configs, logs
│   └── mods/                   # Additional mods
├── backups/<name>/             # Backup archives + SHA256 checksums
└── docs/                       # Documentation (see docs/README.md)
```

### Data Flow

```
./scripts/start-server.sh <name>
        │  validate name, config, Docker daemon
        ▼
scripts/common.sh::docker_compose_up
        │  export CONTAINER_NAME, SERVER_NAME, MC_ROUTER_DOMAIN, RCON_PORT, JAVA_VERSION,
        │  SERVER_*_DIR, SERVER_CONFIG_FILE
        ▼
docker compose -p mc-<name> up -d
        │  .env + config/modpacks/<name>.env  →  container environment
        ▼
itzg/minecraft-server container
        │  downloads server jar + modpack (first start), applies env to server.properties
        ▼
Persistent data in servers/<name>/data  (bind-mounted /data)
```

### Component Layers

1. **User Interface Layer**: bash scripts with colored output and consistent exit codes
2. **Validation Layer**: pre-flight checks (name format, config existence, Docker daemon, port conflicts)
3. **Orchestration Layer**: per-server Docker Compose projects from one template
4. **Runtime Layer**: `itzg/minecraft-server` containers with `mc-health` checks
5. **Persistence Layer**: bind-mounted host directories with backup integration

## Adding a Server: Instantiation Flow

`add-modpack.sh` generates a ready-to-start configuration:

1. **Name validation**: `^[a-z0-9-]+$`, uniqueness check
2. **RCON port assignment**: first free loopback port in 26565–26664 (or `--rcon-port=`)
3. **Template copy**: built-in templates (see [Adding Modpacks](ADDING_MODPACKS.md)) or minimal Paper config
4. **Variable injection**: `SERVER_NAME`, `RCON_PORT`, router settings (`MC_ROUTER_DOMAIN`, ...)
5. **Directory creation**: `servers/<name>/{data,mods}`, `backups/<name>`

Modpack types map to `itzg/minecraft-server` server types:

| Type                     | Source          | Extra variables needed              |
| ------------------------ | --------------- | ----------------------------------- |
| `AUTO_CURSEFORGE`        | CurseForge      | `CF_PAGE_URL`, `CF_API_KEY`         |
| `MODRINTH`               | Modrinth        | `MODRINTH_MODPACK`, exact `VERSION` |
| `PAPER`/`FORGE`/`FABRIC` | Direct download | `VERSION`                           |

## Health Monitoring Architecture

### Multi-Layer Checks

```
Layer 1: Container status        (Docker)
Layer 2: Docker health           (mc-health inside container)
Layer 3: Router entry point      (mc-router reachable)
Layer 4: Log analysis            (recent errors/crashes)
Layer 5: Disk space              (usage warnings)
```

`health-check.sh` aggregates these into `healthy` / `warning` / `unhealthy` statuses and
can emit JSON (`--json`) for external monitoring. `auto-restart.sh --daemon` polls that
output on an interval and restarts unhealthy servers. Details: [Monitoring](MONITORING.md).

## Backup & Recovery

Backups are **atomic with downtime**: the script stops the server, tars the world data,
writes a SHA256 checksum, restarts the server, and prunes old archives (rolling window of
3). Restore verifies the checksum before replacing data. Details:
[Backup & Restore](BACKUP_RESTORE.md).

## Security Considerations

- **Network**: dedicated external bridge `minecraft-network`; no per-server published ports — servers reach each other over the bridge, and the only network-facing port is the router's
- **Volumes**: per-server isolated data directories (no shared writable state)
- **Secrets**: `RCON_PASSWORD` and `CF_API_KEY` live only in `.env` (git-ignored)
- **Integrity**: SHA256 checksums on every backup
- **Online mode**: `ONLINE_MODE` is configurable per server; the shared default is `false`
  (offline/LAN), set `true` to require Mojang authentication

## Scalability

- **Ports**: one public game port shared by every server (mc-router,
  `MC_ROUTER_PORT`, default 25565); the only per-server ports are loopback
  RCON consoles in 26565–26664 → up to 100 servers (auto-assignment skips
  used ports)
- **Host resources**: the real limit — sum of `MEMORY` values, CPU, and disk I/O
- **Isolation**: one Compose project per server means any server can be
  started/stopped/rebuilt without touching the others

## Failure Modes & Recovery

| Failure             | Detection                          | Recovery                                   |
| ------------------- | ---------------------------------- | ------------------------------------------ |
| Single server crash | `health-check.sh`, `mc-health`     | `auto-restart.sh` daemon or manual restart |
| Bad config          | `validate-config.sh`               | Fix `<name>.env`, restart                  |
| Data corruption     | Server won't start / checksum fail | `restore.sh` from last good backup         |
| Docker daemon down  | All scripts fail fast (`exit 1`)   | Restart Docker; `start-all.sh`             |
| Port conflict       | Pre-flight validation (`exit 4`)   | Change `RCON_PORT`, restart                |

## Operational Patterns

### Deployment Workflow

```
1. Validate setup          ./scripts/validate-config.sh --all
2. Add server              ./scripts/add-modpack.sh <name> [--modpack=…]
3. Test start              ./scripts/start-server.sh <name>
4. Verify health           ./scripts/health-check.sh <name>
5. Production start        ./scripts/start-all.sh
6. Monitoring              ./scripts/auto-restart.sh --daemon
7. Scheduled backups       cron: ./scripts/backup.sh <name>
```

### Maintenance Workflow

- **Daily** (automated): health checks, backups, log rotation
- **Weekly**: backup integrity verification, config validation, disk usage review
- **Monthly**: restore drill (test a backup), Docker/modpack updates

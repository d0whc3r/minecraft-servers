# Environment Variables Reference

This document provides a reference for configuring Minecraft servers using environment variables.

## Official Documentation

**Complete documentation**: https://docker-minecraft-server.readthedocs.io/en/latest/variables/

All variables from the `itzg/minecraft-server` Docker image are supported. This document highlights the most commonly used ones.

## How to Use

Environment variables are defined in `config/modpacks/<server-name>.env` files. The docker compose setup automatically loads these variables when starting a server.

```bash
# Example: Starting a server with custom configuration
./scripts/start-server.sh vanilla
```

## Configuration Layers

Variables live in two layers, and knowing which file to touch is most of the story:

| Layer      | File                                                      | Applies to             | Typical contents                                                                       |
| ---------- | --------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Shared     | `.env` (repo root, gitignored — copy from `.env.example`) | Every server container | `EULA`, `CF_API_KEY`, `RCON_PASSWORD`, `ENABLE_RCON`, `TZ`, all `MC_ROUTER_*` settings |
| Per server | `config/modpacks/<server-name>.env`                       | One server             | `TYPE`, `VERSION`, `MEMORY`, `SERVER_NAME`, `RCON_PORT`, gameplay settings             |

How the layers combine at `./scripts/start-server.sh <name>`:

1. **Container environment**: docker compose loads `.env` first, then
   `config/modpacks/<name>.env` — the server config **overrides** shared values.
2. **Compose file interpolation** (ports, the `mc-router.*` labels, image tag):
   the start scripts export the per-server values from the server config
   (`RCON_PORT`, `JAVA_VERSION`, `SERVER_NAME`, `MC_ROUTER_DEFAULT`)
   and the shared router settings from `.env` (`load_router_settings` in
   `scripts/common.sh`).

How traffic works now that every server is behind mc-router:

- **Game traffic**: there is **no per-server game port at all** — `SERVER_PORT`
  no longer exists. Players connect once to `MC_ROUTER_PORT` and the route
  `<SERVER_NAME>.<MC_ROUTER_DOMAIN>` picks the server.
- **RCON**: the only per-server port. Each server needs a unique `RCON_PORT`
  from the managed range **26565-26664**, and the mapping is bound to
  `127.0.0.1` — host-local admin only. Uniqueness matters: two servers sharing
  an `RCON_PORT` collide on the host even bound to loopback.
- **Server discovery**: the route comes from the `mc-router.host` label in
  `docker-compose.yml`, built from `SERVER_NAME` + `MC_ROUTER_DOMAIN` at
  container creation. After changing either, recreate the container for the new
  route to appear (`./scripts/stop-server.sh <name> && ./scripts/start-server.sh <name>`).

## Required Variables

These must be defined in every server configuration:

| Variable      | Description                                                                                              | Example                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `TYPE`        | Server type                                                                                              | `VANILLA`, `PAPER`, `FORGE`, `FABRIC`, `AUTO_CURSEFORGE`, `MODRINTH` |
| `VERSION`     | Minecraft version **CRITICAL for MODRINTH: Must match modpack's MC version**                             | `1.20.4`, `1.19.2`, `1.21.1`, `LATEST`                               |
| `MEMORY`      | Java heap memory                                                                                         | `2G`, `4G`, `8G`                                                     |
| `RCON_PORT`   | The only per-server port: loopback admin console, unique per server (managed range 26565-26664)          | `26565`, `26567`, etc.                                               |
| `SERVER_NAME` | Server slug; must match the config file name. Builds the player route `<SERVER_NAME>.<MC_ROUTER_DOMAIN>` | `vanilla`                                                            |

### RCON Ports

Each server needs a unique `RCON_PORT` — it is the **only** per-server port
(the Docker mapping publishes it bound to `127.0.0.1`). `add-modpack.sh`
auto-assigns it from the managed range **26565-26664**. `ENABLE_RCON` and
`RCON_PASSWORD` are shared defaults from `.env`.

### MC-ROUTER (routing)

These live in the root `.env` (shared) and control `docker-compose.router.yml`.
The router is mandatory infrastructure — it always runs and every player
connection goes through it. Full guide: [docs/ROUTER.md](ROUTER.md).

| Variable               | Scope  | Default    | Description                                                        |
| ---------------------- | ------ | ---------- | ------------------------------------------------------------------ |
| `MC_ROUTER_DOMAIN`     | `.env` | `mc.local` | Route suffix: `<server>.<MC_ROUTER_DOMAIN>` (prefer `<ip>.nip.io`) |
| `MC_ROUTER_PORT`       | `.env` | `25565`    | Public port of the router (the only port players need)             |
| `MC_ROUTER_API_PORT`   | `.env` | `8080`     | Routes API, published on `127.0.0.1` only                          |
| `MC_ROUTER_DOCKER_GID` | `.env` | `999`      | Group with Docker socket access (`0` on Docker Desktop)            |
| `MC_ROUTER_VERSION`    | `.env` | `latest`   | `itzg/mc-router` image tag                                         |
| `MC_ROUTER_DEFAULT`    | server | unset      | Set `true` on ONE server to catch unknown hostnames                |

### CRITICAL: VERSION for Modrinth Modpacks

**For Modrinth modpacks, you MUST set `VERSION` to the exact Minecraft version that the modpack uses.**

If you don't set the correct version, the server will install the wrong Minecraft version and fail to load the modpack correctly.

To find the correct version:

```bash
# Check modpack's Minecraft version via API
curl -s "https://api.modrinth.com/v2/project/MODPACK_SLUG" | grep game_versions

# Example for cobbleverse
curl -s "https://api.modrinth.com/v2/project/cobbleverse" | grep game_versions
# Output: "game_versions": ["1.21.1"]
```

Then set in your `.env` file:

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobbleverse
VERSION=1.21.1 # MUST match modpack's Minecraft version
```

## Common Gameplay Variables

| Variable              | Description              | Default    | Values                                           |
| --------------------- | ------------------------ | ---------- | ------------------------------------------------ |
| `MAX_PLAYERS`         | Maximum players          | `20`       | Any positive integer                             |
| `DIFFICULTY`          | Game difficulty          | `easy`     | `peaceful`, `easy`, `normal`, `hard`             |
| `MODE`                | Game mode                | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `PVP`                 | Enable PvP               | `true`     | `true`, `false`                                  |
| `HARDCORE`            | Hardcore mode            | `false`    | `true`, `false`                                  |
| `FORCE_GAMEMODE`      | Force default gamemode   | `false`    | `true`, `false`                                  |
| `VIEW_DISTANCE`       | Render distance (chunks) | `10`       | `3`-`32` (recommended: 8-12)                     |
| `SIMULATION_DISTANCE` | Simulation distance      | `10`       | `3`-`32`                                         |

## World Settings

| Variable              | Description                      | Default             |
| --------------------- | -------------------------------- | ------------------- |
| `LEVEL`               | World/save name                  | `world`             |
| `SEED`                | World seed                       | Random              |
| `LEVEL_TYPE`          | World type                       | `minecraft:default` |
| `MAX_WORLD_SIZE`      | World size (blocks radius)       | `29999984`          |
| `MAX_BUILD_HEIGHT`    | Maximum build height             | `256`               |
| `GENERATE_STRUCTURES` | Generate villages, temples, etc. | `true`              |
| `ALLOW_NETHER`        | Enable Nether                    | `true`              |
| `SPAWN_ANIMALS`       | Spawn animals                    | `true`              |
| `SPAWN_MONSTERS`      | Spawn monsters                   | `true`              |
| `SPAWN_NPCS`          | Spawn villagers                  | `true`              |
| `SPAWN_PROTECTION`    | Spawn protection radius          | `16`                |

### Level Types

- `minecraft:default` - Normal world
- `minecraft:flat` - Superflat world
- `minecraft:large_biomes` - Large biomes
- `minecraft:amplified` - Amplified terrain

## Network & Security

| Variable                    | Description                     | Default |
| --------------------------- | ------------------------------- | ------- |
| `ONLINE_MODE`               | Require Mojang authentication   | `true`  |
| `ENABLE_WHITELIST`          | Enable whitelist                | `false` |
| `WHITELIST`                 | Comma-separated usernames/UUIDs | -       |
| `WHITELIST_FILE`            | Path to whitelist JSON          | -       |
| `ALLOW_FLIGHT`              | Allow flight mods               | `false` |
| `PREVENT_PROXY_CONNECTIONS` | Prevent proxy connections       | `false` |

## Performance & JVM

| Variable            | Description                     | Default          |
| ------------------- | ------------------------------- | ---------------- |
| `USE_AIKAR_FLAGS`   | Use Aikar's optimized JVM flags | `false`          |
| `USE_MEOWICE_FLAGS` | Use MeowIce flags (Java 17+)    | `false`          |
| `INIT_MEMORY`       | Initial heap size               | Same as `MEMORY` |
| `MAX_MEMORY`        | Maximum heap size               | Same as `MEMORY` |
| `JVM_OPTS`          | Custom JVM options              | -                |
| `JVM_XX_OPTS`       | Custom -XX JVM options          | -                |
| `USE_SIMD_FLAGS`    | SIMD optimizations              | `false`          |

### Recommended JVM Settings

For servers with 4GB+ RAM:

```bash
USE_AIKAR_FLAGS=true
MEMORY=4G
```

For Java 17+ servers:

```bash
USE_MEOWICE_FLAGS=true
MEMORY=6G
```

## RCON (Remote Console)

| Variable                | Description           | Default        |
| ----------------------- | --------------------- | -------------- |
| `ENABLE_RCON`           | Enable RCON           | `true`         |
| `RCON_PORT`             | RCON port             | `25575`        |
| `RCON_PASSWORD`         | RCON password         | Auto-generated |
| `BROADCAST_RCON_TO_OPS` | Broadcast RCON to ops | `false`        |

## Autopause/Autostop (Resource Optimization)

Auto-pause pauses the server process when no players are online, saving CPU.

| Variable                 | Description                             | Default |
| ------------------------ | --------------------------------------- | ------- |
| `ENABLE_AUTOPAUSE`       | Enable autopause                        | `false` |
| `AUTOPAUSE_TIMEOUT_EST`  | Timeout after last disconnect (seconds) | `3600`  |
| `AUTOPAUSE_TIMEOUT_INIT` | Timeout after server start (seconds)    | `600`   |
| `AUTOPAUSE_TIMEOUT_KN`   | Timeout after port knock (seconds)      | `120`   |
| `AUTOPAUSE_PERIOD`       | Check interval (seconds)                | `10`    |

Auto-stop completely stops the container when no players connect.

| Variable                | Description                             | Default |
| ----------------------- | --------------------------------------- | ------- |
| `ENABLE_AUTOSTOP`       | Enable autostop                         | `false` |
| `AUTOSTOP_TIMEOUT_EST`  | Timeout after last disconnect (seconds) | `3600`  |
| `AUTOSTOP_TIMEOUT_INIT` | Timeout after server start (seconds)    | `1800`  |
| `AUTOSTOP_PERIOD`       | Check interval (seconds)                | `10`    |

⚠️ **Note**: Autopause and Autostop are mutually exclusive.

## Modpacks & Plugins

### CurseForge

| Variable                | Description                           |
| ----------------------- | ------------------------------------- |
| `CF_API_KEY`            | CurseForge API key (set in `.env`)    |
| `CF_PAGE_URL`           | CurseForge modpack URL                |
| `CF_SLUG`               | Modpack slug                          |
| `CF_FILE_ID`            | Specific file ID                      |
| `CF_EXCLUDE_MODS`       | Comma-separated mods to exclude       |
| `CF_FORCE_INCLUDE_MODS` | Comma-separated mods to force include |
| `CF_PARALLEL_DOWNLOADS` | Parallel downloads (default: 4)       |

Example:

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
```

### Modrinth

**CRITICAL: Always set `VERSION` to match the modpack's Minecraft version. See Required Variables section above.**

| Variable           | Description                                                  | Required |
| ------------------ | ------------------------------------------------------------ | -------- |
| `MODRINTH_MODPACK` | Modpack project slug, ID, or URL                             | Yes      |
| `VERSION`          | **Minecraft version (MUST match modpack)**                   | **Yes**  |
| `MODRINTH_VERSION` | Specific modpack version/release (leave unset for latest)    | No       |
| `MODRINTH_LOADER`  | Mod loader (fabric, forge, quilt) - auto-detected if not set | No       |

Example for modpack:

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobbleverse
VERSION=1.21.1 # CRITICAL: Must match modpack's Minecraft version
MEMORY=6G
```

To find the correct Minecraft version for a modpack:

```bash
curl -s "https://api.modrinth.com/v2/project/cobbleverse" | grep game_versions
```

## Resource Packs

| Variable                | Description         |
| ----------------------- | ------------------- |
| `RESOURCE_PACK`         | Resource pack URL   |
| `RESOURCE_PACK_SHA1`    | SHA1 checksum       |
| `RESOURCE_PACK_ENFORCE` | Force resource pack |

## Advanced Options

| Variable                        | Description                    | Default              |
| ------------------------------- | ------------------------------ | -------------------- |
| `MOTD`                          | Server message of the day      | `A Minecraft Server` |
| `ICON`                          | Server icon URL                | -                    |
| `ENABLE_COMMAND_BLOCK`          | Enable command blocks          | `false`              |
| `PLAYER_IDLE_TIMEOUT`           | Kick idle players (minutes)    | `0` (disabled)       |
| `NETWORK_COMPRESSION_THRESHOLD` | Network compression            | `256`                |
| `ENABLE_ROLLING_LOGS`           | Use rolling log files          | `false`              |
| `TZ`                            | Timezone                       | `UTC`                |
| `ANNOUNCE_PLAYER_ACHIEVEMENTS`  | Announce achievements          | `true`               |
| `SNOOPER_ENABLED`               | Send anonymous stats to Mojang | `true`               |
| `ENABLE_STATUS`                 | Server list ping               | `true`               |
| `SYNC_CHUNK_WRITES`             | Sync chunk writes              | `true`               |
| `USE_NATIVE_TRANSPORT`          | Use native transport           | `true`               |
| `UID`                           | Linux user ID                  | `1000`               |
| `GID`                           | Linux group ID                 | `1000`               |

## Debugging

| Variable          | Description                | Default |
| ----------------- | -------------------------- | ------- |
| `LOG_TIMESTAMP`   | Include timestamps in logs | `false` |
| `ENABLE_JMX`      | Enable JMX monitoring      | `false` |
| `JMX_HOST`        | JMX host                   | -       |
| `DEBUG`           | Debug output               | `false` |
| `DEBUG_AUTOPAUSE` | Debug autopause            | `false` |
| `DEBUG_AUTOSTOP`  | Debug autostop             | `false` |

## Example Configurations

### Vanilla Paper Server

```bash
TYPE=PAPER
VERSION=26.2
MEMORY=4G
SERVER_NAME=My Vanilla Server
RCON_PORT=26565
MAX_PLAYERS=20
DIFFICULTY=normal
MODE=survival
USE_AIKAR_FLAGS=true
```

### Modded Server (CurseForge)

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
VERSION=1.21.1
MEMORY=8G
SERVER_NAME=all-the-mods-10
RCON_PORT=26566
MAX_PLAYERS=10
```

### Creative Building Server

```bash
TYPE=PAPER
VERSION=LATEST
MEMORY=2G
SERVER_NAME=Creative Build
RCON_PORT=26567
MODE=creative
PVP=false
DIFFICULTY=peaceful
SPAWN_MONSTERS=false
ALLOW_FLIGHT=true
```

### Whitelisted Private Server

```bash
TYPE=PAPER
VERSION=26.2
MEMORY=4G
SERVER_NAME=Private Server
RCON_PORT=26568
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3
ONLINE_MODE=false
```

## Docker Configuration

| Variable       | Description                           | Default  | Values                                                          |
| -------------- | ------------------------------------- | -------- | --------------------------------------------------------------- |
| `JAVA_VERSION` | Java version tag for the Docker image | `latest` | `latest`, `java8`, `java11`, `java17`, `java21`, `java25`, etc. |

### Java Version Selection

The `JAVA_VERSION` variable selects the Docker image tag (`itzg/minecraft-server:<value>`), so it can also be any tag supported by that image. Different Minecraft versions and modpacks require specific Java versions:

- **Java 8**: Required for Minecraft 1.12.x modpacks (RLCraft, SkyFactory 4, Dragon Block C)
- **Java 11**: Required by legacy CurseForge packs (My Hero Adventure, MC 1.16.5)
- **Java 17**: Required for Minecraft 1.18+ and many modern modpacks
- **Java 21**: Required for Minecraft 1.20.5+ and most 1.21.x packs
- **Java 25**: Required by newest releases (e.g. Plants vs. Zombies+ on MC 26.1.2)

If not specified, defaults to `latest`.

**Examples:**

```bash
# Java 8 for classic 1.12.2 modpacks
JAVA_VERSION=java8

# Java 25 for the newest Minecraft releases
JAVA_VERSION=java25

# Default
# JAVA_VERSION not set → image tag "latest"
```

**Real example from this repo:**

```bash
# config/modpacks/rlcraft.env
JAVA_VERSION=java8
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/rlcraft
VERSION=1.12.2
MEMORY=6G
SERVER_NAME=rlcraft
RCON_PORT=26566
```

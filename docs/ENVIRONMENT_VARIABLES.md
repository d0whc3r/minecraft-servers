# Environment Variables Reference

This document provides a reference for configuring Minecraft servers using environment variables.

## Official Documentation

**Complete documentation**: https://docker-minecraft-server.readthedocs.io/en/latest/variables/

All variables from the `itzg/minecraft-server` Docker image are supported. This document highlights the most commonly used ones.

## How to Use

Environment variables are defined in `config/modpacks/<server-name>.env` files. The docker-compose setup automatically loads these variables when starting a server.

```bash
# Example: Starting a server with custom configuration
./scripts/start-server.sh vanilla
```

## Required Variables

These must be defined in every server configuration:

| Variable      | Description                    | Example                                                  |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| `TYPE`        | Server type                    | `VANILLA`, `PAPER`, `FORGE`, `FABRIC`, `AUTO_CURSEFORGE` |
| `VERSION`     | Minecraft version              | `1.20.4`, `1.19.2`, `LATEST`                             |
| `MEMORY`      | Java heap memory               | `2G`, `4G`, `8G`                                         |
| `SERVER_PORT` | External port (must be unique) | `25565`, `25566`, etc.                                   |
| `SERVER_NAME` | Display name                   | `My Server`                                              |

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
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
```

### Modrinth

| Variable           | Description        |
| ------------------ | ------------------ |
| `MODRINTH_PROJECT` | Project slug or ID |
| `MODRINTH_VERSION` | Specific version   |

Example:

```bash
TYPE=MODRINTH
MODRINTH_PROJECT=cobblemon
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
VERSION=1.20.4
MEMORY=4G
SERVER_PORT=25565
SERVER_NAME=My Vanilla Server
MAX_PLAYERS=20
DIFFICULTY=normal
MODE=survival
USE_AIKAR_FLAGS=true
```

### Modded Server (CurseForge)

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
VERSION=1.19.2
MEMORY=8G
SERVER_PORT=25566
SERVER_NAME=ATM8 Server
MAX_PLAYERS=10
```

### Creative Building Server

```bash
TYPE=PAPER
VERSION=LATEST
MEMORY=2G
SERVER_PORT=25567
SERVER_NAME=Creative Build
MODE=creative
PVP=false
DIFFICULTY=peaceful
SPAWN_MONSTERS=false
ALLOW_FLIGHT=true
```

### Whitelisted Private Server

```bash
TYPE=PAPER
VERSION=1.20.4
MEMORY=4G
SERVER_PORT=25568
SERVER_NAME=Private Server
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3
ONLINE_MODE=false
```

## References

- **Full Variable List**: https://docker-minecraft-server.readthedocs.io/en/latest/variables/
- **Server Types**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/
- **JVM Options**: https://docker-minecraft-server.readthedocs.io/en/latest/configuration/jvm-options/
- **CurseForge Setup**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/
- **Modrinth Setup**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

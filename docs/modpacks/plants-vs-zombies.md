# Plants vs. Zombies+ Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/plants-vs-zombies  
**Type**: Fabric-based Vanilla+ modpack inspired by Plants vs. Zombies  
**Tags**: casual, tower-defense, vanilla-plus  
**Minecraft Version**: 26.1.2 (modpack 3.x)  
**Memory**: 4GB (4-6GB recommended)

## Overview

Plants vs. Zombies+ is a Vanilla+ modpack where you build plant defenses, survive
stronger zombie waves, and explore an immersive world — staying close to vanilla
gameplay while adding the PvZ tower-defense flavor.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh plants-vs-zombies

# Monitor startup (first time downloads 174+ dependencies, may take a while)
docker logs -f mc-plants-vs-zombies

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Route**       | `plants-vs-zombies.<MC_ROUTER_DOMAIN>`                               |
| **RCON Port**   | 26579                                                                |
| **Memory**      | 4GB                                                                  |
| **Type**        | CurseForge (AUTO_CURSEFORGE)                                         |
| **Java**        | 25 (`JAVA_VERSION=java25` — required, MC 26.x needs class file 69.0) |
| **Modpack pin** | 3.2.0 (`CF_FILE_ID=8708490`)                                         |

## Connection

- **Address**: `plants-vs-zombies.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `plants-vs-zombies.192.168.1.10.nip.io`)
- **Version**: 26.1.2
- **Client**: Install Plants vs. Zombies+ from the CurseForge launcher

⚠️ **Important**: Client and server must use the same modpack version.

## Configuration

Server config: `config/modpacks/plants-vs-zombies.env`

```bash
JAVA_VERSION=java25
TYPE=AUTO_CURSEFORGE
VERSION=26.1.2
MEMORY=4G
SERVER_NAME=plants-vs-zombies
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/plants-vs-zombies
CF_SLUG=plants-vs-zombies
CF_FILE_ID=8708490
RCON_PORT=26579
```

### Updating the Modpack

The install is pinned with `CF_FILE_ID` so restarts are reproducible. To move to a newer
release:

1. Find the new file ID on the
   [modpack files page](https://www.curseforge.com/minecraft/modpacks/plants-vs-zombies/files)
2. Update `CF_FILE_ID` (and the `VERSION`/comments if the Minecraft version changes)
3. Restart — the container re-installs the modpack on boot

## Gameplay Features

- **Plant defenses**: the classic PvZ tower-defense loop inside Minecraft
- **Zombie waves**: escalating horde pressure
- **Vanilla+ balance**: keeps vanilla progression intact
- **Command blocks enabled** (`ENABLE_COMMAND_BLOCK=true`) for modpack mechanics

## Server Configuration

```bash
# Standard survival settings (defaults in the .env)
DIFFICULTY=normal
MODE=survival
PVP=true
MAX_PLAYERS=20
PLAYER_IDLE_TIMEOUT=30
```

### Recommended Gamerules

Enter via RCON (`docker exec mc-plants-vs-zombies rcon-cli ...`):

```bash
gamerule keepInventory false # authentic survival
gamerule doDaylightCycle true
gamerule mobGriefing true # zombies interact with the world
```

## Performance

```bash
# Check resource usage
docker stats mc-plants-vs-zombies

# Check TPS (healthy: 20)
docker exec mc-plants-vs-zombies rcon-cli tps
```

- `USE_AIKAR_FLAGS=true` and `INIT_MEMORY`/`MAX_MEMORY=4G` are already set
- 4GB works for small groups; raise `MEMORY` to 6G for 10+ players
- `VIEW_DISTANCE=10` / `SIMULATION_DISTANCE=10` — reduce if TPS drops

## Troubleshooting

### Server won't start / wrong Java version

MC 26.x **requires Java 25**. The config already pins `JAVA_VERSION=java25`, which
selects the `itzg/minecraft-server:java25` image. If you see `UnsupportedClassVersionError`,
check that `JAVA_VERSION=java25` is still set.

### Modpack download fails

```bash
# CF_API_KEY must be set in the shared .env
grep CF_API_KEY .env

# Check container logs for the concrete error
docker logs mc-plants-vs-zombies
```

### World corruption

```bash
./scripts/backup.sh plants-vs-zombies                    # back up current state first
ls backups/plants-vs-zombies/                            # pick a good backup
./scripts/restore.sh plants-vs-zombies <backup-file>     # restore
```

## Additional Resources

- [itzg/minecraft-server variables](https://docker-minecraft-server.readthedocs.io/en/latest/variables/)
- [Modpack page on CurseForge](https://www.curseforge.com/minecraft/modpacks/plants-vs-zombies)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)
- [Backup & Restore](../BACKUP_RESTORE.md)

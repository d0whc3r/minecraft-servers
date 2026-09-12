# Prominence II: Hasturian Era Server

**Modrinth**: https://modrinth.com/modpack/prominence-2-fabric  
**CurseForge**: https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg-hasturian-era  
**Type**: Fabric-based RPG adventure (12M+ downloads)  
**Tags**: rpg, adventure, quests, magic, exploration  
**Minecraft Version**: 1.20.1  
**Memory**: 6GB recommended

## Overview

Prominence II: Hasturian Era is a top-down-the-charts RPG modpack: choose an
origin/class, fight custom bosses, clear hand-crafted dungeons, follow quests
and collect hundreds of unique weapons and artifacts.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh prominence-2

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-prominence-2

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                             |
| --------------- | --------------------------------- |
| **Route**       | `prominence-2.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26581                             |
| **Memory**      | 6GB                               |
| **Type**        | Modrinth (Fabric)                 |
| **Max Players** | 20                                |
| **Difficulty**  | Normal                            |
| **Mode**        | Survival                          |

## Connection

- **Address**: `prominence-2.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `prominence-2.192.168.1.10.nip.io`)
- **Version**: 1.20.1
- **Client**: Install "Prominence II RPG: Hasturian Era" from the Modrinth app or CurseForge launcher

## Features

- 🗡️ **RPG combat** - Custom weapons, spellblades and boss fights
- 🎭 **Classes/origins** - Pick a playstyle with unique abilities
- 🏰 **Dungeons and quests** - Structured progression for groups
- ⚡ **Performance optimized** - Aikar's flags enabled by default

## Configuration

Configuration file: `config/modpacks/prominence-2.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=prominence-2-fabric
VERSION=1.20.1
MEMORY=6G
USE_AIKAR_FLAGS=true
```

After changes: `./scripts/restart-server.sh prominence-2`

The config excludes a few client-side helpers (`MODRINTH_EXCLUDE_FILES`) that the pack
mistakenly marks as server-compatible; they depend on client-only mods and break mod
resolution on a dedicated server. Keep that exclusion if you tune the config.

## Server Management

```bash
./scripts/start-server.sh prominence-2
./scripts/stop-server.sh prominence-2
./scripts/restart-server.sh prominence-2
docker logs -f mc-prominence-2
./scripts/list-servers.sh
./scripts/backup.sh prominence-2
```

## Performance Tips

- **RAM**: 6-8GB
- **CPU**: 4+ cores recommended
- **Disk**: 15GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-prominence-2
# Common issues: insufficient memory, download failures
```

### Clients can't connect

1. Ensure the client has Prominence II: Hasturian Era (Fabric) installed
2. Verify the route `prominence-2.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep prominence-2`

## Resources

- **Modpack Page**: https://modrinth.com/modpack/prominence-2-fabric
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **Modrinth Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

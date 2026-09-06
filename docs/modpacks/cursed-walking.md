# Cursed Walking Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/cursed-walking-a-modern-zombie-apocalypse  
**Type**: Forge-based zombie survival (8M+ downloads)  
**Minecraft Version**: 1.20.1  
**Memory**: 8GB recommended

## Overview

Cursed Walking is a Walking Dead inspired survival experience: slow but
relentless zombie hordes, scarce loot, temperature/thirst systems and a
world that punishes carelessness. Designed for cooperative survival on
multiplayer servers.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh cursed-walking

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-cursed-walking

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                               |
| --------------- | ----------------------------------- |
| **Route**       | `cursed-walking.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26584                               |
| **Memory**      | 8GB                                 |
| **Type**        | CurseForge (Forge)                  |
| **Max Players** | 20                                  |
| **Difficulty**  | Hard                                |
| **Mode**        | Survival                            |

## Connection

- **Address**: `cursed-walking.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `cursed-walking.192.168.1.10.nip.io`)
- **Version**: 1.20.1
- **Client**: Install Cursed Walking from the CurseForge launcher

## Features

- 🧟 **Dense zombie hordes** - Persistent, slow and deadly enemies
- 🎒 **Scarcity survival** - Limited loot, durability and supplies
- 🏚️ **Abandoned structures** - Lootable towns and landmarks
- 🤝 **Team-oriented** - Built to be played cooperatively

## Configuration

Configuration file: `config/modpacks/cursed-walking.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/cursed-walking-a-modern-zombie-apocalypse
VERSION=1.20.1
MEMORY=8G
DIFFICULTY=hard
USE_AIKAR_FLAGS=true
```

After changes: `./scripts/restart-server.sh cursed-walking`

The config excludes the client-only shader mods (`CF_EXCLUDE_MODS="oculus,colorwheel"`):
they are not flagged as client-only in the pack manifest and crash the server at mod
loading. Keep that exclusion if you tune the config.

## Server Management

```bash
./scripts/start-server.sh cursed-walking
./scripts/stop-server.sh cursed-walking
./scripts/restart-server.sh cursed-walking
docker logs -f mc-cursed-walking
./scripts/list-servers.sh
./scripts/backup.sh cursed-walking
```

## Performance Tips

- **RAM**: 8GB (many entities in hordes)
- **CPU**: 4+ cores recommended
- **Disk**: 20GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-cursed-walking
# Common issues: insufficient memory, download failures
```

### Clients can't connect

1. Ensure the client has Cursed Walking (same pack version) installed
2. Verify the route `cursed-walking.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep cursed-walking`

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/cursed-walking-a-modern-zombie-apocalypse
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

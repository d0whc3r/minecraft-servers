# All The Mods 10: To the Sky Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-10-sky  
**Type**: Forge-based skyblock kitchen sink (3M+ downloads)  
**Tags**: skyblock, kitchen-sink, tech, quests  
**Minecraft Version**: 1.21.1  
**Memory**: 8GB recommended

## Overview

ATM10: To the Sky takes the All The Mods 10 kitchen-sink formula into a
skyblock world: start on a floating island and progress through tech
(Mekanism, Thermal), magic (Botania, Ars Nouveau) and exploration mods —
with skyblock-specific recipes and progression gates.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh all-the-mods-10-sky

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-all-the-mods-10-sky

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                    |
| --------------- | ---------------------------------------- |
| **Route**       | `all-the-mods-10-sky.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26585                                    |
| **Memory**      | 8GB                                      |
| **Type**        | CurseForge (Forge)                       |
| **Max Players** | 50                                       |
| **Difficulty**  | Normal                                   |
| **Mode**        | Survival                                 |

## Connection

- **Address**: `all-the-mods-10-sky.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `all-the-mods-10-sky.192.168.1.10.nip.io`)
- **Version**: 1.21.1
- **Client**: Install "All the Mods 10: To the Sky ATM10SKY" from the CurseForge launcher

## Features

- 🏝️ **Skyblock progression** - Full kitchen-sink progression from one island
- ⚙️ **Tech automation** - Mekanism, Thermal, Create and more
- 🔮 **Magic** - Botania, Ars Nouveau, Occultism
- 🏆 **ATM extras** - Custom items, achievements and allthemodium ore

## Configuration

Configuration file: `config/modpacks/all-the-mods-10-sky.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-10-sky
VERSION=1.21.1
MEMORY=8G
USE_AIKAR_FLAGS=true
```

After changes: `./scripts/restart-server.sh all-the-mods-10-sky`

## Server Management

```bash
./scripts/start-server.sh all-the-mods-10-sky
./scripts/stop-server.sh all-the-mods-10-sky
./scripts/restart-server.sh all-the-mods-10-sky
docker logs -f mc-all-the-mods-10-sky
./scripts/list-servers.sh
./scripts/backup.sh all-the-mods-10-sky
```

## Performance Tips

- **RAM**: 8-12GB (ATM series rewards more memory as bases grow)
- **CPU**: 4+ cores recommended
- **Disk**: 20GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-all-the-mods-10-sky
# Common issues: insufficient memory, download failures
```

### Clients can't connect

1. Ensure the client has ATM10: To the Sky (not regular ATM10) installed
2. Verify the route `all-the-mods-10-sky.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep all-the-mods-10-sky`

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-10-sky
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

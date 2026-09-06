# DeceasedCraft Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/deceasedcraft  
**Type**: Forge-based urban zombie apocalypse (9M+ downloads)  
**Minecraft Version**: 1.20.1  
**Memory**: 6GB recommended

## Overview

DeceasedCraft drops you into a huge procedurally generated city overrun by
the dead. Loot buildings, drive vehicles, use firearms and hold out against
zombie hordes — think DayZ/7 Days to Die inside Minecraft.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh deceasedcraft

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-deceasedcraft

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                              |
| --------------- | ---------------------------------- |
| **Route**       | `deceasedcraft.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26583                              |
| **Memory**      | 6GB                                |
| **Type**        | CurseForge (Forge)                 |
| **Max Players** | 20                                 |
| **Difficulty**  | Hard                               |
| **Mode**        | Survival                           |

## Connection

- **Address**: `deceasedcraft.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `deceasedcraft.192.168.1.10.nip.io`)
- **Version**: 1.20.1
- **Client**: Install DeceasedCraft from the CurseForge launcher

## Features

- 🏙️ **Generated cities** - Massive urban maps with enterable buildings
- 🔫 **Guns and vehicles** - Modern weapons and drivable cars
- 🧟 **Zombie hordes** - Scripted waves and city infestations
- ⚙️ **Server-side security** - Claims and anti-grief via open-parties-and-claims

## Configuration

Configuration file: `config/modpacks/deceasedcraft.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/deceasedcraft
VERSION=1.20.1
MEMORY=6G
DIFFICULTY=hard
USE_AIKAR_FLAGS=true
```

The pack has no dedicated server download, so the config pins the stable
release file and excludes the client-only shader mods:

```bash
CF_SLUG=deceasedcraft
CF_FILE_ID=8448820
CF_EXCLUDE_MODS="oculus,colorwheel"
```

After changes: `./scripts/restart-server.sh deceasedcraft`

## Server Management

```bash
./scripts/start-server.sh deceasedcraft
./scripts/stop-server.sh deceasedcraft
./scripts/restart-server.sh deceasedcraft
docker logs -f mc-deceasedcraft
./scripts/list-servers.sh
./scripts/backup.sh deceasedcraft
```

## Performance Tips

- **RAM**: 6-8GB (city chunks are heavy)
- **CPU**: 4+ cores recommended
- **Disk**: 20GB free space
- Keep `VIEW_DISTANCE=10` — city generation costs more than natural terrain

## Troubleshooting

### Server won't start

```bash
docker logs mc-deceasedcraft
# Common issues: insufficient memory, download failures
```

### Mod loading crash mentioning oculus/colorwheel

The config already excludes both client-only shader mods. If a future pack
update re-adds them, keep `CF_EXCLUDE_MODS="oculus,colorwheel"` up to date.

### Clients can't connect

1. Ensure the client has DeceasedCraft (same pack version) installed
2. Verify the route `deceasedcraft.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep deceasedcraft`

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/deceasedcraft
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

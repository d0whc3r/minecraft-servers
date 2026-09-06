# Better MC BMC4 Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4  
**Type**: Forge-based enhanced vanilla+ (18M+ downloads)  
**Minecraft Version**: 1.20.1  
**Memory**: 6GB recommended

## Overview

Better MC [FORGE] BMC4 is one of the most downloaded modpacks ever. It keeps the
vanilla feel while adding new biomes, structures, dungeons, weapons, tech
(Create, Mekanism) and magic — the classic "vanilla+" first modpack.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh better-mc-bmc4

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-better-mc-bmc4

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value              |
| --------------- | ------------------ |
| **Port**        | 25580              |
| **RCON**        | 26580              |
| **Memory**      | 6GB                |
| **Type**        | CurseForge (Forge) |
| **Max Players** | 20                 |
| **Difficulty**  | Normal             |
| **Mode**        | Survival           |

## Connection

- **Address**: `your-server-ip:25580`
- **Version**: 1.20.1
- **Client**: Install "Better MC [FORGE] - BMC4" from the CurseForge launcher

## Features

- 🌍 **New biomes and structures** - Fresh world to explore with vanilla-like progression
- ⚙️ **Tech mods** - Create, Mekanism and friends for automation
- 🔮 **Magic mods** - Ars Nouveau, Iron's Spells and more
- ⚔️ **Better combat and loot** - Dungeons, bosses and weapon variety
- ⚡ **Performance optimized** - Aikar's flags enabled by default

## Configuration

Configuration file: `config/modpacks/better-mc-bmc4.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4
VERSION=1.20.1
MEMORY=6G
USE_AIKAR_FLAGS=true
```

The build is pinned for reproducibility and two client-only mods are excluded
(keep both settings if you tune the config):

```bash
# Pin the latest release file - remove/update CF_FILE_ID to move to a newer release
CF_SLUG=better-mc-forge-bmc4
CF_FILE_ID=8689205

# missingmodschecker ships as an overrides file and crashes headless servers
CF_OVERRIDES_EXCLUSIONS="mods/missingmodschecker*.jar"

# oculus is skipped as client-only but colorwheel depends on it - drop both
CF_EXCLUDE_MODS="oculus,colorwheel"
```

For more players or heavier automation, increase memory:

```bash
MEMORY=8G
INIT_MEMORY=8G
MAX_MEMORY=8G
```

After changes: `./scripts/restart-server.sh better-mc-bmc4`

## Server Management

```bash
./scripts/start-server.sh better-mc-bmc4
./scripts/stop-server.sh better-mc-bmc4
./scripts/restart-server.sh better-mc-bmc4
docker logs -f mc-better-mc-bmc4
./scripts/list-servers.sh
./scripts/backup.sh better-mc-bmc4
```

## Performance Tips

- **RAM**: 6-8GB (8G recommended for big automation bases)
- **CPU**: 4+ cores recommended
- **Disk**: 15GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-better-mc-bmc4
# Common issues: port 25580 in use, insufficient memory, download failures
```

### Mod loading crash mentioning oculus/colorwheel

The config already excludes both client-only shader mods. If a future pack
update re-adds them, keep `CF_EXCLUDE_MODS="oculus,colorwheel"` up to date.

### Clients can't connect

1. Ensure the client has Better MC BMC4 (Forge) installed — not the Fabric variant
2. Check firewall allows port 25580
3. Verify the server is running: `docker ps | grep better-mc-bmc4`

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

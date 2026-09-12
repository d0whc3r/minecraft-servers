# Homestead Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/homestead-cozy  
**Type**: Cozy survival / exploration (2.5M+ downloads)  
**Tags**: cozy, survival, building, farming  
**Minecraft Version**: 1.20.1 (Forge)  
**Memory**: 6GB recommended

## Overview

Homestead - A Cozy Survival Experience is the trending pick for calm,
quest-guided multiplayer: a hand-crafted world, farming, seasons, furniture
and light RPG touches. A recurring name in 2025/2026 "cozy modpack" guides.

> Note: the Modrinth project `homestead` is a different Fabric variant; this
> server tracks the CurseForge Forge build (`homestead-cozy`).

## Quick Start

```bash
./scripts/start-server.sh homestead
docker logs -f mc-homestead
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                          |
| --------------- | ------------------------------ |
| **Route**       | `homestead.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26590                          |
| **Memory**      | 6GB                            |
| **Type**        | CurseForge (Forge)             |
| **Max Players** | 20                             |
| **Difficulty**  | Normal                         |
| **Mode**        | Survival (PVP off)             |

## Connection

- **Address**: `homestead.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `homestead.192.168.1.10.nip.io`)
- **Version**: 1.20.1
- **Client**: Install "Homestead - A Cozy Survival Experience" from CurseForge

## Features

- 🌾 **Cozy survival** - Farming, cooking, seasons and decoration mods
- 📖 **Quests** - Gentle quest-guided progression, great for groups
- 🏡 **Hand-crafted world** - Curated landmarks and points of interest
- 🤝 **Co-op friendly** - PVP off by default, relaxed difficulty

## Configuration

Configuration file: `config/modpacks/homestead.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/homestead-cozy
VERSION=1.20.1
MEMORY=6G
USE_AIKAR_FLAGS=true
```

The build is pinned for reproducibility:

```bash
CF_SLUG=homestead-cozy
CF_FILE_ID=8110152 # Homestead 1.3.7
```

## Performance Tips

- **RAM**: 6GB (4G works for 3-5 players if needed)
- **CPU**: 2-4 cores
- **Disk**: 12GB free space

## Troubleshooting

### Clients can't connect

1. Ensure the client uses the CurseForge (Forge) build, not the Modrinth
   Fabric variant — they are different packs
2. Verify the route resolves and mc-router is running (`./scripts/router.sh status`)

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/homestead-cozy
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/

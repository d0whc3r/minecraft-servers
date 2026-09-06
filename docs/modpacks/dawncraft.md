# DawnCraft Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/dawn-craft  
**Type**: Open-world RPG adventure (10M+ downloads)  
**Minecraft Version**: 1.18.2 (Forge)  
**Memory**: 8GB recommended

## Overview

DawnCraft: Echoes of Legends is the most-cited adventure modpack of 2025/2026.
Souls-like boss fights (Epic Fight combat), structured quests, dungeons,
borrowable weapons and a custom open world — the go-to pack for players who
want an RPG, not a kitchen sink.

## Quick Start

```bash
./scripts/start-server.sh dawncraft
docker logs -f mc-dawncraft
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                          |
| --------------- | ------------------------------ |
| **Route**       | `dawncraft.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26587                          |
| **Memory**      | 8GB                            |
| **Type**        | CurseForge (Forge)             |
| **Max Players** | 20                             |
| **Difficulty**  | Hard (pack balances around it) |
| **Mode**        | Survival (PVP off)             |

## Connection

- **Address**: `dawncraft.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `dawncraft.192.168.1.10.nip.io`)
- **Version**: 1.18.2
- **Client**: Install "DawnCraft - Echoes of Legends" from the CurseForge launcher

## Features

- ⚔️ **Souls-like combat** - Epic Fight animations, dodges, stamina and boss arenas
- 🗺️ **Custom open world** - TerraForged worldgen with hand-placed structures
- 📖 **Quest lines** - Server-side quest progress with loot rewards
- 🐉 **Bosses and dungeons** - Progressive difficulty from bandits to dragons

## Configuration

Configuration file: `config/modpacks/dawncraft.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/dawn-craft
VERSION=1.18.2
MEMORY=8G
USE_AIKAR_FLAGS=true
```

The build is pinned for reproducibility:

```bash
CF_SLUG=dawn-craft
CF_FILE_ID=7243862 # DawnCraft 2.0.16_hf
```

## Performance Tips

- **RAM**: 8GB minimum; custom worldgen and Epic Fight are memory-hungry
- **CPU**: 4+ cores — chunk generation at spawn is CPU-bound
- **Disk**: 15GB free space
- View/simulation distance are already reduced in the config; raise only on
  strong hardware

## Troubleshooting

### Slow first chunks / spawn lag

Custom worldgen generates slowly the first time. Pre-generate with
`Chunky`-style tooling or just let players explore gradually.

### Quests not syncing

Quest progress is stored server-side; make sure clients run the exact same
pack build as the server (see the pinned `CF_FILE_ID`).

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/dawn-craft
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/

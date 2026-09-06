# FTB StoneBlock 4 Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/ftb-stoneblock-4  
**Type**: NeoForge kitchen-sink skyblock-in-a-cave (2.8M+ downloads)  
**Minecraft Version**: 1.21.1 (NeoForge)  
**Memory**: 8GB recommended

## Overview

FTB StoneBlock 4 revives the classic "everything starts from one piece of stone,
underground" formula on modern Minecraft. Quest-guided (FTB Quests) with tech,
magic, exploration and the polish of the FTB team — one of r/feedthebeast's
top-rated packs of 2025 and actively updated into 2026.

## Quick Start

```bash
./scripts/start-server.sh stoneblock4
docker logs -f mc-stoneblock4
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                            |
| --------------- | -------------------------------- |
| **Route**       | `stoneblock4.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26586                            |
| **Memory**      | 8GB                              |
| **Type**        | CurseForge (NeoForge)            |
| **Max Players** | 20                               |
| **Difficulty**  | Normal                           |
| **Mode**        | Survival                         |

## Connection

- **Address**: `stoneblock4.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `stoneblock4.192.168.1.10.nip.io`)
- **Version**: 1.21.1 (NeoForge)
- **Client**: Install "FTB StoneBlock 4" from the CurseForge launcher

## Features

- 🪨 **Cave island start** - Progress from a single stone block to a vast underground base
- 📖 **Quest-driven** - FTB Quests progression across tech, magic and building
- ⚙️ **Modern mods** - Latest versions of Mekanism, Create-family and AE2 on NeoForge
- 🔁 **Actively updated** - Frequent pack builds (pinned in the config for stability)

## Configuration

Configuration file: `config/modpacks/stoneblock4.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/ftb-stoneblock-4
VERSION=1.21.1
MEMORY=8G
USE_AIKAR_FLAGS=true
```

The build is pinned for reproducibility:

```bash
CF_SLUG=ftb-stoneblock-4
CF_FILE_ID=8788623
```

> FTB names files after the pack build (the latest is literally named
> "1.20.1"), not the MC version — the build targets NeoForge 1.21.1. Do not
> change `LEVEL_TYPE`: the underground island world comes from the pack's own
> world-gen datapack.

## Performance Tips

- **RAM**: 8GB (10-12G for big automation bases with many players)
- **CPU**: 4+ cores recommended
- **Disk**: 15GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-stoneblock4
# Common issues: insufficient memory, download failures
```

### Players spawn in the wrong world type

The pack's progression depends on its custom underground world. Keep
`LEVEL_TYPE=minecraft:default` and let the pack's overrides drive worldgen.

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/ftb-stoneblock-4
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/

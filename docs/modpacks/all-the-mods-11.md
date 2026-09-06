# All The Mods 11 (ATM11) Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-11  
**Type**: NeoForge kitchen-sink (the ATM series, next generation)  
**Minecraft Version**: 26.1.2 (NeoForge) — requires the Java 25 image  
**Memory**: 8GB recommended

## Overview

ATM11 is the first All The Mods generation on Minecraft 26.x, succeeding ATM10
(also configured in this repo). Classic ATM formula: hundreds of mods covering
tech, magic, exploration and quests, updated continuously by the ATM team.

> **Beta status**: ATM11 is in active beta (0.7.0-beta at the time of writing).
> The config pins the exact build for reproducibility; bump `CF_FILE_ID`
> deliberately when you want a newer build.

## Quick Start

```bash
./scripts/start-server.sh all-the-mods-11
docker logs -f mc-all-the-mods-11
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                          |
| --------------- | ---------------------------------------------- |
| **Route**       | `all-the-mods-11.<MC_ROUTER_DOMAIN>`           |
| **RCON**        | 26589                                          |
| **Memory**      | 8GB                                            |
| **Type**        | CurseForge (NeoForge)                          |
| **Java**        | `JAVA_VERSION=java25` (MC 26.x needs Java 25+) |
| **Max Players** | 20                                             |
| **Difficulty**  | Normal                                         |
| **Mode**        | Survival                                       |

## Connection

- **Address**: `all-the-mods-11.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `all-the-mods-11.192.168.1.10.nip.io`)
- **Version**: 26.1.2
- **Client**: Install "All the Mods 11 - ATM11" from the CurseForge launcher;
  client and server builds must match (beta builds change often)

## Features

- 🧰 **Kitchen sink** - Tech, magic, building, QoL and exploration in one pack
- 🆕 **Minecraft 26.x** - First ATM on the newest Minecraft generation
- 📖 **Quest guidance** - ATM-themed progression book
- 🔁 **Continuous updates** - Frequent builds; pin or track latest via the config

## Configuration

Configuration file: `config/modpacks/all-the-mods-11.env`

```bash
JAVA_VERSION=java25
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-11
VERSION=26.1.2
MEMORY=8G
USE_AIKAR_FLAGS=true
```

The beta build is pinned for reproducibility:

```bash
CF_SLUG=all-the-mods-11
CF_FILE_ID=8758210 # 0.7.0-beta
```

## Performance Tips

- **RAM**: 8GB; 10-12G once players build big automation
- **CPU**: 4+ cores recommended
- **Disk**: 20GB free space

## Troubleshooting

### `UnsupportedClassVersionError` (class version 69.0)

MC 26.x requires Java 25+. The config already sets `JAVA_VERSION=java25` —
keep it when tuning.

### Pack update broke the world

Beta builds can be breaking. The pin keeps the server on 0.7.0-beta until you
explicitly update `CF_FILE_ID`; worlds should be backed up
(`./scripts/backup.sh all-the-mods-11`) before bumping.

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-11
- **Related**: [All The Mods 10](all-the-mods-10.md) — the 1.21.1 predecessor

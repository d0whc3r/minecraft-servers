# Better MC BMC5 Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/better-mc-neoforge-bmc5  
**Type**: NeoForge enhanced vanilla+ (2.6M+ downloads)  
**Tags**: vanilla-plus, exploration, quests, multiplayer  
**Minecraft Version**: 1.21.1 (NeoForge)  
**Memory**: 8GB recommended

## Overview

Better MC [NEOFORGE] BMC5 is the modern successor to BMC4 (also configured in
this repo). Same "vanilla, but so much better" formula on Minecraft 1.21.1:
new biomes and structures, dungeons, tech (Create, Mekanism) and magic
(Ars Nouveau, Iron's Spells) with modern-world performance.

## Quick Start

```bash
./scripts/start-server.sh better-mc-bmc5
docker logs -f mc-better-mc-bmc5
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                               |
| --------------- | ----------------------------------- |
| **Route**       | `better-mc-bmc5.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26588                               |
| **Memory**      | 8GB                                 |
| **Type**        | CurseForge (NeoForge)               |
| **Max Players** | 20                                  |
| **Difficulty**  | Normal                              |
| **Mode**        | Survival                            |

## Connection

- **Address**: `better-mc-bmc5.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `better-mc-bmc5.192.168.1.10.nip.io`)
- **Version**: 1.21.1
- **Client**: Install "Better MC [NEOFORGE] BMC5" — not the Forge or Fabric variants

## Features

- 🌍 **Modern worldgen** - Tectonic-style terrain, new biomes and structures
- ⚙️ **Tech mods** - Create, Mekanism and friends for automation
- 🔮 **Magic mods** - Ars Nouveau, Iron's Spells and more
- ⚔️ **Better combat and loot** - Dungeons, bosses and weapon variety

## Configuration

Configuration file: `config/modpacks/better-mc-bmc5.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/better-mc-neoforge-bmc5
VERSION=1.21.1
MEMORY=8G
USE_AIKAR_FLAGS=true
```

The build is pinned for reproducibility:

```bash
CF_SLUG=better-mc-neoforge-bmc5
CF_FILE_ID=8598260 # BMC5 [NEOFORGE] v52
```

For more players or heavier automation, increase memory:

```bash
MEMORY=10G
INIT_MEMORY=10G
MAX_MEMORY=10G
```

## Performance Tips

- **RAM**: 8GB (BMC5's modern worldgen needs more headroom than BMC4)
- **CPU**: 4+ cores recommended
- **Disk**: 15GB free space

## Troubleshooting

### Clients can't connect

1. Ensure the client has the **NeoForge** BMC5 variant — the Forge BMC4 client
   will not connect
2. Verify the route resolves and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep better-mc-bmc5`

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/better-mc-neoforge-bmc5
- **Related**: [Better MC BMC4](better-mc-bmc4.md) — the 1.20.1 Forge predecessor

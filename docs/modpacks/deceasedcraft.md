# DeceasedCraft Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/deceasedcraft  
**Type**: Urban zombie apocalypse modpack (Forge)  
**Tags**: zombie-apocalypse, survival, guns, exploration  
**Minecraft Version**: 1.20.1  
**Modpack Version**: DeceasedCraft Beta 5.10.17  
**Memory**: 10GB recommended allocation

## Overview

DeceasedCraft focuses on urban exploration, zombie hordes, firearms, vehicles,
quests, and technical progression. The profile pins the regular 5.10.17 release,
not the optional alpha Distant Horizons edition.

## Quick Start

```bash
./scripts/validate-config.sh deceasedcraft
./scripts/start-server.sh deceasedcraft
docker logs -f mc-deceasedcraft
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                                       |
| ----------------- | ------------------------------------------- |
| **Route**         | `deceasedcraft.<MC_ROUTER_DOMAIN>`          |
| **RCON Port**     | 26583                                       |
| **Memory**        | 10GB                                        |
| **Type**          | CurseForge (Forge)                          |
| **Release Pin**   | Main file 8448820                           |
| **Server Pack**   | Matching file 8448977                       |
| **Loader**        | Forge 47.4.0                                |
| **Java**          | 17                                          |
| **Max Players**   | 20                                          |
| **Game Settings** | Hard survival, PvP enabled, Nether disabled |

## Connection

- **Address**: `deceasedcraft.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.20.1 with DeceasedCraft Beta 5.10.17
- **Client**: Install the regular 5.10.17 client pack with a CurseForge-compatible launcher

Client and server must use the same modpack release. The separate server pack is
not suitable as a client installation.

## Configuration

Configuration file: `config/modpacks/deceasedcraft.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448820
CF_SLUG=deceasedcraft
CF_FILE_ID=8448820
CF_EXCLUDE_MODS="oculus,colorwheel"
VERSION=1.20.1
JAVA_VERSION=java17
MEMORY=10G
ENABLE_COMMAND_BLOCK=true
ALLOW_NETHER=false
RCON_PORT=26583
```

`AUTO_CURSEFORGE` uses the pinned main file because its manifest identifies the
exact Minecraft and Forge versions. The matching server ZIP is a reference
artifact and does not need to be extracted manually.

Oculus and Colorwheel are excluded because they are client-side rendering mods
and their dependency relationship can fail during dedicated-server loading.

## World Generation

Command blocks are enabled for pack mechanics such as multiblocks and vehicle
spawns. The Nether is disabled to match the intended dimension setup. If a new
world does not start in a medium or large Suburb Residential District, the
author recommends generating another world because progression may be affected.

## Performance Tips

- The author specifies 8GB as the minimum server allocation and recommends 10GB or more.
- Keep `MEMORY`, `INIT_MEMORY`, and `MAX_MEMORY` aligned when changing the limit.
- Generated cities are expensive; reduce view distance before removing content.
- Run `./scripts/backup.sh deceasedcraft` before updates or world regeneration.

## Troubleshooting

### Server fails while loading rendering mods

Verify that `CF_EXCLUDE_MODS` still contains both `oculus` and `colorwheel` and
that the server is using the regular pinned main file.

### World generation blocks progression

Check the starting district against the author's server guide. Back up an
existing world before deliberately generating a replacement.

### Upgrade from beta 5.10.x

The author does not guarantee that beta worlds will remain compatible with the
eventual 6.0 release. Always make a verified backup before changing the pin.

## Resources

Verified on September 12, 2026:

- [Official CurseForge project](https://www.curseforge.com/minecraft/modpacks/deceasedcraft)
- [Pinned 5.10.17 main file](https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448820)
- [Matching 5.10.17 server pack](https://www.curseforge.com/minecraft/modpacks/deceasedcraft/files/8448977)
- [Official server guide](https://deceasedcraft.wiki.gg/wiki/Getting_Started_With_a_Server)
- [itzg Auto CurseForge documentation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)

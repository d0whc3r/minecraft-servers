# MENAGERIE - Paradoxical Wilds Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/menagerie-paradoxical-wilds  
**Type**: Creature and exploration modpack (Forge)  
**Tags**: creatures, exploration, survival  
**Minecraft Version**: 1.20.1  
**Modpack Version**: 2.8.0  
**Memory**: 6GB initial allocation

## Overview

MENAGERIE - Paradoxical Wilds is an exploration and creature modpack built
around Marvelous Menagerie: Paradoxical. It is a separate CurseForge project
from the older `menagerie` profile and has its own world, container, and backups.

## Quick Start

```bash
./scripts/validate-config.sh menagerie-paradoxical-wilds
./scripts/start-server.sh menagerie-paradoxical-wilds
docker logs -f mc-menagerie-paradoxical-wilds
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                                            |
| ----------------- | ------------------------------------------------ |
| **Route**         | `menagerie-paradoxical-wilds.<MC_ROUTER_DOMAIN>` |
| **RCON Port**     | 26593                                            |
| **Memory**        | 6GB                                              |
| **Type**          | CurseForge (Forge)                               |
| **Release Pin**   | Main file 8445852 (version 2.8.0)                |
| **Java**          | 17                                               |
| **Max Players**   | 20                                               |
| **Game Settings** | Normal survival, PvP enabled                     |

## Connection

- **Address**: `menagerie-paradoxical-wilds.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.20.1 with Paradoxical Wilds 2.8.0
- **Client**: Install the same 2.8.0 release from CurseForge

For example, when `MC_ROUTER_DOMAIN=192.168.1.10.nip.io`, players connect to
`menagerie-paradoxical-wilds.192.168.1.10.nip.io`.

## Configuration

Configuration file: `config/modpacks/menagerie-paradoxical-wilds.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/menagerie-paradoxical-wilds/files/8445852
VERSION=1.20.1
JAVA_VERSION=java17
MEMORY=6G
SERVER_NAME=menagerie-paradoxical-wilds
LEVEL_TYPE=minecraft:default
RCON_PORT=26593
```

`CF_PAGE_URL` points to the exact main file. `AUTO_CURSEFORGE` reads its manifest
to install the matching Forge loader and mods; the separate server ZIP must not
be used as the manifest input.

## Data and Updates

- **World and installed files**: `servers/menagerie-paradoxical-wilds/data/`
- **Additional local mods**: `servers/menagerie-paradoxical-wilds/mods/`
- **Backups**: `backups/menagerie-paradoxical-wilds/`

Before changing the pinned release:

```bash
./scripts/backup.sh menagerie-paradoxical-wilds
./scripts/stop-server.sh menagerie-paradoxical-wilds
```

Update the main-file URL only after checking its Minecraft, loader, and Java
requirements. Clients must move to the same release.

## Performance Tips

- The 6GB allocation is a local starting point, not an author-specified minimum.
- Begin with the configured 10-chunk view and 8-chunk simulation distances.
- Use `docker stats mc-menagerie-paradoxical-wilds` to inspect resource usage.
- Make a backup before pack updates or large world changes.

## Troubleshooting

### CurseForge installation fails

Confirm that the shared `.env` contains the required `CF_API_KEY`, then inspect
`docker logs mc-menagerie-paradoxical-wilds` for the exact download failure.

### Client cannot join

Verify that the client is running Paradoxical Wilds 2.8.0 on Minecraft 1.20.1.
The older `menagerie` pack is a different project and is not compatible.

### The wrong pack version is installed

Ensure `CF_PAGE_URL` still ends in `/files/8445852`. A project-level URL can
resolve a different release over time.

## Resources

Verified on September 12, 2026:

- [Official CurseForge project](https://www.curseforge.com/minecraft/modpacks/menagerie-paradoxical-wilds)
- [Pinned 2.8.0 main file](https://www.curseforge.com/minecraft/modpacks/menagerie-paradoxical-wilds/files/8445852)
- [itzg Auto CurseForge documentation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)

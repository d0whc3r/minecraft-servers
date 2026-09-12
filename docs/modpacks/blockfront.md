# BlockFront Server

**Modrinth**: https://modrinth.com/modpack/blockfront-mod-pack  
**Type**: World War II multiplayer combat modpack (NeoForge)  
**Tags**: multiplayer, combat, guns, wwii  
**Minecraft Version**: 1.21.1  
**Modpack Version**: 0.9.0.30b  
**Memory**: 4GB initial allocation

## Overview

BlockFront is the official modpack for the BlockFront combat mod. It provides
weapons, vehicles, maps, classes, squad play, matchmaking, and player
statistics in a World War II setting. This profile pins the newest stable
Modrinth modpack release available when it was checked.

## Quick Start

```bash
./scripts/validate-config.sh blockfront
./scripts/start-server.sh blockfront
docker logs -f mc-blockfront
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                                |
| ----------------- | ------------------------------------ |
| **Route**         | `blockfront.<MC_ROUTER_DOMAIN>`      |
| **RCON Port**     | 26597                                |
| **Memory**        | 4GB initial estimate                 |
| **Type**          | Modrinth (NeoForge)                  |
| **Release Pin**   | `qeuo8ALS` (BlockFront 0.9.0.30b)    |
| **Loader**        | NeoForge 21.1.248                    |
| **Java**          | 21                                   |
| **Max Players**   | 20 configured; not a tested capacity |
| **Game Settings** | Normal survival, PvP enabled         |

## Connection

- **Address**: `blockfront.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.21.1 with BlockFront 0.9.0.30b
- **Client**: Install the same BlockFront 0.9.0.30b release from Modrinth

The official project and selected `.mrpack` declare BlockFront as required on
both client and server. The manifest also includes Sodium as a client-only
file; the Modrinth installer filters it from the dedicated server.

## Configuration

Configuration file: `config/modpacks/blockfront.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=blockfront-mod-pack
MODRINTH_VERSION=qeuo8ALS
MODRINTH_LOADER=neoforge
VERSION=1.21.1
JAVA_VERSION=java21
MEMORY=4G
RCON_PORT=26597
```

The selected `.mrpack` contains no overrides, bundled world, or extra server
preparation. Its manifest installs NeoForge 21.1.248, the BlockFront mod, and
the files marked for the server automatically.

## Resource Guidance

The author does not publish dedicated-server RAM or disk guidance. The 4GB
allocation is a local starting estimate, not a player-capacity promise. Watch
real usage with `docker stats mc-blockfront` and increase `MEMORY` if matches,
maps, or player count require it.

## Server Management

```bash
./scripts/start-server.sh blockfront
./scripts/stop-server.sh blockfront
./scripts/restart-server.sh blockfront
docker logs -f mc-blockfront
./scripts/backup.sh blockfront
```

## Troubleshooting

### Client reports missing or incompatible mods

Confirm that the client uses BlockFront 0.9.0.30b. The server is pinned to the
immutable Modrinth version ID `qeuo8ALS`; another release may not be compatible.

### Installation fails before Minecraft starts

Check `docker logs mc-blockfront` for the failed Modrinth or NeoForge download.
Do not remove the BlockFront content mod to bypass an installation error.

## Resources

Verified on September 12, 2026:

- [Official Modrinth project](https://modrinth.com/modpack/blockfront-mod-pack)
- [BlockFront 0.9.0.30b release](https://modrinth.com/modpack/blockfront-mod-pack/version/qeuo8ALS)
- [Official project metadata](https://api.modrinth.com/v2/project/blockfront-mod-pack)
- [Official release metadata](https://api.modrinth.com/v2/version/qeuo8ALS)
- [Official BlockFront site](https://www.blockfrontmc.com/)
- [itzg Modrinth modpack installation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
- [itzg Java image tags](https://docker-minecraft-server.readthedocs.io/en/latest/versions/java/)

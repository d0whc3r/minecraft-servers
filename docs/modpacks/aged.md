# Aged Server

**Modrinth**: https://modrinth.com/modpack/aged\
**Type**: Realistic medieval progression modpack (Fabric)\
**Minecraft Version**: 1.20.1\
**Modpack Version**: 3.1.2\
**Memory**: 6GB initial allocation

## Overview

Aged is a survival and progression pack built around seasons, temperature,
hydration, nutrition, skills, settlement building, and medieval exploration.
This profile pins the stable 3.1.2 release and its exact Fabric Loader version.

## Quick Start

```bash
./scripts/validate-config.sh aged
./scripts/start-server.sh aged
docker logs -f mc-aged
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                        |
| ----------------- | ---------------------------- |
| **Route**         | `aged.<MC_ROUTER_DOMAIN>`    |
| **RCON Port**     | 26594                        |
| **Memory**        | 6GB                          |
| **Type**          | Modrinth (Fabric)            |
| **Release Pin**   | `7BgHWBWr` (Aged 3.1.2)      |
| **Loader**        | Fabric Loader 0.16.9         |
| **Java**          | 17                           |
| **Max Players**   | 20                           |
| **Game Settings** | Normal survival, PvP enabled |

## Connection

- **Address**: `aged.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.20.1 with Aged 3.1.2
- **Client**: Install the same Aged 3.1.2 release from Modrinth

The pack requires mods on both the client and server. Its `.mrpack` declares 198
shared files and 28 client-only files; the Modrinth installer filters the latter
from the dedicated server.

## Configuration

Configuration file: `config/modpacks/aged.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=aged
MODRINTH_VERSION=7BgHWBWr
MODRINTH_LOADER=fabric
VERSION=1.20.1
JAVA_VERSION=java17
MEMORY=6G
LEVEL_TYPE=minecraft:default
RCON_PORT=26594
```

The bundled Paxi data packs and configuration overrides apply automatically. No
additional world preset is required.

## Multiplayer Notes

The author states that Aged has focused on single-player gameplay since version
3.0, while still supporting installation through Docker. The Lavender guidebook
may not work on dedicated servers; this is a known upstream limitation rather
than a server configuration error.

## Performance Tips

- Treat 6GB as a starting allocation and adjust `MEMORY` after observing usage.
- The profile uses a 10-chunk view distance and an 8-chunk simulation distance.
- Use `docker stats mc-aged` to inspect live memory and CPU consumption.
- Back up the world before changing the pinned release.

## Troubleshooting

### The Lavender guidebook does not work

This is a limitation documented by the modpack author for multiplayer servers.
The rest of the pack can still run normally.

### Client reports missing or incompatible mods

Confirm that the client uses Aged 3.1.2. The server is pinned to immutable
Modrinth version ID `7BgHWBWr`; another Aged release may not be compatible.

### Installation fails before Minecraft starts

Check `docker logs mc-aged` for the failed Modrinth download. Do not remove
content mods to bypass an installation error.

## Resources

Verified on September 12, 2026:

- [Official Modrinth project](https://modrinth.com/modpack/aged)
- [Aged 3.1.2 release](https://modrinth.com/modpack/aged/version/7BgHWBWr)
- [Official release metadata](https://api.modrinth.com/v2/version/7BgHWBWr)
- [itzg Modrinth modpack installation](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)

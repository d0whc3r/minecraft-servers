# Parasites: Reloaded Server

**Modrinth**: https://modrinth.com/modpack/parasites-reloaded\
**Type**: Hardcore post-apocalyptic survival modpack (Forge)\
**Minecraft Version**: 1.12.2\
**Modpack Version**: Published as 1.3.0\
**Memory**: 6GB initial allocation

## Overview

Parasites: Reloaded is a hardcore survival pack set in a post-nuclear world
overrun by evolving parasitic creatures. The server profile pins the latest
published Modrinth release and its exact Forge version.

## Quick Start

```bash
./scripts/validate-config.sh parasites-reloaded
./scripts/start-server.sh parasites-reloaded
docker logs -f mc-parasites-reloaded
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                                   |
| ----------------- | --------------------------------------- |
| **Route**         | `parasites-reloaded.<MC_ROUTER_DOMAIN>` |
| **RCON Port**     | 26596                                   |
| **Memory**        | 6GB                                     |
| **Type**          | Modrinth (Forge)                        |
| **Release Pin**   | `A3ktvMQw` (published as 1.3.0)         |
| **Loader**        | Forge 14.23.5.2860                      |
| **Java**          | 8                                       |
| **Max Players**   | 20                                      |
| **Game Settings** | Hard survival, PvP enabled              |

## Connection

- **Address**: `parasites-reloaded.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.12.2 with the release identified by `A3ktvMQw`
- **Client**: Install the same Parasites: Reloaded release from Modrinth

The project marks mods as required on both the client and server. OptiFine is an
optional client-only addition and must not be copied to the server.

## Configuration

Configuration file: `config/modpacks/parasites-reloaded.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=parasites-reloaded
MODRINTH_VERSION=A3ktvMQw
MODRINTH_LOADER=forge
VERSION=1.12.2
JAVA_VERSION=java8
MEMORY=6G
DIFFICULTY=hard
LEVEL_TYPE=DEFAULT
RCON_PORT=26596
```

Modrinth labels this release as 1.3.0, while the uploaded filename and internal
`modrinth.index.json` identify it as 1.1.0. The immutable version ID avoids any
ambiguity and always selects the same artifact.

## World Generation

The distributed Biomes O' Plenty configuration leaves automatic BOP world-type
selection disabled. The profile therefore uses `LEVEL_TYPE=DEFAULT`; no
unverified custom preset is added.

## Voice Chat

Simple Voice Chat is bundled, but this repository does not publish UDP port 24454. The server works without voice chat. Enabling it requires an explicit
Compose networking change.

## Performance Tips

- The 6GB server allocation is a local estimate; the official 6GB statement is for shader-enabled clients.
- Keep Java 8 for this Forge 1.12.2 pack; newer JVMs are not a safe substitute.
- Monitor the server with `docker stats mc-parasites-reloaded` during parasite activity.
- Back up the world before changing the release or parasite configuration.

## Troubleshooting

### Forge fails during startup

Confirm that Compose resolves `itzg/minecraft-server:java8`. Forge releases
older than Minecraft 1.18 require the Java 8 image.

### The displayed pack version looks wrong

The 1.3.0/1.1.0 discrepancy exists in the upstream artifact. Compare immutable
version ID `A3ktvMQw`, not only the displayed filename.

### A BOP world was expected

The pack itself leaves automatic BOP world-type selection disabled. Changing
the world type after generation will not convert existing chunks.

## Resources

Verified on September 12, 2026:

- [Official Modrinth project](https://modrinth.com/modpack/parasites-reloaded)
- [Release published as 1.3.0](https://modrinth.com/modpack/parasites-reloaded/version/A3ktvMQw)
- [Official release metadata](https://api.modrinth.com/v2/version/A3ktvMQw)
- [itzg image Java compatibility](https://docker-minecraft-server.readthedocs.io/en/latest/versions/java/)

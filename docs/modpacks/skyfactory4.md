# SkyFactory 4 Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/skyfactory-4  
**Type**: Classic void-world skyblock modpack (Forge)  
**Tags**: skyblock, tech, progression, quests  
**Minecraft Version**: 1.12.2  
**Modpack Version**: 4.2.4  
**Memory**: 6GB allocated, 4GB official minimum

## Overview

SkyFactory 4 is a progression-focused skyblock pack that starts players in a
void world with minimal resources. This profile pins release 4.2.4 and includes
the official Topography settings required to generate the classic world.

## Quick Start

```bash
./scripts/validate-config.sh skyfactory4
./scripts/start-server.sh skyfactory4
docker logs -f mc-skyfactory4
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| **Route**         | `skyfactory4.<MC_ROUTER_DOMAIN>`  |
| **RCON Port**     | 26565                             |
| **Memory**        | 6GB                               |
| **Type**          | CurseForge (Forge)                |
| **Release Pin**   | Main file 3565683 (version 4.2.4) |
| **Server Pack**   | Matching file 3565687             |
| **Loader**        | Forge 14.23.5.2860                |
| **Java**          | 8                                 |
| **Max Players**   | 10                                |
| **Game Settings** | Normal survival, PvP enabled      |

## Connection

- **Address**: `skyfactory4.<MC_ROUTER_DOMAIN>` through mc-router
- **Version**: Minecraft 1.12.2 with SkyFactory 4 version 4.2.4
- **Client**: Install SkyFactory 4 version 4.2.4 from CurseForge

Client and server must use the same modpack release.

## Configuration

Configuration file: `config/modpacks/skyfactory4.env`

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/skyfactory-4/files/3565683
CF_SLUG=skyfactory-4
CF_FILE_ID=3565683
VERSION=1.12.2
JAVA_VERSION=java8
MEMORY=6G
LEVEL_TYPE=DEFAULT
GENERATOR_SETTINGS={"Topography-Preset":"Sky Factory 4"}
SPAWN_PROTECTION=0
RCON_PORT=26565
```

`AUTO_CURSEFORGE` uses the main file because it contains the manifest. The
matching server ZIP was used to verify Forge, memory, and server properties, but
must not replace the main file as the automatic installer's input.

## World Generation

The following values must be present before the first world is generated:

```properties
level-type=DEFAULT
generator-settings={"Topography-Preset":"Sky Factory 4"}
spawn-protection=0
```

Changing these settings does not convert an existing normal world to skyblock.
Back up the current world and deliberately generate a new one if the initial
world type is incorrect. Flight, the Nether, and command blocks are enabled to
match the official server pack.

## Multiplayer Islands

The official guide documents these Topography commands:

```text
/topography spawn [player]
/topography island
/topography island home [player]
/topography island new [player]
/topography island set [player] x z
/topography island info [player]
/topography island invite
/topography island accept
```

Prestige is optional and is not enabled by this profile. Configure
`prestige.cfg` explicitly after the pack generates it if Prestige is desired.

## Performance Tips

- The official server pack recommends at least 4GB; this profile allocates 6GB.
- Start with the configured 10-chunk view distance and monitor actual usage.
- Use `docker stats mc-skyfactory4` to observe memory and CPU consumption.
- Back up before updates and before intentionally replacing a world.

## Troubleshooting

### A normal overworld was generated

Confirm that both `LEVEL_TYPE` and `GENERATOR_SETTINGS` match the configuration
above. These values only affect creation of a new world.

### Client cannot join

Verify that the client uses SkyFactory 4 version 4.2.4 on Minecraft 1.12.2.

### Updating from an older release

Open existing graves and create a backup first. The 4.2.4 release notes warn
that a tomb mod change can make old graves inaccessible.

## Resources

Verified on September 12, 2026:

- [Official CurseForge project](https://www.curseforge.com/minecraft/modpacks/skyfactory-4)
- [Main 4.2.4 file](https://www.curseforge.com/minecraft/modpacks/skyfactory-4/files/3565683)
- [4.2.4 server pack](https://www.curseforge.com/minecraft/modpacks/skyfactory-4/files/3565687)
- [Official multiplayer guide](https://github.com/DarkPacks/SkyFactory-4/wiki/Multiplayer-Instructions)
- [itzg world-generation variables](https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/#level-type-and-generator-settings)

# Cobblemon Official Server

**Modrinth**: https://modrinth.com/modpack/cobblemon-fabric  
**Type**: Official Cobblemon modpack (10M+ downloads)  
**Minecraft Version**: 1.21.1 (Fabric)  
**Memory**: 6GB recommended

## Overview

The official modpack of Cobblemon, the open-source Pokémon mod for Minecraft:
Pokémon spawning, catching, battling and training with a small set of
performance mods and no heavy extras. The vanilla-feeling alternative to
Cobbleverse (the adventure-heavy Cobblemon spin-off, also configured here).

## Quick Start

```bash
./scripts/start-server.sh cobblemon
docker logs -f mc-cobblemon
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                          |
| --------------- | ------------------------------ |
| **Route**       | `cobblemon.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26592                          |
| **Memory**      | 6GB                            |
| **Type**        | Modrinth (Fabric)              |
| **Max Players** | 20                             |
| **Difficulty**  | Normal                         |
| **Mode**        | Survival (PVP off)             |

## Connection

- **Address**: `cobblemon.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `cobblemon.192.168.1.10.nip.io`)
- **Version**: 1.21.1
- **Client**: Install "Cobblemon Official Modpack [Fabric]" from Modrinth, or
  just the Cobblemon mod on Fabric 1.21.1

## Features

- ⚡ **Lightweight** - Cobblemon plus performance mods; runs on modest hardware
- 🎮 **Vanilla-like** - No forced progression: play Pokémon your way
- 🌲 **Natural spawns** - Biome-aware Pokémon spawning configured server-side
- 🏟️ **Event-friendly** - Command blocks enabled pattern for gyms/tournaments

## Configuration

Configuration file: `config/modpacks/cobblemon.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon-fabric
VERSION=1.21.1
MEMORY=6G
USE_AIKAR_FLAGS=true
```

`VERSION` is mandatory for Modrinth packs and must match the pack's Minecraft
version exactly (the pack supports 1.20.1 and 1.21.1; this server uses 1.21.1).
Optionally pin a release with `MODRINTH_VERSION=`.

## Server-Side Customization

Cobblemon species spawns, catch rates and battle rules are configured
server-side after first boot:

```bash
servers/cobblemon/data/config/cobblemon/
```

## Performance Tips

- **RAM**: 6GB (4G works for small groups)
- **CPU**: 2-4 cores
- **Disk**: 10GB free space

## Troubleshooting

### Clients can't connect

1. Ensure the client is on Fabric 1.21.1 with a matching Cobblemon version
2. Verify the route resolves and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep cobblemon`

## Resources

- **Modpack Page**: https://modrinth.com/modpack/cobblemon-fabric
- **Related**: [Cobbleverse](cobbleverse.md) — adventure-style Cobblemon pack in this repo

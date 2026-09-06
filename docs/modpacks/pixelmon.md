# Pixelmon Server

**Modrinth**: https://modrinth.com/modpack/the-pixelmon-modpack  
**CurseForge**: https://www.curseforge.com/minecraft/modpacks/the-pixelmon-modpack  
**Type**: NeoForge-based Pokemon adventure (20M+ downloads)  
**Minecraft Version**: 1.21.1  
**Memory**: 6GB recommended

## Overview

The Pixelmon Modpack brings the classic Pokemon experience to Minecraft:
catch, train and battle hundreds of Pokemon, build PC storage, challenge
gyms and trade with other players. The evergreen favorite for Pokemon
servers.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh pixelmon

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-pixelmon

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                         |
| --------------- | ----------------------------- |
| **Route**       | `pixelmon.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26582                         |
| **Memory**      | 6GB                           |
| **Type**        | Modrinth (NeoForge)           |
| **Max Players** | 20                            |
| **Difficulty**  | Normal                        |
| **Mode**        | Survival                      |

## Connection

- **Address**: `pixelmon.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `pixelmon.192.168.1.10.nip.io`)
- **Version**: 1.21.1
- **Client**: Install "The Pixelmon Modpack" from the Modrinth app or CurseForge launcher

## Features

- 🎮 **Pixelmon** - Hundreds of catchable Pokemon with evolving generations
- 🏟️ **Gyms and NPC battles** - Trainer NPCs, gym leaders and ranked battles
- 💾 **PC storage and trading** - Full Pokemon management experience
- 🌍 **Vanilla+ world** - Pokemon spawn naturally alongside vanilla gameplay

## Configuration

Configuration file: `config/modpacks/pixelmon.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=the-pixelmon-modpack
VERSION=1.21.1
MEMORY=6G
USE_AIKAR_FLAGS=true
ALLOW_FLIGHT=true # For flying Pokemon
```

After changes: `./scripts/restart-server.sh pixelmon`

## Server Management

```bash
./scripts/start-server.sh pixelmon
./scripts/stop-server.sh pixelmon
./scripts/restart-server.sh pixelmon
docker logs -f mc-pixelmon
./scripts/list-servers.sh
./scripts/backup.sh pixelmon
```

## Useful Commands

Server operators:

```
/pokegive <player> <pokemon> - Give a Pokemon to a player
/pokeheal <player> - Heal a player's party
/pokedisguise - Fun admin utilities
```

## Performance Tips

- **RAM**: 6-8GB (Pokemon spawning is entity-heavy)
- **CPU**: 4+ cores recommended
- **Disk**: 15GB free space

## Troubleshooting

### Server won't start

```bash
docker logs mc-pixelmon
# Common issues: insufficient memory, download failures
```

### Clients can't connect

1. Ensure the client has The Pixelmon Modpack (same generation) installed
2. Verify the route `pixelmon.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify the server is running: `docker ps | grep mc-pixelmon`

## Resources

- **Modpack Page**: https://modrinth.com/modpack/the-pixelmon-modpack
- **Pixelmon Wiki**: https://pixelmonmod.com/wiki/
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **Modrinth Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

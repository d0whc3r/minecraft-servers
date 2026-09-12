# Zombie Invade 100 Days Server

**Modrinth**: https://modrinth.com/modpack/zombie-invade-100-days  
**Type**: Zombie apocalypse survival (14M+ downloads; #2 most-downloaded modpack on Modrinth)  
**Tags**: zombie-apocalypse, survival, hardcore, quests  
**Minecraft Version**: 1.20.1 (Forge)  
**Memory**: 6GB recommended

## Overview

Zombie Invade 100 Days is the modern remake of the "100 Days Zombie
Apocalypse" challenge format: timed horde invasions, zombies that dig through
bases, guns and defenses. Built for groups that want pressure and base
building, in the same genre as Cursed Walking and DeceasedCraft (both also
configured in this repo).

## Quick Start

```bash
./scripts/start-server.sh zombie-invade-100-days
docker logs -f mc-zombie-invade-100-days
# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                       |
| --------------- | ------------------------------------------- |
| **Route**       | `zombie-invade-100-days.<MC_ROUTER_DOMAIN>` |
| **RCON**        | 26591                                       |
| **Memory**      | 6GB                                         |
| **Type**        | Modrinth (Forge)                            |
| **Max Players** | 20                                          |
| **Difficulty**  | Hard                                        |
| **Mode**        | Survival                                    |

## Connection

- **Address**: `zombie-invade-100-days.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `zombie-invade-100-days.192.168.1.10.nip.io`)
- **Version**: 1.20.1
- **Client**: Install "Zombie Invade 100 Days" from the Modrinth App or CurseForge launcher

## Features

- 🧟 **Timed horde nights** - Invasions scale with days survived
- ⛏️ **Siege zombies** - They break blocks: fortification actually matters
- 🔫 **Guns and defenses** - Turrets, traps, firearms and vehicles
- 🌍 **Apocalypse world** - Ruined cities and hostile exploration

## Configuration

Configuration file: `config/modpacks/zombie-invade-100-days.env`

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=zombie-invade-100-days
VERSION=1.20.1
MEMORY=6G
USE_AIKAR_FLAGS=true
```

`VERSION` is mandatory for Modrinth packs and must match the pack's Minecraft
version exactly. Optionally pin a release with `MODRINTH_VERSION=`.

Horde events spawn hundreds of entities, so view/simulation distance are kept
at 8/6 in the config — raise them only on strong hardware.

## Performance Tips

- **RAM**: 6GB; 8G recommended for 10+ players during horde nights
- **CPU**: 4+ cores — path-finding hordes are CPU-bound
- **Disk**: 12GB free space

## Troubleshooting

### Lag during horde nights

Lower `SIMULATION_DISTANCE` further (4-5) and enable AutoPause for idle
hours; consider pre-spawn-clearing with `/kill @e[type=...]` via RCON.

### Clients can't connect

1. Ensure the client runs the same pack build as the server
2. Verify the route resolves and mc-router is running (`./scripts/router.sh status`)

## Resources

- **Modpack Page**: https://modrinth.com/modpack/zombie-invade-100-days
- **Related**: [Cursed Walking](cursed-walking.md), [DeceasedCraft](deceasedcraft.md) — other zombie packs in this repo

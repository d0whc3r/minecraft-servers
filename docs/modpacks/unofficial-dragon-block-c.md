# Unofficial Dragon Block C Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/unofficial-dragon-block-c
**Type**: Dragon Ball themed modpack with transformations and Ki battles
**Minecraft Version**: 1.7.10
**Memory**: 4GB recommended

## Overview

Unofficial Dragon Block C brings the epic Dragon Ball universe to Minecraft. Become a Z-Fighter, master Super Saiyan transformations, unleash devastating Ki attacks like the Kamehameha, and battle legendary foes from the Dragon Ball sagas.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh unofficial-dragon-block-c

# Monitor startup (first time will take 10-15 minutes)
docker logs -f mc-unofficial-dragon-block-c

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                          |
| --------------- | ---------------------------------------------- |
| **Route**       | `unofficial-dragon-block-c.<MC_ROUTER_DOMAIN>` |
| **Memory**      | 4GB                                            |
| **Type**        | CurseForge                                     |
| **Max Players** | 20 (supports epic group battles)               |
| **Difficulty**  | Normal                                         |
| **Mode**        | Survival                                       |
| **PVP**         | Enabled (Dragon Ball combat)                   |
| **Container**   | mc-unofficial-dragon-block-c                   |

## Connection

- **Address**: `unofficial-dragon-block-c.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `unofficial-dragon-block-c.192.168.1.10.nip.io`)
- **Version**: 1.7.10
- **Client**: Install Unofficial Dragon Block C from CurseForge Launcher

## Features

- 🐉 **Dragon Ball Universe** - Complete DBZ/DBS experience
- ⚡ **Super Saiyan Transformations** - SSJ, SSJB, UI, and more
- 🌟 **Ki Attacks** - Kamehameha, Final Flash, Spirit Bomb
- 🏆 **Legendary Battles** - Fight Vegeta, Frieza, Buu, Jiren
- 📊 **Stats & Skills** - Level up your warrior abilities
- 🧙 **Masters Training** - Learn from Goku, Whis, and others
- 🗺️ **Custom Dimensions** - Dragon Ball themed worlds
- ⚔️ **Epic Combat** - Intense player vs player battles

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from CurseForge
2. Installs the mod loader and dependencies
3. Sets up all mods and Dragon Ball content
4. Generates the world with custom dimensions

Expect 10-15 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/unofficial-dragon-block-c.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/unofficial-dragon-block-c
VERSION=1.7.10

# Performance
MEMORY=4G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=unofficial-dragon-block-c # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
PVP=true # Essential for Dragon Ball combat
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `unofficial-dragon-block-c`
  - ❌ `Unofficial Dragon Block C` (spaces not allowed)
  - ❌ `Unofficial_Dragon_Block_C` (uppercase not allowed)

### Customization

Edit `config/modpacks/unofficial-dragon-block-c.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)
- PVP settings (`PVP`)

After changes, restart the server:

```bash
./scripts/restart-server.sh unofficial-dragon-block-c
```

## Client Setup

Players need to install the Unofficial Dragon Block C modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "Unofficial Dragon Block C"** in the app
3. **Install the modpack**
4. **Launch and connect** to the server route: `unofficial-dragon-block-c.<MC_ROUTER_DOMAIN>` (e.g. `unofficial-dragon-block-c.192.168.1.10.nip.io`)

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh unofficial-dragon-block-c

# Stop server
./scripts/stop-server.sh unofficial-dragon-block-c

# Restart server
./scripts/restart-server.sh unofficial-dragon-block-c

# View logs
docker logs -f mc-unofficial-dragon-block-c

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh unofficial-dragon-block-c
```

## Performance Tips

### Recommended Specs

- **RAM**: 4-6GB for smooth Dragon Ball battles
- **CPU**: 4-6 cores recommended
- **Disk**: 8-10GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 4GB memory allocation (Dragon Ball optimized)
- ✅ Optimized view distance (12 chunks for battles)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/unofficial-dragon-block-c.env
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
VIEW_DISTANCE=10 # Reduce if needed
```

## Gameplay Tips

### Character Progression

- Start as a basic fighter and train to become a Super Saiyan
- Master Ki attacks like Kamehameha and Spirit Bomb
- Level up your stats: Strength, Agility, Constitution

### Epic Battles

- Fight legendary villains from Dragon Ball lore
- Team up with friends for cooperative battles
- Use transformations strategically in combat

### World Exploration

- Discover Dragon Ball themed dimensions
- Find special training grounds and hidden areas
- Collect Dragon Balls for wishes

### Multiplayer Experience

- Perfect for 4-16 players in epic group battles
- Form alliances or rival teams
- Share training and progression tips

## Whitelist Setup

For controlled access to your Dragon Ball server:

```bash
# Edit config/modpacks/unofficial-dragon-block-c.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh unofficial-dragon-block-c
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-unofficial-dragon-block-c

# Common issues:
# - Router port busy: change MC_ROUTER_PORT in .env
# - Insufficient memory (need 4GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=6G

# Dragon Ball modpacks are memory intensive
```

### Clients can't connect

1. Ensure client has Unofficial Dragon Block C modpack installed
2. Verify the route `unofficial-dragon-block-c.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify server is running: `docker ps | grep unofficial-dragon-block-c`
4. Check server logs for errors

### World corruption

```bash
# Restore from backup
./scripts/restore.sh unofficial-dragon-block-c backups/unofficial-dragon-block-c/backup-YYYY-MM-DD.tar.gz
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh unofficial-dragon-block-c

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/unofficial-dragon-block-c.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh unofficial-dragon-block-c

# Remove force flag after update
```

## Community

- **Discord**: https://discord.gg/bt8n2YB6x8
- **YouTube**: https://www.youtube.com/@sh4d0wj0j0
- **Twitter**: https://twitter.com/Sh4d0wJ0J0

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/unofficial-dragon-block-c
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh unofficial-dragon-block-c

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh unofficial-dragon-block-c
```

## Support

For issues specific to:

- **Modpack content**: Check Unofficial Dragon Block C CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by Sh4d0wJ0J0 - Bringing the Dragon Ball universe to Minecraft._

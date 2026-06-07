# Solo Leveling - Reawakening Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-reawakening
**Type**: RPG-themed modpack with Solo Leveling progression system
**Minecraft Version**: 1.20.1
**Memory**: 4GB recommended

## Overview

Solo Leveling - Reawakening transforms Minecraft into an immersive hunting experience inspired by the Solo Leveling anime. Start as a weak E-rank hunter and climb through the ranks by defeating monsters, clearing dungeons, and mastering powerful abilities.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh solo-leveling-reawakening

# Monitor startup (first time will take 10-15 minutes)
docker logs -f mc-solo-leveling-reawakening

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                             |
| --------------- | --------------------------------- |
| **Port**        | 25571                             |
| **Memory**      | 4GB                               |
| **Type**        | CurseForge                        |
| **Max Players** | 20 (supports small-medium groups) |
| **Difficulty**  | Normal                            |
| **Mode**        | Survival                          |
| **PVP**         | Enabled (player combat)           |
| **Container**   | mc-solo-leveling-reawakening      |

## Connection

- **Address**: `your-server-ip:25571`
- **Version**: 1.20.1
- **Client**: Install Solo Leveling - Reawakening from CurseForge Launcher

## Features

- 🏹 **Hunter System** - Rank up from E-rank to S-rank hunter
- 🏰 **Dynamic Dungeons** - Randomly generated gate dungeons with bosses
- 📊 **Stat System** - Level up strength, agility, intelligence
- 🌍 **Multiple Dimensions** - Different worlds for various gate ranks
- ⚔️ **Custom Gear** - Craft and enhance hunter weapons/armor
- 🐉 **Boss Fights** - Challenging encounters with unique abilities
- 🌟 **Skill Tree** - Unlock combat and magical abilities
- 📜 **Quest System** - Complete missions for rewards

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from CurseForge
2. Installs the mod loader and dependencies
3. Sets up all mods and configurations
4. Generates the world with custom dimensions

Expect 10-15 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/solo-leveling-reawakening.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/solo-leveling-reawakening
# Pinned version — locks to this file so the modpack does NOT auto-update (remove CF_FILE_ID to track latest)
CF_FILE_ID=8195039
VERSION=1.20.1

# Performance
MEMORY=4G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=solo-leveling-reawakening # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
PVP=true # Player vs player combat enabled
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `solo-leveling-reawakening`
  - ❌ `Solo Leveling Reawakening` (spaces not allowed)
  - ❌ `Solo_Leveling_Reawakening` (uppercase not allowed)

### Customization

Edit `config/modpacks/solo-leveling-reawakening.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)
- PVP settings (`PVP`)

After changes, restart the server:

```bash
./scripts/restart-server.sh solo-leveling-reawakening
```

## Client Setup

Players need to install the Solo Leveling - Reawakening modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "Solo Leveling - Reawakening"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25573`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh solo-leveling-reawakening

# Stop server
./scripts/stop-server.sh solo-leveling-reawakening

# Restart server
./scripts/restart-server.sh solo-leveling-reawakening

# View logs
docker logs -f mc-solo-leveling-reawakening

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh solo-leveling-reawakening
```

## Performance Tips

### Recommended Specs

- **RAM**: 4-6GB for smooth operation
- **CPU**: 4-6 cores recommended
- **Disk**: 8-10GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 4GB memory allocation (RPG modpack optimized)
- ✅ Optimized view distance (12 chunks for exploration)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/solo-leveling-reawakening.env
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
VIEW_DISTANCE=10 # Reduce if needed
```

## Gameplay Tips

### Hunter Progression

- Start as E-rank and work your way up
- Complete quests and defeat monsters to level up
- Unlock new abilities in the skill tree

### Dungeon Exploration

- Look for "Gates" that spawn dungeons
- Gates are ranked E through S (increasing difficulty)
- Higher rank gates = better loot and XP

### Combat System

- Use the stat system to specialize (strength/agility/intelligence)
- Craft hunter gear for bonuses
- PVP enabled for player vs player combat

### Group Play

- Perfect for 2-10 players
- Coordinate dungeon runs
- Share loot and progress together

## Whitelist Setup

For controlled access to your RPG server:

```bash
# Edit config/modpacks/solo-leveling-reawakening.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh solo-leveling-reawakening
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-solo-leveling-reawakening

# Common issues:
# - Port 25571 already in use
# - Insufficient memory (need 4GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=6G

# RPG modpacks are memory intensive
```

### Clients can't connect

1. Ensure client has Solo Leveling - Reawakening modpack installed
2. Check firewall allows port 25571
3. Verify server is running: `docker ps | grep solo-leveling`
4. Check server logs for errors

### World corruption

```bash
# Restore from backup
./scripts/restore.sh solo-leveling-reawakening backups/solo-leveling-reawakening/backup-YYYY-MM-DD.tar.gz
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh solo-leveling-reawakening

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/solo-leveling-reawakening.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh solo-leveling-reawakening

# Remove force flag after update
```

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-reawakening
- **Creator Discord**: https://discord.gg/ghNhPG3rX6
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh solo-leveling-reawakening

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh solo-leveling-reawakening
```

## Support

For issues specific to:

- **Modpack content**: Check Solo Leveling - Reawakening CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by ProFake - A passionate Minecraft modpack creator specializing in anime-themed RPG experiences._

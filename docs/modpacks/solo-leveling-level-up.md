# Solo Leveling - Level Up Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-level-up
**Type**: Solo Leveling RPG modpack with gates system and skill progression
**Minecraft Version**: 1.20.1
**Memory**: 4GB recommended

## Overview

Solo Leveling: Level Up! brings the Solo Leveling universe to Minecraft with a comprehensive RPG system. Experience the hunter's journey from weakness to power through challenging gates, skill progression, and epic boss battles.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh solo-leveling-level-up

# Monitor startup (first time will take 10-15 minutes)
docker logs -f mc-solo-leveling-level-up

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                             |
| --------------- | --------------------------------- |
| **Port**        | 25575                             |
| **Memory**      | 4GB                               |
| **Type**        | CurseForge                        |
| **Max Players** | 20 (good for small-medium groups) |
| **Difficulty**  | Normal                            |
| **Mode**        | Survival                          |
| **PVP**         | Enabled (hunter battles)          |
| **Container**   | mc-solo-leveling-level-up         |

## Connection

- **Address**: `your-server-ip:25575`
- **Version**: 1.20.1
- **Client**: Install Solo Leveling - Level Up from CurseForge Launcher

## Features

- 🏰 **Gates System** - E to S-rank gates with increasing difficulty
- 📊 **Skill Points & Trees** - Customize your hunter abilities
- 👹 **Boss Battles** - Epic encounters with powerful enemies
- 💎 **Mana Crystals** - Collect and use crystals for progression
- 🏪 **Marketplace** - Purchase equipment with earned crystals
- 🏃 **Hunter Progression** - Level up and become stronger
- 🌟 **Power System** - Experience the Solo Leveling power scaling

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from CurseForge
2. Installs the mod loader and dependencies
3. Sets up the Solo Leveling mod configurations
4. Generates the world with gate systems

Expect 10-15 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/solo-leveling-level-up.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/solo-leveling-level-up
# Pinned version — locks to this file so the modpack does NOT auto-update (remove CF_FILE_ID to track latest)
CF_FILE_ID=7756412
VERSION=1.20.1

# Performance
MEMORY=4G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=solo-leveling-level-up # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
PVP=true # Essential for hunter combat
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `solo-leveling-level-up`
  - ❌ `Solo Leveling Level Up` (spaces not allowed)
  - ❌ `Solo_Leveling_Level_Up` (uppercase not allowed)

### Customization

Edit `config/modpacks/solo-leveling-level-up.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`)
- Simulation distance (`SIMULATION_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh solo-leveling-level-up
```

## Client Setup

Players need to install the Solo Leveling - Level Up modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "Solo Leveling: Level Up"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25577`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh solo-leveling-level-up

# Stop server
./scripts/stop-server.sh solo-leveling-level-up

# Restart server
./scripts/restart-server.sh solo-leveling-level-up

# View logs
docker logs -f mc-solo-leveling-level-up

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh solo-leveling-level-up
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
- ✅ 4GB memory allocation (optimized for modpack)
- ✅ Optimized view distance (12 chunks for exploration)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/solo-leveling-level-up.env
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
VIEW_DISTANCE=14 # Increase for better visuals
```

## Gameplay Tips

### Hunter Progression

- Start as a weak hunter and level up through combat
- Earn skill points to customize your abilities
- Invest in different skill trees for unique playstyles

### Gates System

- Gates appear randomly in the world
- Start with E-rank gates (easier)
- Progress through D, C, B, A, and S ranks
- Higher ranks = stronger enemies and better rewards

### Mana Crystals

- Primary currency earned from gates and combat
- Use crystals to purchase equipment and upgrades
- Visit the marketplace to spend your earnings

### Boss Battles

- Face powerful bosses in higher-level gates
- Each boss has unique abilities and attack patterns
- Defeating bosses grants significant rewards

### Multiplayer Experience

- Perfect for 5-20 players in cooperative groups
- Team up to tackle higher-level gates
- Compete for the best equipment and progression
- Share strategies and coordinate boss fights

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-solo-leveling-level-up

# Common issues:
# - Port 25575 already in use
# - Insufficient memory (need 4GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=6G

# RPG modpacks can be memory intensive
```

### Clients can't connect

1. Ensure client has Solo Leveling - Level Up modpack installed
2. Check firewall allows port 25575
3. Verify server is running: `docker ps | grep solo-leveling-level-up`
4. Check server logs for errors

### Progression issues

If you experience issues with:

- Skill points not applying
- Gates not spawning properly
- Mana not regenerating

Check the modpack's Discord for known fixes and commands.

## Whitelist Setup

For controlled access to your RPG server:

```bash
# Edit config/modpacks/solo-leveling-level-up.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh solo-leveling-level-up
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh solo-leveling-level-up

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/solo-leveling-level-up.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh solo-leveling-level-up

# Remove force flag after update
```

## Community

- **Discord**: https://discord.gg/ghNhPG3rX6
- **YouTube**: https://www.youtube.com/@PRO_FAKE
- **TikTok**: https://www.tiktok.com/@profake
- **Instagram**: https://www.instagram.com/pro__fake/
- **Website**: https://profake.netlify.app/

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-level-up
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh solo-leveling-level-up

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh solo-leveling-level-up
```

## Support

For issues specific to:

- **Modpack content**: Check Solo Leveling - Level Up CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by ProFake - Experience the hunter's journey in Solo Leveling: Level Up!_"

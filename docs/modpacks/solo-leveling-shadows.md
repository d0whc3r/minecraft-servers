# Solo Leveling - Shadows Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-shadows
**Type**: Advanced Solo Leveling RPG modpack with 400+ mods
**Minecraft Version**: 1.20.1
**Memory**: 6GB recommended

## Overview

Solo Leveling - Shadows is the ultimate Solo Leveling experience, featuring over 400 mods that transform Minecraft into a complete RPG adventure. With an extensive gates system, multiple hunter classes, custom quests, and deep progression mechanics, this modpack offers endless hours of immersive gameplay.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh solo-leveling-shadows

# Monitor startup (first time will take 15-20 minutes)
docker logs -f mc-solo-leveling-shadows

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                        |
| --------------- | ---------------------------- |
| **Port**        | 25574                        |
| **Memory**      | 6GB                          |
| **Type**        | CurseForge                   |
| **Max Players** | 30 (large community support) |
| **Difficulty**  | Normal                       |
| **Mode**        | Survival                     |
| **PVP**         | Enabled (hunter battles)     |
| **Container**   | mc-solo-leveling-shadows     |

## Connection

- **Address**: `your-server-ip:25574`
- **Version**: 1.20.1
- **Client**: Install Solo Leveling - Shadows from CurseForge Launcher

## Features

- 🏰 **Massive Mod Collection** - 400+ mods for complete transformation
- 🌟 **Advanced Gates System** - E to S-rank gates with increasing difficulty
- 📜 **Custom Quests** - 44 handcrafted FTB quests guiding your journey
- 🏹 **Hunter Classes** - Multiple classes: Necromancer, Fire Mage, Fighter, Tank, Support Mage, Ranger, Assassin
- 👑 **Advanced Classes** - Monarch classes: Beginning, White Flame, Frost, Brawl, Knight
- ⚔️ **Combat System** - Deep hunter progression and abilities
- 🏛️ **Custom Dimensions** - Unique worlds for different challenges
- 🎯 **Skill Trees** - Extensive ability customization

## First Startup

The first startup will take longer as the server:

1. Downloads the massive modpack (400+ mods) from CurseForge
2. Installs the mod loader and all dependencies
3. Sets up extensive mod configurations
4. Generates the world with custom dimensions and structures

Expect 15-20 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/solo-leveling-shadows.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/solo-leveling-shadows
VERSION=1.20.1

# Performance (high requirements for 400+ mods)
MEMORY=6G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=solo-leveling-shadows # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=30
DIFFICULTY=normal
PVP=true # Essential for hunter combat
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `solo-leveling-shadows`
  - ❌ `Solo Leveling Shadows` (spaces not allowed)
  - ❌ `Solo_Leveling_Shadows` (uppercase not allowed)

### Customization

Edit `config/modpacks/solo-leveling-shadows.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`) - higher for exploration
- Simulation distance (`SIMULATION_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh solo-leveling-shadows
```

## Client Setup

Players need to install the Solo Leveling - Shadows modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "Solo Leveling - Shadows"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25576`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh solo-leveling-shadows

# Stop server
./scripts/stop-server.sh solo-leveling-shadows

# Restart server
./scripts/restart-server.sh solo-leveling-shadows

# View logs
docker logs -f mc-solo-leveling-shadows

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh solo-leveling-shadows
```

## Performance Tips

### Recommended Specs

- **RAM**: 6-8GB for smooth operation
- **CPU**: 4-6 cores recommended
- **Disk**: 12-15GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 6GB memory allocation (optimized for large modpack)
- ✅ Optimized view distance (14 chunks for exploration)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/solo-leveling-shadows.env
MEMORY=8G
INIT_MEMORY=8G
MAX_MEMORY=8G
VIEW_DISTANCE=16 # Increase for better visuals
```

## Gameplay Tips

### Hunter Classes

Choose from multiple classes at the start:

- **Necromancer** - Unique class (one per server)
- **Fire Mage** - Ranged magical damage
- **Fighter** - Balanced melee combat
- **Tank** - High defense and survivability
- **Support Mage** - Healing and buffs
- **Ranger** - Ranged physical attacks
- **Assassin** - Stealth and burst damage

### Advanced Classes

Unlock powerful monarch classes later:

- Monarch of Beginning
- Monarch of White Flame
- Monarch of Frost
- Brawl
- Knight

### Gates System

- Start with E-rank gates (easy)
- Progress through D, C, B, A ranks
- Challenge S-rank gates for ultimate rewards
- Each rank offers stronger monsters and better loot

### Quest System

- 44 custom FTB quests guide your progression
- Complete quests for rewards and experience
- Follow the main storyline or explore side content

### Multiplayer Experience

- Perfect for 10-30 players in organized groups
- Form guilds or compete in PvP
- Share quests and tackle high-level gates together
- Extensive social features and community building

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-solo-leveling-shadows

# Common issues:
# - Port 25574 already in use
# - Insufficient memory (need 6GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=8G

# Large modpack with 400+ mods needs significant RAM
```

### Clients can't connect

1. Ensure client has Solo Leveling - Shadows modpack installed
2. Check firewall allows port 25574
3. Verify server is running: `docker ps | grep solo-leveling-shadows`
4. Check server logs for errors

### Game bugs/issues

The modpack includes several useful commands:

```bash
# Fix damage/mana issues
/updatetick_fix

# Fix multiplayer effects
/effect give @s solo_leveling:update_tick_effect infinite 0 true

# Disable round variables if needed
/round_variables false

# Adjust TPS for server lag
/set_tps_skip (1-20)

# Add items to shop
/add_item_to_shop (position) (cost)
```

## Whitelist Setup

For controlled access to your advanced RPG server:

```bash
# Edit config/modpacks/solo-leveling-shadows.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh solo-leveling-shadows
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh solo-leveling-shadows

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/solo-leveling-shadows.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh solo-leveling-shadows

# Remove force flag after update
```

## Community

- **Discord**: https://discord.gg/ghNhPG3rX6
- **YouTube**: https://www.youtube.com/@PRO_FAKE
- **TikTok**: https://www.tiktok.com/@profake
- **Instagram**: https://www.instagram.com/pro__fake/
- **Website**: https://profake.netlify.app/

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/solo-leveling-shadows
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh solo-leveling-shadows

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh solo-leveling-shadows
```

## Support

For issues specific to:

- **Modpack content**: Check Solo Leveling - Shadows CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by ProFake - The ultimate Solo Leveling experience with unparalleled depth and progression._

# My Hero Adventure Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/my-hero-adventure
**Type**: My Hero Academia themed modpack with quirks and hero battles
**Minecraft Version**: 1.16.5
**Memory**: 4GB recommended

## Overview

My Hero Adventure brings the world of My Hero Academia to Minecraft! Train to become a hero, master powerful quirks, battle villains, and ultimately face off against the ultimate antagonist - All For One. Experience the hero's journey in this action-packed modpack.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh my-hero-adventure

# Monitor startup (first time will take 10-15 minutes)
docker logs -f mc-my-hero-adventure

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                            |
| --------------- | -------------------------------- |
| **Port**        | 25576                            |
| **Memory**      | 4GB                              |
| **Type**        | CurseForge                       |
| **Max Players** | 20 (hero training grounds)       |
| **Difficulty**  | Normal                           |
| **Mode**        | Survival                         |
| **PVP**         | Enabled (hero vs villain combat) |
| **Container**   | mc-my-hero-adventure             |

## Connection

- **Address**: `your-server-ip:25576`
- **Version**: 1.16.5
- **Client**: Install My Hero Adventure from CurseForge Launcher

## Features

- 🦸 **15+ Quirks** - Master unique superpowers like One For All, Explosion, and more
- 👹 **MHA Mobs & Bosses** - Battle villains and face epic encounters
- ⚔️ **Hero Progression** - Train and level up to become the Number 1 Hero
- 🏆 **All For One** - Ultimate boss battle against the series' main antagonist
- 🎒 **MHA Items** - Collect hero gear, support items, and equipment
- 🏫 **UA High School** - Experience the hero academy setting
- 🤝 **Multiplayer Heroics** - Team up with other heroes for cooperative play

## First Startup

The first startup will take longer as the server:

1. Downloads the My Hero Academia modpack from CurseForge
2. Installs the mod loader and all hero/villain mods
3. Sets up quirk systems and hero progression
4. Generates the world with hero training grounds

Expect 10-15 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/my-hero-adventure.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/my-hero-adventure
VERSION=1.16.5

# Performance
MEMORY=4G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=my-hero-adventure # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
PVP=true # Essential for hero combat
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `my-hero-adventure`
  - ❌ `My Hero Adventure` (spaces not allowed)
  - ❌ `My_Hero_Adventure` (uppercase not allowed)

### Customization

Edit `config/modpacks/my-hero-adventure.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`)
- Simulation distance (`SIMULATION_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh my-hero-adventure
```

## Client Setup

Players need to install the My Hero Adventure modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "My Hero Adventure"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25578`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh my-hero-adventure

# Stop server
./scripts/stop-server.sh my-hero-adventure

# Restart server
./scripts/restart-server.sh my-hero-adventure

# View logs
docker logs -f mc-my-hero-adventure

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh my-hero-adventure
```

## Performance Tips

### Recommended Specs

- **RAM**: 4-6GB for smooth hero battles
- **CPU**: 4-6 cores recommended
- **Disk**: 8-10GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 4GB memory allocation (optimized for MHA modpack)
- ✅ Optimized view distance (10 chunks for battles)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/my-hero-adventure.env
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
VIEW_DISTANCE=12 # Increase for better exploration
```

## Gameplay Tips

### Quirk System

- Choose from 15+ unique quirks (superpowers)
- Each quirk has different strengths and abilities
- Master your quirk through training and battles
- Combine quirks strategically in combat

### Hero Progression

- Start as a student at UA High School
- Complete missions and defeat villains to level up
- Unlock new abilities and equipment
- Work towards becoming the Number 1 Hero

### Villain Battles

- Face off against iconic MHA villains
- Each villain has unique abilities and tactics
- Team up with other heroes for boss fights
- Prepare strategies for different villain types

### All For One Encounter

- The ultimate challenge of the modpack
- Requires preparation and teamwork
- Master multiple quirks for the best chance
- Epic final battle with high stakes

### Multiplayer Experience

- Perfect for 5-20 players in hero/villain scenarios
- Form hero teams or rival groups
- Cooperative boss fights and missions
- PvP arenas for hero vs hero combat

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-my-hero-adventure

# Common issues:
# - Port 25576 already in use
# - Insufficient memory (need 4GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=6G

# MHA modpacks with multiple quirks can be memory intensive
```

### Clients can't connect

1. Ensure client has My Hero Adventure modpack installed
2. Check firewall allows port 25576
3. Verify server is running: `docker ps | grep my-hero-adventure`
4. Check server logs for errors

### Quirk issues

If quirks aren't working properly:

- Check that the My Hero Academia mod is loaded
- Restart the client if quirks don't activate
- Some quirks may require specific conditions to work

## Whitelist Setup

For controlled access to your hero training server:

```bash
# Edit config/modpacks/my-hero-adventure.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh my-hero-adventure
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh my-hero-adventure

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/my-hero-adventure.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh my-hero-adventure

# Remove force flag after update
```

## Community

- **Discord**: https://discord.gg/bt8n2YB6x8
- **Twitter**: https://twitter.com/Sh4d0wJ0J0
- **Website**: https://sh4d0wj0j0.wixsite.com/gamersparadise/en
- **YouTube**: https://www.youtube.com/channel/UCctjTjZpjZUZbO6sJ73N75g

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/my-hero-adventure
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh my-hero-adventure

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh my-hero-adventure
```

## Support

For issues specific to:

- **Modpack content**: Check My Hero Adventure CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by Sh4d0wJ0J0 - "Plus Ultra!" - Experience the world of My Hero Academia in Minecraft!_"

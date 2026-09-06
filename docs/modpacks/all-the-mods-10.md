# All The Mods 10 Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
**Type**: Ultimate Kitchen Sink Modpack with 400+ mods
**Minecraft Version**: 1.21.1
**Memory**: 8GB recommended

## Overview

All The Mods 10 (ATM10) is the ultimate Minecraft modpack experience, featuring over 400 carefully selected mods that cover every aspect of modded Minecraft. From advanced technology and automation to powerful magic systems, dimensional exploration, and epic quests - ATM10 offers everything a modded Minecraft player could want in a single, cohesive package.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh all-the-mods-10

# Monitor startup (first time will take 20-30 minutes)
docker logs -f mc-all-the-mods-10

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                                |
| --------------- | ------------------------------------ |
| **Route**       | `all-the-mods-10.<MC_ROUTER_DOMAIN>` |
| **Memory**      | 8GB                                  |
| **Type**        | CurseForge                           |
| **Max Players** | 50 (massive community support)       |
| **Difficulty**  | Normal                               |
| **Mode**        | Survival                             |
| **PVP**         | Enabled (modded battles)             |
| **Container**   | mc-all-the-mods-10                   |

## Connection

- **Address**: `all-the-mods-10.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `all-the-mods-10.192.168.1.10.nip.io`)
- **Version**: 1.21.1
- **Client**: Install All The Mods 10 from CurseForge Launcher

## Features

- 🏭 **Ultimate Tech Mods** - Mekanism, Thermal Series, Industrial Foregoing, Powah
- 🔮 **Powerful Magic** - Botania, Blood Magic, Ars Nouveau, Occultism
- 🌍 **Dimensional Exploration** - Twilight Forest, The Aether, Undergarden, Beyond Earth
- ⚔️ **Combat & RPG** - Ice and Fire, Spartan Weaponry, Tough As Nails
- 🤖 **Automation** - Refined Storage, Applied Energistics 2, Create
- 🏰 **Building & Decor** - Chisel, Quark, Pam's HarvestCraft, Biomes O' Plenty
- 📜 **Quests & Progression** - FTB Quests, KubeJS custom content
- 🎮 **Quality of Life** - JEI, JourneyMap, Inventory Profiles, Mouse Tweaks

## First Startup

The first startup will take longer as the server:

1. Downloads the massive modpack (400+ mods) from CurseForge
2. Installs the mod loader and all dependencies
3. Sets up extensive mod configurations and datapacks
4. Generates the world with custom dimensions and structures

Expect 20-30 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/all-the-mods-10.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
VERSION=1.21.1

# Performance (high requirements for 400+ mods)
MEMORY=8G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=all-the-mods-10 # Must be lowercase, no spaces!

# Gameplay
MAX_PLAYERS=50
DIFFICULTY=normal
PVP=true # Essential for modded combat
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `all-the-mods-10`
  - ❌ `All The Mods 10` (spaces not allowed)
  - ❌ `All_The_Mods_10` (uppercase not allowed)

### Customization

Edit `config/modpacks/all-the-mods-10.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`) - higher for exploration
- Simulation distance (`SIMULATION_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh all-the-mods-10
```

## Client Setup

Players need to install the All The Mods 10 modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "All The Mods 10"** in the app
3. **Install the modpack**
4. **Launch and connect** to the server route: `all-the-mods-10.<MC_ROUTER_DOMAIN>` (e.g. `all-the-mods-10.192.168.1.10.nip.io`)

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh all-the-mods-10

# Stop server
./scripts/stop-server.sh all-the-mods-10

# Restart server
./scripts/restart-server.sh all-the-mods-10

# View logs
docker logs -f mc-all-the-mods-10

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh all-the-mods-10
```

## Performance Tips

### Recommended Specs

- **RAM**: 8-12GB for smooth operation
- **CPU**: 6-8 cores recommended
- **Disk**: 20-30GB free space
- **Network**: 15+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 8GB memory allocation (optimized for massive modpack)
- ✅ Optimized view distance (12 chunks for exploration)
- ✅ Rolling logs to prevent disk bloat

For more players or better performance:

```bash
# Edit config/modpacks/all-the-mods-10.env
MEMORY=12G
INIT_MEMORY=12G
MAX_MEMORY=12G
VIEW_DISTANCE=14 # Increase for better visuals
```

## Gameplay Tips

### Tech Progression

- Start with basic machinery and automation
- Progress through tiers: Steam → Electric → Advanced
- Master complex automation systems
- Build massive factories and processing plants

### Magic Systems

- Choose your magical path: Botania flowers, Blood Magic rituals, or Ars Nouveau spells
- Combine magic with technology for ultimate power
- Explore custom dimensions for rare resources

### Exploration & Dimensions

- Visit multiple dimensions: Twilight Forest, Aether, Undergarden
- Each dimension offers unique challenges and rewards
- Collect rare materials for advanced crafting

### Quest System

- Follow the comprehensive FTB Quests guide
- Complete chapters for rewards and progression unlocks
- Custom content designed specifically for ATM10

### Multiplayer Experience

- Perfect for 20-50 players in organized communities
- Form teams for different specializations (tech/magic/exploration)
- Share resources and coordinate large projects
- Extensive social features and community building

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-all-the-mods-10

# Common issues:
# - Router port busy: change MC_ROUTER_PORT in .env
# - Insufficient memory (need 8GB+)
# - CurseForge API issues
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=12G

# ATM10 with 400+ mods is extremely memory intensive
```

### Clients can't connect

1. Ensure client has All The Mods 10 modpack installed
2. Verify the route `all-the-mods-10.<MC_ROUTER_DOMAIN>` resolves to this host (nip.io/DNS) and mc-router is running (`./scripts/router.sh status`)
3. Verify server is running: `docker ps | grep all-the-mods-10`
4. Check server logs for errors

### Mod conflicts

ATM10 is carefully balanced, but issues can occur:

- Check for mod updates on CurseForge
- Verify client and server use exact same version
- Some mods may need configuration adjustments

## Whitelist Setup

For controlled access to your ultimate modded server:

```bash
# Edit config/modpacks/all-the-mods-10.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh all-the-mods-10
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh all-the-mods-10

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/all-the-mods-10.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh all-the-mods-10

# Remove force flag after update
```

## Community

- **ATM10 Discord**: https://discord.gg/allthemods
- **CurseForge Page**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
- **FTB Wiki**: https://ftb.fandom.com/wiki/All_The_Mods_10
- **Reddit**: https://reddit.com/r/allthemods

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/all-the-mods-10
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh all-the-mods-10

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh all-the-mods-10
```

## Support

For issues specific to:

- **Modpack content**: Check All The Mods 10 CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created for the ultimate modded Minecraft experience - All The Mods 10 brings everything together in perfect harmony._

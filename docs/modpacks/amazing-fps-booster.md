# Amazing FPS Booster Server

**CurseForge**: https://www.curseforge.com/minecraft/modpacks/amazing-fps-booster
**Type**: Performance optimization modpack (more powerful than OptiFine)
**Minecraft Version**: 1.20.1
**Memory**: 2GB recommended

## Overview

Amazing FPS Booster is a lightweight Fabric modpack designed to dramatically improve Minecraft performance and reduce lag. This optimization-focused modpack provides better FPS than traditional solutions like OptiFine, making it perfect for players with lower-end hardware or those seeking maximum performance.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh amazing-fps-booster

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-amazing-fps-booster

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                          |
| --------------- | ------------------------------ |
| **Port**        | 25575                          |
| **Memory**      | 2GB                            |
| **Type**        | CurseForge                     |
| **Max Players** | 10 (optimized for performance) |
| **Difficulty**  | Normal                         |
| **Mode**        | Survival                       |
| **PVP**         | Enabled                        |
| **Container**   | mc-amazing-fps-booster         |
| **Autopause**   | Enabled (resource saving)      |

## Connection

- **Address**: `your-server-ip:25575`
- **Version**: 1.20.1
- **Client**: Install Amazing FPS Booster from CurseForge Launcher

## Features

- ⚡ **Superior Performance** - More powerful than OptiFine
- 🏃 **Higher FPS** - Dramatic frame rate improvements
- 📉 **Reduced Lag** - Smoother gameplay experience
- 💾 **Lightweight** - Minimal resource usage
- 🔧 **Fabric-Based** - Modern mod loader
- ⏸️ **Auto-Pause** - Saves resources when no players online

## First Startup

The first startup will take longer as the server:

1. Downloads the optimization modpack from CurseForge
2. Installs Fabric and performance mods
3. Configures optimization settings
4. Generates the world

Expect 5-10 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/amazing-fps-booster.env`

### Key Settings

```bash
# Modpack settings
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/amazing-fps-booster
VERSION=1.20.1

# Performance (optimized for low resource usage)
MEMORY=2G
USE_AIKAR_FLAGS=true

# IMPORTANT: Server name restrictions
SERVER_NAME=amazing-fps-booster # Must be lowercase, no spaces!

# Resource saving
ENABLE_AUTOPAUSE=true # Highly recommended
AUTOPAUSE_TIMEOUT_EST=300
```

### Server Name Restrictions

⚠️ **CRITICAL**: The `SERVER_NAME` variable has strict requirements:

- **Must be lowercase only** (no uppercase letters)
- **No spaces allowed** (use hyphens or underscores)
- **Used for Docker container name**: `mc-{SERVER_NAME}`
- **Examples**:
  - ✅ `amazing-fps-booster`
  - ❌ `Amazing FPS Booster` (spaces not allowed)
  - ❌ `Amazing_FPS_Booster` (uppercase not allowed)

### Customization

Edit `config/modpacks/amazing-fps-booster.env` to customize:

- Player limit (`MAX_PLAYERS`)
- View distance (`VIEW_DISTANCE`) - increase for better visuals
- Simulation distance (`SIMULATION_DISTANCE`)
- Autopause settings for resource management

After changes, restart the server:

```bash
./scripts/restart-server.sh amazing-fps-booster
```

## Client Setup

Players need to install the Amazing FPS Booster modpack to connect:

1. **Install CurseForge App**: https://www.curseforge.com/download/app
2. **Search for "Amazing FPS Booster"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25575`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh amazing-fps-booster

# Stop server
./scripts/stop-server.sh amazing-fps-booster

# Restart server
./scripts/restart-server.sh amazing-fps-booster

# View logs
docker logs -f mc-amazing-fps-booster

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh amazing-fps-booster
```

## Performance Tips

### Recommended Specs

- **RAM**: 2-4GB (very lightweight)
- **CPU**: 2-4 cores sufficient
- **Disk**: 4-6GB free space
- **Network**: 5+ Mbps upload

### Optimization Features

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 2GB memory allocation (minimal footprint)
- ✅ Optimized view distance (8 chunks)
- ✅ Autopause enabled (saves resources)
- ✅ Rolling logs to prevent disk bloat

For more players:

```bash
# Edit config/modpacks/amazing-fps-booster.env
MEMORY=3G
INIT_MEMORY=3G
MAX_MEMORY=3G
MAX_PLAYERS=20
```

## Autopause Feature

This server has autopause enabled by default, which is highly recommended for performance modpacks:

- **Automatically pauses** when no players are online
- **Saves CPU and RAM** resources
- **Resumes instantly** when players join
- **Timeout**: 5 minutes after last player leaves

To adjust autopause settings:

```bash
# Edit config/modpacks/amazing-fps-booster.env
AUTOPAUSE_TIMEOUT_EST=600 # 10 minutes
AUTOPAUSE_TIMEOUT_INIT=600
```

## Gameplay Tips

### Performance Focus

- This modpack is designed for maximum performance
- Ideal for players with lower-end hardware
- Perfect for large base building or exploration
- Minimal impact on gameplay mechanics

### Server Usage

- Great for small to medium communities
- Excellent for private servers
- Low resource requirements make it cost-effective
- Autopause keeps hosting costs minimal

### Multiplayer Experience

- Smooth performance for all players
- No lag spikes from optimization mods
- Consistent frame rates
- Reliable for extended play sessions

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-amazing-fps-booster

# Common issues:
# - Port 25575 already in use
# - Insufficient memory (need 2GB+)
# - CurseForge API issues
```

### Performance issues

```bash
# The whole point of this modpack is performance!
# If you experience lag, check:
# - View distance settings
# - Player count vs server resources
# - Network connection
```

### Clients can't connect

1. Ensure client has Amazing FPS Booster modpack installed
2. Check firewall allows port 25575
3. Verify server is running: `docker ps | grep amazing-fps-booster`
4. Check server logs for errors

### Autopause not working

```bash
# Check autopause settings
ENABLE_AUTOPAUSE=true
AUTOPAUSE_TIMEOUT_EST=300

# Restart server after changes
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh amazing-fps-booster

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/amazing-fps-booster.env
CF_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh amazing-fps-booster

# Remove force flag after update
```

## Community

- **Discord**: https://discord.gg/bt8n2YB6x8
- **Twitter**: https://twitter.com/Sh4d0wJ0J0
- **Partner**: Mantle.gg

## Resources

- **Modpack Page**: https://www.curseforge.com/minecraft/modpacks/amazing-fps-booster
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **CurseForge Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/curseforge-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh amazing-fps-booster

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh amazing-fps-booster
```

## Support

For issues specific to:

- **Modpack content**: Check Amazing FPS Booster CurseForge page or Discord
- **Server setup**: Check main docs/TROUBLESHOOTING.md

---

_Created by Sh4d0wJ0J0 - Performance optimization for the masses._

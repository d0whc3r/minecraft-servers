# Slimes Adventure Modpack Server

**Modrinth**: https://modrinth.com/modpack/slimes-adventure  
**Type**: Adventure and exploration modpack  
**Minecraft Version**: Auto-detected from modpack  
**Memory**: 4GB recommended

## Overview

Slimes Adventure is an adventure-focused modpack designed for exploration, discovery, and fun gameplay. Perfect for players who enjoy exploring new content and challenges.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh slimes-adventure

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-slimes-adventure

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value    |
| --------------- | -------- |
| **Port**        | 25571    |
| **Memory**      | 4GB      |
| **Type**        | Modrinth |
| **Max Players** | 20       |
| **Difficulty**  | Normal   |
| **Mode**        | Survival |

## Connection

- **Address**: `your-server-ip:25571`
- **Version**: Check modpack page for exact version
- **Client**: Install Slimes Adventure modpack from Modrinth Launcher

## Features

- 🌍 **Exploration Focus** - New biomes and structures to discover
- ⚔️ **Adventure Content** - Quests and challenges
- ⚡ **Performance Optimized** - Runs smoothly with Aikar's flags
- 🛠️ **Quality of Life** - Various improvements for better gameplay

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from Modrinth
2. Installs the mod loader
3. Sets up all mods and dependencies
4. Generates the world

Expect 5-10 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/slimes-adventure.env`

### Key Settings

```bash
# Modpack settings
TYPE=MODRINTH
MODRINTH_MODPACK=slimes-adventure
VERSION=LATEST

# Performance
MEMORY=4G
USE_AIKAR_FLAGS=true

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
```

### Customization

Edit `config/modpacks/slimes-adventure.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- PVP settings (`PVP`)
- View distance (`VIEW_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh slimes-adventure
```

## Client Setup

Players need to install the Slimes Adventure modpack to connect:

1. **Install Modrinth App**: https://modrinth.com/app
2. **Search for "Slimes Adventure"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25571`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh slimes-adventure

# Stop server
./scripts/stop-server.sh slimes-adventure

# Restart server
./scripts/restart-server.sh slimes-adventure

# View logs
docker logs -f mc-slimes-adventure

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh slimes-adventure
```

## Performance Tips

### Recommended Specs

- **RAM**: 4-6GB for smooth operation
- **CPU**: 4+ cores recommended
- **Disk**: 8-10GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 4GB memory allocation
- ✅ Optimized view distance (10 chunks)
- ✅ Simulation distance (8 chunks)

For more players or better performance, increase memory:

```bash
# Edit config/modpacks/slimes-adventure.env
MEMORY=6G
INIT_MEMORY=6G
MAX_MEMORY=6G
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-slimes-adventure

# Common issues:
# - Port 25571 already in use
# - Insufficient memory
# - Network issues downloading modpack
```

### High memory usage

```bash
# Increase memory in config
MEMORY=6G

# Or reduce players/view distance
MAX_PLAYERS=10
VIEW_DISTANCE=8
```

### Clients can't connect

1. Ensure client has Slimes Adventure modpack installed
2. Check firewall allows port 25571
3. Verify server is running: `docker ps | grep slimes-adventure`
4. Check server logs for errors

### World corruption

```bash
# Restore from backup
./scripts/restore.sh slimes-adventure backups/slimes-adventure/backup-YYYY-MM-DD.tar.gz
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh slimes-adventure

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/slimes-adventure.env
MODRINTH_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh slimes-adventure

# Remove force flag after update
```

## Resources

- **Modpack Page**: https://modrinth.com/modpack/slimes-adventure
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **Modrinth Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh slimes-adventure

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh slimes-adventure
```

## Support

For issues specific to:

- **Modpack content**: Check Slimes Adventure Modrinth page
- **Server setup**: Check main docs/TROUBLESHOOTING.md

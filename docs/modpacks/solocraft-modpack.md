# SoloCraft Modpack Server

**Modrinth**: https://modrinth.com/modpack/solocraft-modpack  
**Type**: Survival-focused modpack for solo or small groups  
**Minecraft Version**: Auto-detected from modpack  
**Memory**: 3GB recommended

## Overview

SoloCraft is a carefully curated survival modpack designed specifically for solo players or small groups. It enhances the vanilla experience with quality-of-life improvements and balanced gameplay additions.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh solocraft-modpack

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-solocraft-modpack

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value                           |
| --------------- | ------------------------------- |
| **Port**        | 25572                           |
| **Memory**      | 3GB                             |
| **Type**        | Modrinth                        |
| **Max Players** | 10 (optimized for small groups) |
| **Difficulty**  | Normal                          |
| **Mode**        | Survival                        |
| **PVP**         | Disabled (friendly gameplay)    |

## Connection

- **Address**: `your-server-ip:25572`
- **Version**: Check modpack page for exact version
- **Client**: Install SoloCraft modpack from Modrinth Launcher

## Features

- 🎮 **Solo-Optimized** - Balanced for single-player or small groups
- 🛠️ **Quality of Life** - UI improvements and helpful mods
- ⚡ **Performance Focus** - Lightweight and efficient
- 🏡 **Survival Enhanced** - Improved vanilla survival experience
- 🔧 **Balanced Additions** - No overpowered content

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from Modrinth
2. Installs the mod loader
3. Sets up all mods and dependencies
4. Generates the world

Expect 5-10 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/solocraft-modpack.env`

### Key Settings

```bash
# Modpack settings
TYPE=MODRINTH
MODRINTH_MODPACK=solocraft-modpack
VERSION=LATEST

# Performance
MEMORY=3G
USE_AIKAR_FLAGS=true

# Gameplay
MAX_PLAYERS=10
DIFFICULTY=normal
PVP=false  # Friendly co-op gameplay
```

### Customization

Edit `config/modpacks/solocraft-modpack.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- View distance (`VIEW_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)
- Enable autopause for solo play

After changes, restart the server:

```bash
./scripts/restart-server.sh solocraft-modpack
```

### Autopause (Recommended for Solo Play)

Since this modpack is designed for solo/small groups, consider enabling autopause to save resources:

```bash
# Edit config/modpacks/solocraft-modpack.env
ENABLE_AUTOPAUSE=true
AUTOPAUSE_TIMEOUT_EST=300  # Pause after 5min of no players
AUTOPAUSE_TIMEOUT_INIT=300
```

This pauses the server when no one is online, saving CPU/RAM.

## Client Setup

Players need to install the SoloCraft modpack to connect:

1. **Install Modrinth App**: https://modrinth.com/app
2. **Search for "SoloCraft"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25572`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh solocraft-modpack

# Stop server
./scripts/stop-server.sh solocraft-modpack

# Restart server
./scripts/restart-server.sh solocraft-modpack

# View logs
docker logs -f mc-solocraft-modpack

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh solocraft-modpack
```

## Performance Tips

### Recommended Specs

- **RAM**: 3-4GB for smooth operation
- **CPU**: 2-4 cores sufficient
- **Disk**: 6-8GB free space
- **Network**: 5+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 3GB memory allocation (lightweight)
- ✅ Optimized view distance (10 chunks)
- ✅ PVP disabled for cooperative play

For more players or better performance:

```bash
# Edit config/modpacks/solocraft-modpack.env
MEMORY=4G
INIT_MEMORY=4G
MAX_MEMORY=4G
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-solocraft-modpack

# Common issues:
# - Port 25572 already in use
# - Insufficient memory
# - Network issues downloading modpack
```

### Low memory warnings

```bash
# Increase memory in config
MEMORY=4G

# SoloCraft is lightweight, 3GB should be sufficient
```

### Clients can't connect

1. Ensure client has SoloCraft modpack installed
2. Check firewall allows port 25572
3. Verify server is running: `docker ps | grep solocraft`
4. Check server logs for errors

### World corruption

```bash
# Restore from backup
./scripts/restore.sh solocraft-modpack backups/solocraft-modpack/backup-YYYY-MM-DD.tar.gz
```

## Gameplay Tips

### Solo Play

- Modpack is balanced for solo survival
- No need for multiple players
- Autopause recommended to save resources

### Small Group Play

- Perfect for 2-5 friends
- PVP disabled by default for cooperation
- Consider enabling whitelist for private group

### Whitelist Setup

```bash
# Edit config/modpacks/solocraft-modpack.env
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3

# Restart server
./scripts/restart-server.sh solocraft-modpack
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh solocraft-modpack

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/solocraft-modpack.env
MODRINTH_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh solocraft-modpack

# Remove force flag after update
```

## Resources

- **Modpack Page**: https://modrinth.com/modpack/solocraft-modpack
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **Modrinth Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

## Backup Strategy

```bash
# Manual backup
./scripts/backup.sh solocraft-modpack

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh solocraft-modpack
```

## Support

For issues specific to:

- **Modpack content**: Check SoloCraft Modrinth page
- **Server setup**: Check main docs/TROUBLESHOOTING.md

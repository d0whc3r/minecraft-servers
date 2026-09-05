# Cobbleverse Modpack Server

**Modrinth**: https://modrinth.com/modpack/cobbleverse  
**Type**: Fabric-based Pokemon adventure modpack with Cobblemon  
**Minecraft Version**: 1.21.1 (auto-detected)  
**Memory**: 6GB recommended

## Overview

Cobbleverse is a comprehensive Pokemon-themed modpack featuring Cobblemon, the popular Pokemon mod for Minecraft. It includes adventure, exploration, and quality-of-life improvements for an immersive Pokemon experience.

## Quick Start

```bash
# Start the server
./scripts/start-server.sh cobbleverse

# Monitor startup (first time will take 5-10 minutes)
docker logs -f mc-cobbleverse

# Wait for: "Done! For help, type 'help'"
```

## Server Details

| Setting         | Value             |
| --------------- | ----------------- |
| **Port**        | 25568             |
| **Memory**      | 6GB               |
| **Type**        | Modrinth (Fabric) |
| **Max Players** | 20                |
| **Difficulty**  | Normal            |
| **Mode**        | Survival          |

## Connection

- **Address**: `your-server-ip:25568`
- **Version**: 1.21.1 (check modpack page for exact version)
- **Client**: Install Cobbleverse modpack from Modrinth Launcher

## Features

- 🎮 **Cobblemon** - Catch, train, and battle Pokemon in Minecraft
- 🌍 **Adventure Content** - Explore custom structures and biomes
- ⚡ **Performance Optimized** - Runs smoothly with Aikar's flags
- 🛠️ **Quality of Life** - Various improvements for better gameplay

## First Startup

The first startup will take longer as the server:

1. Downloads the modpack from Modrinth
2. Installs Fabric mod loader
3. Sets up all mods and dependencies
4. Generates the world

Expect 5-10 minutes for initial setup.

## Configuration

Configuration file: `config/modpacks/cobbleverse.env`

### Key Settings

```bash
# Modpack settings
TYPE=MODRINTH
MODRINTH_MODPACK=cobbleverse
VERSION=LATEST

# Performance
MEMORY=6G
USE_AIKAR_FLAGS=true

# Gameplay
MAX_PLAYERS=20
DIFFICULTY=normal
ALLOW_FLIGHT=true # For flying Pokemon
```

### Customization

Edit `config/modpacks/cobbleverse.env` to customize:

- Player limit (`MAX_PLAYERS`)
- Difficulty (`DIFFICULTY`)
- PVP settings (`PVP`)
- View distance (`VIEW_DISTANCE`)
- Whitelist (`ENABLE_WHITELIST`, `WHITELIST`)

After changes, restart the server:

```bash
./scripts/restart-server.sh cobbleverse
```

## Client Setup

Players need to install the Cobbleverse modpack to connect:

1. **Install Modrinth App**: https://modrinth.com/app
2. **Search for "Cobbleverse"** in the app
3. **Install the modpack**
4. **Launch and connect** to `your-server-ip:25568`

⚠️ **Important**: Client and server must use the same modpack version.

## Server Management

```bash
# Start server
./scripts/start-server.sh cobbleverse

# Stop server
./scripts/stop-server.sh cobbleverse

# Restart server
./scripts/restart-server.sh cobbleverse

# View logs
docker logs -f mc-cobbleverse

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh cobbleverse
```

## Performance Tips

### Recommended Specs

- **RAM**: 6-8GB for smooth operation
- **CPU**: 4+ cores recommended
- **Disk**: 10-15GB free space
- **Network**: 10+ Mbps upload

### Optimization

Already enabled in configuration:

- ✅ Aikar's JVM flags for better GC
- ✅ 6GB memory allocation
- ✅ Optimized view distance (10 chunks)
- ✅ Simulation distance (8 chunks)

For more players or better performance, increase memory:

```bash
# Edit config/modpacks/cobbleverse.env
MEMORY=8G
INIT_MEMORY=8G
MAX_MEMORY=8G
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs mc-cobbleverse

# Common issues:
# - Port 25568 already in use
# - Insufficient memory
# - Network issues downloading modpack
```

### High memory usage

```bash
# Increase memory in config
MEMORY=8G

# Or reduce players/view distance
MAX_PLAYERS=10
VIEW_DISTANCE=8
```

### Clients can't connect

1. Ensure client has Cobbleverse modpack installed
2. Check firewall allows port 25568
3. Verify server is running: `docker ps | grep cobbleverse`
4. Check server logs for errors

### World corruption

```bash
# Restore from backup
./scripts/restore.sh cobbleverse backups/cobbleverse/backup-YYYY-MM-DD.tar.gz
```

## Gameplay Notes

### Pokemon Mechanics

- Pokemon spawn naturally in the world
- Use Pokeballs to catch them
- Build PC storage for your collection
- Battle wild Pokemon and other players (if PVP enabled)

### Server Commands

Useful commands for server operators:

```
/pokegive <player> <pokemon> - Give a Pokemon to a player
/pokeheal <player> - Heal a player's Pokemon
/pokegiveegg <player> <pokemon> - Give Pokemon egg
```

## Modpack Updates

To update the modpack to the latest version:

```bash
# Stop server
./scripts/stop-server.sh cobbleverse

# Update happens automatically on next start
# Or force update:
# Edit config/modpacks/cobbleverse.env
MODRINTH_FORCE_SYNCHRONIZE=true

# Start server
./scripts/start-server.sh cobbleverse

# Remove force flag after update
```

## Resources

- **Modpack Page**: https://modrinth.com/modpack/cobbleverse
- **Cobblemon Wiki**: https://wiki.cobblemon.com/
- **Docker Image Docs**: https://docker-minecraft-server.readthedocs.io/
- **Modrinth Configuration**: https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/

## Backup Strategy

Automatic backups recommended for this modpack due to:

- Pokemon data is valuable to players
- World generation is unique
- Mod updates can cause issues

```bash
# Manual backup
./scripts/backup.sh cobbleverse

# Setup automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh cobbleverse
```

## Support

For issues specific to:

- **Modpack content**: Check Cobbleverse Modrinth page
- **Cobblemon mod**: Check Cobblemon Discord/Wiki
- **Server setup**: Check main docs/TROUBLESHOOTING.md

# All The Mods 8 (ATM8)

**Type**: Kitchen Sink Modpack  
**Minecraft Version**: 1.20.1  
**Modpack Page**: [CurseForge - All The Mods 8](https://www.curseforge.com/minecraft/modpacks/all-the-mods-8)

## Overview

All The Mods 8 is a comprehensive kitchen-sink modpack featuring over 300 mods. It includes popular mods like Mekanism, Thermal Series, Create, Applied Energistics 2, and many more. Perfect for players who want access to all major tech and magic mods in one pack.

## Resource Requirements

### Minimum

- **RAM**: 8GB allocated to server
- **CPU**: 4+ cores recommended
- **Disk Space**: 10GB initial, 20GB+ with world data
- **Network**: 1Mbps upload per player

### Recommended

- **RAM**: 10-12GB for better performance
- **CPU**: 6+ cores (3.0GHz+)
- **Disk Space**: 30GB+ for long-term worlds
- **SSD**: Strongly recommended for chunk loading

## Configuration

### Server Config File

Location: `config/modpacks/atm8.env`

```env
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=8G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
SERVER_NAME=ATM8 Server
SERVER_PORT=25565
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=8
```

### Memory Tuning

Adjust `MEMORY` based on player count:

- 1-5 players: 8GB
- 5-10 players: 10GB
- 10-20 players: 12GB
- 20+ players: 14GB+

### View Distance

ATM8 is resource-intensive. Recommended settings:

- **Low-end**: `VIEW_DISTANCE=6`
- **Balanced**: `VIEW_DISTANCE=8` (default)
- **High-end**: `VIEW_DISTANCE=10`

## Starting the Server

```bash
# Start ATM8 server
./scripts/start-server.sh atm8

# Monitor startup (first start takes 5-10 minutes)
docker logs -f mc-atm8

# Wait for "Done! For help, type 'help'"
```

### First Startup

The first startup downloads the modpack files (~2GB) and generates world:

- **Download time**: 3-7 minutes (depending on connection)
- **World generation**: 2-3 minutes
- **Total first start**: 5-10 minutes

Subsequent startups: 1-2 minutes

## Connecting

- **Address**: `your-server-ip:25565`
- **Client**: Install ATM8 modpack from CurseForge
- **Launcher**: CurseForge App or ATLauncher recommended

## Performance Optimization

### Server Properties

Edit `servers/atm8/data/server.properties`:

```properties
# Reduce view distance for performance
view-distance=8

# Entity tracking range (lower = better performance)
entity-tracking-range.players=48
entity-tracking-range.animals=48
entity-tracking-range.monsters=48

# Reduce spawn limits if laggy
spawn-limits.monster=50
spawn-limits.animal=10
spawn-limits.water-animal=5
spawn-limits.ambient=15
```

### JVM Arguments

The itzg/minecraft-server image automatically optimizes JVM flags. For manual tuning, see [Server Tuning Guide](https://github.com/itzg/docker-minecraft-server#jvm-options).

### Common Performance Issues

**Issue**: Server TPS < 18

- **Solution**: Reduce `VIEW_DISTANCE` to 6
- **Solution**: Increase `MEMORY` allocation
- **Solution**: Limit player-built automation (chunk loaders)

**Issue**: High RAM usage

- **Solution**: Restart server daily (clears memory leaks)
- **Solution**: Increase `MEMORY` allocation

**Issue**: Slow chunk loading

- **Solution**: Use SSD storage
- **Solution**: Pre-generate world chunks (see below)

## World Pre-Generation

Reduces lag during exploration:

```bash
# Enter server console
docker exec -it mc-atm8 rcon-cli

# Pre-generate 5000 blocks radius (takes ~30 minutes)
/forge generate 0 0 0 5000

# Exit console
exit
```

## Backup Recommendations

ATM8 worlds can grow large quickly:

- **Frequency**: Daily backups recommended
- **Retention**: Keep 3-7 days of backups
- **Size**: Expect 500MB-5GB backup archives

```bash
# Create backup
./scripts/backup.sh atm8

# Automate daily backups
crontab -e
# Add: 0 3 * * * /path/to/scripts/backup.sh atm8
```

## Mod-Specific Notes

### Applied Energistics 2

- **Channels**: Enabled by default
- **Spatial IO**: Works on server
- **Performance**: ME systems can cause lag with many items

### Mekanism

- **Digital Miner**: Limit per player to prevent lag
- **Reactors**: Safe to build, follow in-game guide
- **Cables**: Use dense cables to reduce entity count

### Create

- **Contraptions**: Large rotating builds can cause TPS drops
- **Chunk Loading**: Use Mekanism or FTB Chunks for chunk loaders

### RFTools Dimensions

- **Custom Dimensions**: Work on server
- **Warning**: Can be very resource-intensive

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs mc-atm8

# Common issues:
# - Insufficient memory: Increase MEMORY in config
# - Corrupt download: Delete ./servers/atm8/data/ and restart
# - Java version: itzg image handles this automatically
```

### Players Can't Connect

- Verify server is running: `docker ps --filter "name=mc-atm8"`
- Check firewall: `sudo ufw allow 25565/tcp`
- Ensure client has exact same modpack version

### Crashes on World Load

- Check available RAM: `docker stats mc-atm8`
- Increase memory allocation
- Remove problematic chunks (backup first)

## Admin Commands

```bash
# Enter server console
docker exec -it mc-atm8 rcon-cli

# Make player operator
op PlayerName

# Teleport to player
tp PlayerName

# Set game mode
gamemode creative PlayerName

# Check TPS (target: 20)
forge tps

# List loaded chunks
forge dimensions

# Exit console
exit
```

## Updates

### Updating Modpack Version

```bash
# Stop server
docker stop mc-atm8

# Backup world
./scripts/backup.sh atm8

# Update version in config
nano config/modpacks/atm8.env
# Change VERSION to new version number

# Recreate container (downloads new modpack)
docker-compose up -d --force-recreate

# Monitor startup
docker logs -f mc-atm8
```

**Warning**: Always backup before updating. Modpack updates can break worlds.

## Community & Support

- **Modpack Discord**: [All The Mods Discord](https://discord.gg/allthemods)
- **Wiki**: [ATM8 Wiki](https://allthemods.com/wiki/)
- **Issue Tracker**: [GitHub Issues](https://github.com/AllTheMods/ATM-8/issues)
- **Reddit**: [r/allthemods](https://reddit.com/r/allthemods)

## Recommended Server Rules

For smooth gameplay:

1. **Limit chunk loaders**: Max 2-3 per player
2. **No excessive automation**: Coordinate with admins for large builds
3. **Regular restarts**: Daily at 3 AM (during automated backups)
4. **Backup before dimension travel**: Custom dimensions can corrupt

## Useful Mods for Admins

- **FTB Chunks**: Chunk claiming and loading
- **FTB Teams**: Player teams and shared claiming
- **ServerTools**: Admin utilities
- **LuckPerms**: Permission management

## Additional Resources

- [itzg/minecraft-server Documentation](https://docker-minecraft-server.readthedocs.io/)
- [ATM8 Getting Started Guide](https://allthemods.com/atm8/)
- [Server Optimization Guide](../TROUBLESHOOTING.md)

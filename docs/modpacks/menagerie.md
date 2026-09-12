# Menagerie

**Type**: Modpack Collection (AUTO_CURSEFORGE)  
**Tags**: creatures, exploration, adventure  
**Minecraft Version**: Auto-detected from modpack  
**Modpack Page**: [CurseForge - Menagerie](https://www.curseforge.com/minecraft/modpacks/menagerie)

## Overview

Menagerie is a curated collection of mods that provides an enhanced Minecraft experience with quality-of-life improvements, new content, and balanced gameplay modifications. This modpack focuses on exploration, automation, and technological progression while maintaining vanilla gameplay feel.

## Resource Requirements

### Minimum

- **RAM**: 4GB allocated to server
- **CPU**: 2 cores
- **Disk Space**: 3GB initial, 10GB+ with play
- **Network**: 512Kbps upload per player

### Recommended

- **RAM**: 6GB for optimal performance
- **CPU**: 4 cores
- **Disk Space**: 15GB+ for long-term worlds
- **SSD**: Recommended for better loading times

## Configuration

### Server Config File

Location: `config/modpacks/menagerie.env`

```env
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/menagerie
CF_EXCLUDE_MODS=fog
MEMORY=6G
SERVER_NAME=menagerie
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=10
USE_AIKAR_FLAGS=true
ENABLE_RCON=true
RCON_PORT=26577
```

### Memory Tuning

- 1-5 players: 4GB
- 6-15 players: 6GB
- 16-20 players: 8GB
- 20+ players: 10GB+

## Starting the Server

```bash
# Start Menagerie server
./scripts/start-server.sh menagerie

# First start: 5-10 minutes (modpack download and setup)
docker logs -f mc-menagerie
```

## Connecting

- **Address**: `menagerie.<MC_ROUTER_DOMAIN>` (mc-router; e.g. `menagerie.192.168.1.10.nip.io`)
- **Client**: Install Menagerie from CurseForge
- **Version**: Must match server (auto-detected from modpack)

## Gameplay Features

### Core Mods (Typical for Menagerie)

Menagerie typically includes a curated selection of popular mods such as:

- **JourneyMap**: In-game minimap and waypoints
- **JEI (Just Enough Items)**: Recipe viewer and item browser
- **Tinkers' Construct**: Customizable tools and weapons
- **Applied Energistics 2**: Advanced storage and automation
- **Thermal Expansion**: Power generation and processing
- **Botania**: Magic-based automation and decoration
- **Quark**: Quality-of-life improvements
- **Chisel & Bits**: Detailed building and decoration

### Progression Systems

- **Tech Tree**: Progressive unlocks through research/discovery
- **Magic Systems**: Alternative progression paths
- **Exploration**: New dimensions and biomes to discover
- **Automation**: Complex machine setups and item processing

## Server Configuration

### Difficulty Settings

Edit `servers/menagerie/data/server.properties`:

```properties
# Standard survival settings
difficulty=1
gamemode=survival
hardcore=false
pvp=true

# Performance settings
view-distance=10
simulation-distance=10
max-tick-time=60000
```

### Recommended Gamerules

```bash
# Enter console
docker exec -it mc-menagerie rcon-cli

# Quality of life improvements
/gamerule keepInventory true
/gamerule doFireTick false
/gamerule mobGriefing false
/gamerule doDaylightCycle true

exit
```

## Performance Optimization

### Memory Management

Menagerie includes many mods that can be memory-intensive:

- **View Distance**: 8-10 chunks (balance exploration vs performance)
- **Entity Limits**: Monitor mob farms and automatic farms
- **Chunk Loading**: Use chunk loaders sparingly

### Lag Prevention

Common sources of lag in modded servers:

1. **Mob Farms**: Too many entities loaded
2. **Complex Automation**: Large AE2 networks or processing setups
3. **World Generation**: New biomes and structures
4. **Player Bases**: Complex redstone and machinery

## Backup Strategy

### Frequency

- **Daily**: Automated world backups
- **Before Updates**: Manual backup before modpack updates
- **Major Builds**: Backup before constructing complex automation

```bash
# Create backup
./scripts/backup.sh menagerie

# Automate daily backups
crontab -e
0 3 * * * /path/to/scripts/backup.sh menagerie
```

## Admin Commands

```bash
# Enter server console
docker exec -it mc-menagerie rcon-cli

# Essential admin commands
op PlayerName
gamemode 1 PlayerName                # Creative mode for admin tasks
give PlayerName minecraft:diamond 64 # Give items for testing

# Server management
save-all
save-off
save-on

# Player management
kick PlayerName
ban PlayerName
pardon PlayerName

exit
```

## Common Issues

### Memory Issues

**Symptoms**: Server crashes, "OutOfMemoryError"

**Solutions**:

- Increase MEMORY in config (try 8G)
- Reduce view-distance to 8
- Monitor entity counts

### Mod Conflicts

**Symptoms**: Crashes on startup, missing items/recipes

**Solutions**:

- Check server logs for error messages
- Verify all players use same modpack version
- Update to latest modpack version

### Performance Lag

**Symptoms**: Low TPS, delayed responses

**Solutions**:

- Check `/tps` command output (target: 20)
- Reduce mob spawn limits
- Optimize player builds (remove excessive machinery)

## Player Progression Guide

### Early Game (Days 1-7)

1. **Resource Gathering**: Basic mining and farming
2. **Tool Crafting**: Upgrade to better tools
3. **Shelter Building**: Safe base establishment
4. **Food Security**: Sustainable food sources

### Mid Game (Weeks 1-2)

1. **Basic Automation**: Simple ore processing
2. **Power Generation**: First power sources
3. **Storage Solutions**: Organize inventory and storage
4. **Mob Farms**: Automated resource generation

### Late Game (Months 1+)

1. **Advanced Automation**: Complex processing chains
2. **Mass Storage**: AE2 networks or similar
3. **Exploration**: New dimensions and biomes
4. **Mega Builds**: Large-scale projects

## Community Features

### Multiplayer Considerations

- **Shared Bases**: Coordinate large building projects
- **Resource Sharing**: Trade systems and economies
- **Events**: Community challenges and competitions
- **Specialization**: Players focus on different skills

### Server Rules

1. **Respect Builds**: Don't grief other players' creations
2. **Share Resources**: Help new players get started
3. **Communicate**: Use voice/text chat for coordination
4. **Quality Standards**: Maintain server performance

## Updating the Modpack

```bash
# Backup world first!
./scripts/backup.sh menagerie

# Stop server
docker stop mc-menagerie

# Update modpack URL if needed
nano config/modpacks/menagerie.env
# Verify CF_PAGE_URL is current

# Restart server (will auto-download latest)
./scripts/start-server.sh menagerie
```

## Troubleshooting

### Can't Connect

- Verify modpack version matches server
- Check if all mods are properly installed
- Confirm server is running: `docker ps`

### Server Won't Start

```bash
# Check logs
docker logs mc-menagerie

# Common issues:
# - Memory allocation too low
# - Port conflicts
# - Modpack download failures
```

### World Corruption

```bash
# Stop server first
docker stop mc-menagerie

# Backup current world
cp -r servers/menagerie/data/world servers/menagerie/data/world.backup

# Remove corrupted chunks (if known)
# rm servers/menagerie/data/world/region/r.X.Z.mca

# Restart server
./scripts/start-server.sh menagerie
```

## Performance Monitoring

```bash
# Check server TPS
docker exec -it mc-menagerie rcon-cli tps

# Monitor memory usage
docker stats mc-menagerie

# View active timings (Paper/Spigot feature)
docker exec -it mc-menagerie rcon-cli timings on
# Wait 10 minutes, then:
/timings paste
```

## Mod-Specific Tips

### Applied Energistics 2

- **Channels**: Limited connection paths - plan networks carefully
- **Subnetworks**: Use interfaces to separate network segments
- **Storage**: Start small, expand as needed

### Thermal Expansion

- **Dynamos**: Different fuels for different power needs
- **Machines**: Upgrade tiers for better efficiency
- **Augments**: Customize machine behavior

### Tinkers' Construct

- **Tool Building**: Balance materials for best performance
- **Modifiers**: Plan ahead for tool upgrades
- **Smeltery**: Efficient ore processing

## Community Resources

- **CurseForge Page**: [Menagerie Modpack](https://www.curseforge.com/minecraft/modpacks/menagerie)
- **Wiki**: Check for mod-specific documentation
- **Discord**: Community support and discussions
- **Reddit**: r/feedthebeast or r/moddedminecraft

## Additional Resources

- [Modded Minecraft Performance Guide](https://www.reddit.com/r/feedthebeast/comments/2x9h8u/)
- [Server Administration Basics](https://minecraft.fandom.com/wiki/Tutorials/Setting_up_a_server)
- [Backup Best Practices](https://www.spigotmc.org/threads/backup-best-practices.379010/)

## Recommended Server Rules

1. **No Griefing**: Respect others' builds and creations
2. **Communication**: Use appropriate channels for coordination
3. **Performance**: Keep builds optimized for server health
4. **Helpfulness**: Assist new players and community members
5. **Quality over Quantity**: Focus on well-designed builds

## Support

For issues specific to Menagerie:

1. Check server logs: `docker logs mc-menagerie`
2. Verify modpack installation
3. Consult mod documentation
4. Check community forums/discord

For general Minecraft server issues:

1. Review this documentation
2. Check project troubleshooting guide
3. Search existing issues and solutions

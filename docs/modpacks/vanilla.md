# Vanilla Minecraft (Paper)

**Type**: Optimized Vanilla Server  
**Minecraft Version**: 1.20.4  
**Server Software**: Paper (Spigot/Bukkit fork)

## Overview

This is an optimized vanilla Minecraft experience using Paper server software. Paper maintains vanilla gameplay while providing performance improvements, bug fixes, and plugin support. Perfect for vanilla survival with friends or as a base for light plugin additions.

## Resource Requirements

### Minimum

- **RAM**: 2GB allocated to server
- **CPU**: 2 cores
- **Disk Space**: 2GB initial, 10GB+ with extended play
- **Network**: 512Kbps upload per player

### Recommended

- **RAM**: 4GB for 10+ players
- **CPU**: 4 cores for best performance
- **Disk Space**: 20GB+ for long-term worlds

## Configuration

### Server Config File

Location: `config/modpacks/vanilla.env`

```env
TYPE=PAPER
VERSION=1.20.4
MEMORY=2G
SERVER_NAME=Vanilla Server
SERVER_PORT=25567
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=10
```

### Memory Tuning

- 1-5 players: 2GB
- 6-15 players: 3GB
- 16-20 players: 4GB
- 20+ players: 6GB+

## Starting the Server

```bash
# Start vanilla server
./scripts/start-server.sh vanilla

# First start: ~2 minutes
docker logs -f mc-vanilla
```

## Connecting

- **Address**: `your-server-ip:25567`
- **Client**: Vanilla Minecraft Java Edition 1.20.4
- **No mods required**: Pure vanilla experience

## Why Paper?

Paper is a high-performance fork of Spigot that:

- ✅ **Maintains vanilla gameplay**: No gameplay changes
- ✅ **Better performance**: Optimized chunk loading, entity handling
- ✅ **Bug fixes**: Fixes many vanilla bugs
- ✅ **Plugin support**: Can add Bukkit/Spigot plugins if desired
- ✅ **Actively maintained**: Regular updates

## Server Configuration

### Server Properties

Edit `servers/vanilla/data/server.properties`:

```properties
# Server Info
motd="Vanilla Survival Server"
server-port=25567
max-players=20

# Gameplay
gamemode=survival
difficulty=normal
hardcore=false
pvp=true

# World
level-type=minecraft\:normal
level-seed=
spawn-protection=16
allow-nether=true
allow-flight=false

# Performance
view-distance=10
simulation-distance=10
max-tick-time=60000

# Network
network-compression-threshold=256
```

### Paper Configuration

Paper adds additional config files in `servers/vanilla/data/config/`:

**paper-global.yml**: Global server settings
**paper-world-defaults.yml**: Default world settings

Key optimizations (already configured by default):

- Async chunk loading
- Optimized entity activation
- Improved mob spawning logic

## Gameplay Features

### Pure Vanilla Mechanics

Everything works exactly as in vanilla:

- All vanilla crafting recipes
- All vanilla mob behaviors
- All vanilla structures
- Redstone mechanics unchanged

### Performance Improvements

You'll notice:

- Faster chunk loading
- Smoother gameplay with many players
- Better TPS under load
- Reduced memory usage

## Backup Strategy

Vanilla worlds typically smaller than modded:

- **Frequency**: Daily backups sufficient
- **Retention**: 3 backups (default)
- **Expected Size**: 100MB-2GB depending on exploration

```bash
# Create backup
./scripts/backup.sh vanilla

# Automate
crontab -e
0 3 * * * /path/to/scripts/backup.sh vanilla
```

## Admin Commands

```bash
# Enter server console
docker exec -it mc-vanilla rcon-cli

# Common commands
op PlayerName            # Make admin
deop PlayerName          # Remove admin
whitelist on             # Enable whitelist
whitelist add PlayerName # Add to whitelist
ban PlayerName           # Ban player
pardon PlayerName        # Unban player
kick PlayerName          # Kick from server

# Game rules
gamerule keepInventory true    # Keep items on death
gamerule doFireTick false      # Disable fire spread
gamerule mobGriefing false     # Prevent mob damage to blocks
gamerule doDaylightCycle false # Stop day/night cycle

# Teleport
tp PlayerName X Y Z        # Teleport to coords
tp PlayerName TargetPlayer # Teleport to player

# World management
save-all # Save world
save-off # Disable auto-save
save-on  # Enable auto-save

exit
```

## Optional Plugins

Paper supports Bukkit/Spigot plugins. Popular choices:

### Essential Plugins

- **EssentialsX**: Admin commands, homes, warps
- **LuckPerms**: Permission management
- **WorldEdit**: Building tool
- **WorldGuard**: Region protection
- **CoreProtect**: Rollback grief

### Adding Plugins

```bash
# Download .jar files to plugins directory
mkdir servers/vanilla/data/plugins
# Place plugin .jar files here

# Restart server
./scripts/restart-server.sh vanilla
```

**Note**: Plugins are optional. Server works perfectly without any.

## Performance Monitoring

```bash
# Check server TPS (target: 20)
docker exec -it mc-vanilla rcon-cli tps

# View memory usage
docker stats mc-vanilla

# Check timings (Paper feature)
docker exec -it mc-vanilla rcon-cli timings
```

## World Pre-Generation

Reduce lag during exploration:

```bash
# Enter console
docker exec -it mc-vanilla rcon-cli

# Pre-generate 5000 block radius
# (requires Chunky plugin or vanilla command)
/fill ~ ~ ~ ~5000 ~ ~5000 minecraft:air replace minecraft:air

# Or use world border
/worldborder center 0 0
/worldborder set 10000
```

## Troubleshooting

### Lag / Low TPS

```bash
# Check what's causing lag
docker exec -it mc-vanilla rcon-cli timings on
# Play for a while
docker exec -it mc-vanilla rcon-cli timings paste
# Get URL to view timing report
```

**Common fixes**:

- Reduce `VIEW_DISTANCE` in server.properties
- Limit entity farms (too many mobs)
- Pre-generate world
- Increase RAM allocation

### Players Can't Connect

- Check server is running: `docker ps`
- Verify version matches (1.20.4)
- Check firewall: `sudo ufw allow 25567/tcp`
- Confirm port forwarding if behind router

### Corrupted Chunks

```bash
# Backup first!
./scripts/backup.sh vanilla

# Delete corrupted region file
rm servers/vanilla/data/world/region/r.X.Z.mca
# Chunk will regenerate
```

## Gameplay Tips

### For Players

1. **Respect spawn area**: 16 block protection by default
2. **Build away from spawn**: Spread out to prevent lag
3. **Use beds wisely**: Sets respawn point
4. **Enchanting**: Build XP farms for efficiency
5. **Nether hub**: Coordinate 8:1 travel ratio

### For Admins

1. **Set spawn**: `/setworldspawn X Y Z`
2. **Enable whitelist**: For private servers
3. **Regular backups**: Before major updates
4. **Monitor resources**: Check TPS regularly
5. **Plan events**: Community builds, end fights, etc.

## Vanilla Survival Tips

### Early Game

1. Gather wood and make tools
2. Build simple shelter before night
3. Find food (animals, crops)
4. Mine for iron
5. Build farms for sustainable food

### Mid Game

1. Diamond gear and enchantments
2. Nether access for potions
3. Villager trading hall
4. Elytra from End Ship
5. Shulker boxes for storage

### Late Game

1. Beacon pyramids
2. Automated farms
3. Wither fight for nether star
4. Max enchantments
5. Massive builds and projects

## Server Events

### Community Projects

- Spawn area beautification
- Shopping district
- Mini-games arena
- Nether hub construction

### Challenges

- Dragon fight competition
- Build challenges
- PvP tournaments
- Speedrun events

## Updating Minecraft Version

```bash
# Backup world first!
./scripts/backup.sh vanilla

# Stop server
docker stop mc-vanilla

# Update version in config
nano config/modpacks/vanilla.env
# Change VERSION to new version (e.g., 1.20.5)

# Recreate container
docker compose up -d --force-recreate

# Monitor startup
docker logs -f mc-vanilla
```

**Warning**: Always backup before updating. Worlds can break across major versions.

## Community & Support

- **Paper Documentation**: [https://docs.papermc.io/](https://docs.papermc.io/)
- **Paper Discord**: [https://discord.gg/papermc](https://discord.gg/papermc)
- **Minecraft Wiki**: [https://minecraft.fandom.com/](https://minecraft.fandom.com/)
- **r/admincraft**: [https://reddit.com/r/admincraft](https://reddit.com/r/admincraft)

## Recommended Server Rules

1. **No griefing**: Respect other players' builds
2. **No stealing**: Take only from community chests
3. **No cheating**: Vanilla gameplay only
4. **Ask before major terrain changes**: Keep world pretty
5. **Have fun**: It's a game!

## Additional Resources

- [Paper Performance Tuning](https://docs.papermc.io/paper/aikars-flags)
- [Vanilla Survival Guide](https://minecraft.fandom.com/wiki/Tutorials/Beginner%27s_guide)
- [Server Administration Guide](https://minecraft.fandom.com/wiki/Tutorials/Setting_up_a_server)

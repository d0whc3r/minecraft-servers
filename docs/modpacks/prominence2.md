# Prominence II RPG

**Type**: RPG/Adventure Modpack  
**Minecraft Version**: 1.20.1  
**Modpack Page**: [CurseForge - Prominence II RPG](https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg)

## Overview

Prominence II RPG is an adventure-focused modpack with extensive RPG mechanics, custom quests, dungeons, and boss battles. Features include custom gear progression, skill trees, magic systems, and a complete overhaul of world generation.

## Resource Requirements

### Minimum

- **RAM**: 6GB allocated to server
- **CPU**: 4 cores recommended
- **Disk Space**: 8GB initial, 20GB+ with exploration
- **Network**: 1Mbps upload per player

### Recommended

- **RAM**: 8GB for optimal performance
- **CPU**: 6+ cores
- **Disk Space**: 30GB+ (worlds grow with exploration)
- **SSD**: Strongly recommended

## Configuration

### Server Config File

Location: `config/modpacks/prominence2.env`

```env
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=6G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg
SERVER_NAME=Prominence II RPG
SERVER_PORT=25567
MAX_PLAYERS=15
DIFFICULTY=normal
VIEW_DISTANCE=8
```

### Memory Tuning

- 1-5 players: 6GB
- 6-10 players: 8GB
- 11-15 players: 10GB

## Starting the Server

```bash
# Start Prominence II server
./scripts/start-server.sh prominence2

# First start: 4-8 minutes (mod download + world gen)
docker logs -f mc-prominence2
```

## Connecting

- **Address**: `your-server-ip:25567`
- **Client**: Install Prominence II RPG from CurseForge
- **Version**: Must match server (1.20.1)

## Gameplay Features

### RPG Systems

- **Class System**: Choose your class and spec
- **Skill Trees**: Unlock abilities as you level
- **Custom Gear**: Unique weapons, armor, and accessories
- **Stats**: Strength, Dexterity, Intelligence, etc.

### World Generation

Completely custom worldgen with:

- Custom biomes and structures
- Hand-crafted dungeons
- Boss arenas
- Villages with unique NPCs

### Quest System

- **Main Questline**: Guided progression
- **Side Quests**: Optional challenges and rewards
- **Daily Quests**: Renewable content
- **Boss Quests**: Epic challenges

## Server Settings

### Difficulty

Prominence II is designed for challenge:

```properties
# In server.properties
difficulty=2  # Normal (recommended for groups)
# OR
difficulty=3  # Hard (for experienced players)
```

### PvP

```env
# In prominence2.env
PVP=false  # Recommended for PvE-focused gameplay
# OR
PVP=true   # For PvP servers
```

## Performance Optimization

### View Distance

RPG modpacks benefit from good view distance for atmosphere:

- **Low**: `VIEW_DISTANCE=6` (minimal performance)
- **Balanced**: `VIEW_DISTANCE=8` (default)
- **High**: `VIEW_DISTANCE=10` (for powerful servers)

### Common Performance Issues

**Issue**: TPS drops during exploration

- **Solution**: Pre-generate world (see below)
- **Solution**: Increase memory to 8GB

**Issue**: Lag spikes when loading dungeons

- **Solution**: Use SSD storage
- **Solution**: Pre-generate world chunks

## World Pre-Generation

Highly recommended for RPG exploration:

```bash
docker exec -it mc-prominence2 rcon-cli

# Pre-generate 10000 block radius
/chunky world minecraft:overworld
/chunky radius 10000
/chunky start

# This takes 1-3 hours but eliminates exploration lag
```

## Backup Strategy

Exploration creates large worlds quickly:

- **Frequency**: Daily backups essential
- **Retention**: 5-7 days recommended
- **Expected Size**: 1GB-10GB depending on exploration

```bash
./scripts/backup.sh prominence2
```

## Gameplay Tips

### For Players

1. **Follow quests**: They guide progression
2. **Explore carefully**: Dungeons are dangerous
3. **Team up**: Many challenges require groups
4. **Gear matters**: Always upgrade equipment

### For Admins

1. **Encourage cooperation**: Bosses designed for groups
2. **Set spawn protection**: Protect starting area
3. **Regular restarts**: Daily restart recommended
4. **Monitor exploration**: Pre-gen world periodically

## Admin Tools

```bash
# Server console
docker exec -it mc-prominence2 rcon-cli

# Useful commands
op PlayerName
difficulty hard
gamemode adventure PlayerName  # Recommended for RPG feel
gamerule keepInventory true    # Optional: reduce death penalty

exit
```

## Troubleshooting

### Quests Not Working

Ensure FTB Quests is properly loaded:

```bash
docker logs mc-prominence2 | grep -i "ftb.*quests"
```

### Missing Structures

World generation can be resource-intensive:

- Allocate more memory (8GB+)
- Pre-generate world
- Use SSD storage

### Boss Fights Laggy

- Reduce particle effects (client-side settings)
- Ensure server has adequate RAM (8GB+)
- Restart server before major boss fights

## Mod Highlights

### RPG Mods

- **PlayerEx**: Attribute and level system
- **ParCool**: Parkour and movement abilities
- **Epic Fight**: Improved combat mechanics
- **Nameless Trinkets**: Accessory system

### Exploration

- **Yung's Better...**: Improved structures
- **Repurposed Structures**: More variety
- **Dungeons Arise**: Epic dungeons

### Magic & Abilities

- **Ars Nouveau**: Spell crafting
- **Botania**: Nature magic
- **Hexerei**: Witchcraft

## Community & Support

- **Discord**: [Prominence Discord](https://discord.com/invite/prominence)
- **Wiki**: [Modpack Wiki](https://prominence.fandom.com/)
- **Quests**: Available in-game via Quest Book

## Recommended Server Rules

1. **No griefing**: RPG servers are collaborative
2. **Respect claimed land**: Use FTB Chunks
3. **Boss etiquette**: Don't kill-steal
4. **Trading encouraged**: Player economy adds depth

## Additional Resources

- [Prominence II Getting Started](https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg)
- [Quest Guide](https://prominence.fandom.com/wiki/Quests)
- [Boss Strategy Guide](https://prominence.fandom.com/wiki/Bosses)

# RLCraft

**Type**: Hardcore Survival Modpack  
**Minecraft Version**: 1.12.2  
**Modpack Page**: [CurseForge - RLCraft](https://www.curseforge.com/minecraft/modpacks/rlcraft)

## Overview

RLCraft (Real Life Craft) is an extremely challenging hardcore survival modpack. Features realistic survival mechanics, deadly monsters, environmental hazards, and permadeath risk. This pack transforms Minecraft into a brutal survival experience with leveling systems, seasons, temperature, thirst, and locational damage.

⚠️ **Warning**: This is one of the hardest Minecraft modpacks. Not recommended for beginners.

## Resource Requirements

### Minimum

- **RAM**: 6GB allocated to server
- **CPU**: 4 cores
- **Disk Space**: 5GB initial, 15GB+ with play
- **Network**: 1Mbps upload per player

### Recommended

- **RAM**: 8GB (reduces crashes)
- **CPU**: 6+ cores
- **Disk Space**: 20GB+
- **SSD**: Strongly recommended for world loading

## Configuration

### Server Config File

Location: `config/modpacks/rlcraft.env`

```env
TYPE=AUTO_CURSEFORGE
VERSION=1.12.2
MEMORY=6G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/rlcraft
SERVER_NAME=RLCraft
SERVER_PORT=25568
MAX_PLAYERS=15
DIFFICULTY=hard
VIEW_DISTANCE=8
```

### Memory Tuning

RLCraft is memory-intensive due to complex mechanics:

- 1-5 players: 6GB
- 6-10 players: 8GB
- 11-15 players: 10GB

## Starting the Server

```bash
# Start RLCraft server
./scripts/start-server.sh rlcraft

# First start: 5-8 minutes (large mod pack)
docker logs -f mc-rlcraft
```

## Connecting

- **Address**: `your-server-ip:25568`
- **Client**: Install RLCraft from CurseForge
- **Difficulty**: Set to Hard for authentic experience

## Gameplay Mechanics

### Survival Challenges

**Temperature**:

- Monitor body temperature
- Hypothermia in cold biomes
- Hyperthermia in hot biomes
- Build campfires for warmth

**Thirst**:

- Drink water regularly
- Purify dirty water or risk poison
- Canteens essential for exploration

**Locational Damage**:

- Headshots deal massive damage
- Protect vital areas with armor
- Different creatures target different body parts

**Skill System**:

- Level up individual skills
- Mining, farming, defense, agility, etc.
- Skills improve efficiency and unlock abilities

### Environmental Hazards

- **Seasons**: Crops grow based on season
- **Weather**: Extreme weather can kill
- **Fall Damage**: Deadly - carry bandages
- **Poison**: Common, always carry antidote
- **Infection**: Can spread from wounds

### Difficulty Spikes

1. **First Night**: Build shelter immediately
2. **Underground**: Extremely dangerous
3. **Dungeons**: Often impossible early game
4. **Dragons**: Late-game boss fights

## Server Configuration

### Difficulty Settings

Edit `servers/rlcraft/data/server.properties`:

```properties
# Always Hard for authentic RLCraft
difficulty=3

# PvP (consider disabling - game is hard enough)
pvp=false

# Keep inventory (optional - reduces frustration)
# Set in-game: /gamerule keepInventory true
```

### Recommended Server Rules

RLCraft on servers needs special rules:

```properties
# In server.properties
spawn-protection=16  # Protect spawn area

# Recommended gamerules (set in console)
/gamerule keepInventory true      # Optional: reduce rage quits
/gamerule doFireTick false        # Optional: prevent base burn-down
/gamerule mobGriefing false       # Optional: protect builds
```

## Performance Tips

### View Distance

RLCraft has complex mob AI and physics:

- **Minimum**: `VIEW_DISTANCE=6`
- **Balanced**: `VIEW_DISTANCE=8` (default)
- **Maximum**: `VIEW_DISTANCE=10` (only on powerful servers)

### Lag Sources

1. **Many mobs loaded**: Reduce spawn caps
2. **Lycanite's mobs**: Computationally expensive
3. **Ice & Fire dragons**: Large entities, cause lag
4. **Player bases**: Complex builds with many blocks

### Server Optimization

Edit `servers/rlcraft/data/server.properties`:

```properties
# Reduce mob spawns if laggy
spawn-limits.monster=50
spawn-limits.animal=10
spawn-limits.water-animal=3

# Reduce entity tracking
entity-tracking-range.players=64
entity-tracking-range.animals=48
entity-tracking-range.monsters=64
```

## Backup Strategy

⚠️ **Critical for RLCraft**:

- Players WILL die and lose everything
- Corrupted chunks more common due to mod complexity
- Always have recent backups available

```bash
# Backup before major events
./scripts/backup.sh rlcraft

# Automate daily backups
crontab -e
0 3 * * * /path/to/scripts/backup.sh rlcraft
```

## Admin Commands

```bash
# Enter console
docker exec -it mc-rlcraft rcon-cli

# Useful admin commands
op PlayerName
gamemode 1 PlayerName           # Creative (for stuck players)
effect PlayerName clear          # Remove negative effects
tp PlayerName 0 100 0            # Rescue from dangerous location

# Give basic survival kit
give PlayerName minecraft:bread 16
give PlayerName minecraft:bandage 8
give PlayerName spartanweaponry:dagger_iron 1

exit
```

## Common Issues

### Players Keep Dying

This is normal for RLCraft. Tips for players:

1. **Don't rush**: Gather resources carefully
2. **Stay near spawn**: Early game
3. **Build safe house**: Underground is NOT safe
4. **Carry supplies**: Bandages, food, water always
5. **Avoid night**: Sleep or hide

### Server Crashes

RLCraft is crash-prone:

- Increase memory to 8GB minimum
- Use SSD storage
- Regular restarts (daily recommended)
- Update to latest RLCraft version

### Chunk Corruption

Can happen with complex mob spawning:

```bash
# Backup first!
./scripts/backup.sh rlcraft

# Remove corrupted region file
rm servers/rlcraft/data/world/region/r.X.Z.mca

# Chunk will regenerate on next load
```

## Mod Highlights

### Survival Mods

- **Tough As Nails**: Temperature, thirst, seasons
- **First Aid**: Locational damage system
- **Somnia**: Realistic sleep and exhaustion

### Combat & Mobs

- **Lycanite's Mobs**: Dozens of new creatures
- **Ice & Fire**: Dragons and mythical beasts
- **Spartan Weaponry**: Realistic weapons
- **Spartan Shields**: Shield combat system

### Difficulty Enhancers

- **Scaling Health Difficulty**: Mobs scale with player
- **Rough Mobs**: Smarter, harder enemies
- **Bloodmoon**: Deadly event nights

## Player Tips

### Essential First Day Tasks

1. **Punch grass**: Get plant fiber
2. **Craft flint tools**: Skip wood tools
3. **Kill passive mobs**: Get food immediately
4. **Build shelter**: 4 walls + roof before night
5. **Craft bed**: Sleep through dangerous nights
6. **Find water**: Fill canteen

### Progression Guide

1. **Early**: Stone tools, basic shelter, food
2. **Mid**: Iron armor, weapon, tamed mount
3. **Late**: Diamond gear, enchantments, dragons
4. **End**: Max-level skills, best enchantments, Ender Dragon

## Server Events

### Bloodmoon Events

Random event where all mobs become extremely aggressive:

- Happens randomly at night
- All players should hide or work together
- Provides valuable loot drops

### Dragon Raids

Dragons may attack player bases:

- Build anti-dragon defenses (stone+, not wood)
- Have fire resistance potions ready
- Team up to fight back

## Community & Support

- **RLCraft Discord**: [Discord Server](https://discord.gg/rlcraft)
- **Wiki**: [RLCraft Wiki](https://rlcraft.fandom.com/)
- **Reddit**: [r/RLCraft](https://reddit.com/r/RLCraft)
- **Shivaxi** (Creator): [Twitter](https://twitter.com/ShivaxiRLCraft)

## Recommended Server Rules

1. **No griefing**: Game is hard enough
2. **Cooperation encouraged**: Share resources
3. **Safe zones**: Designate spawn area as safe
4. **Death penalties**: Decide on keepInventory setting
5. **Raid protection**: Protect player bases from mobs

## Warnings

⚠️ **This modpack is EXTREMELY DIFFICULT**:

- Expect frequent deaths
- Early game is brutal
- Random deaths from environmental hazards
- Not fun for everyone

🔥 **Server Health**:

- Regular crashes possible
- Keep backups
- Monitor server health closely
- Restart daily

## Additional Resources

- [RLCraft Beginner's Guide](https://rlcraft.fandom.com/wiki/Beginners_Guide)
- [Combat Guide](https://rlcraft.fandom.com/wiki/Combat)
- [Taming Guide](https://rlcraft.fandom.com/wiki/Taming)
- [Lycanite's Mobs Bestiary](https://rlcraft.fandom.com/wiki/Lycanites_Mobs)

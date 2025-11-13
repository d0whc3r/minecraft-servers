# SkyFactory 4

**Type**: Skyblock Modpack  
**Minecraft Version**: 1.12.2  
**Modpack Page**: [CurseForge - SkyFactory 4](https://www.curseforge.com/minecraft/modpacks/skyfactory-4)

## Overview

SkyFactory 4 is a classic skyblock modpack featuring tech progression in a void world. Start on a single tree and build up through resource generation, automation, and dimensional exploration. Includes Tinkers' Construct, Thermal Expansion, Applied Energistics 2, and custom progression systems.

## Resource Requirements

### Minimum

- **RAM**: 4GB allocated to server
- **CPU**: 2+ cores
- **Disk Space**: 3GB initial, 10GB+ with player bases
- **Network**: 512Kbps upload per player

### Recommended

- **RAM**: 6GB for smoother performance
- **CPU**: 4 cores
- **Disk Space**: 15GB+ for established servers
- **SSD**: Recommended for better chunk loading

## Configuration

### Server Config File

Location: `config/modpacks/skyfactory4.env`

```env
TYPE=AUTO_CURSEFORGE
VERSION=1.12.2
MEMORY=6G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/skyfactory-4
SERVER_NAME=skyfactory4
SERVER_PORT=25565
MAX_PLAYERS=10
DIFFICULTY=normal
VIEW_DISTANCE=10
```

### Memory Tuning

- 1-3 players: 4GB
- 4-7 players: 5GB
- 8-10 players: 6GB
- 10+ players: 8GB

## Starting the Server

```bash
# Start SkyFactory 4 server
./scripts/start-server.sh skyfactory4

# Monitor startup (first start: 3-5 minutes)
docker logs -f mc-skyfactory4
```

## Connecting

- **Address**: `your-server-ip:25565`
- **Client**: Install SkyFactory 4 from CurseForge
- **Version**: Must match server (1.12.2)

## Gameplay Notes

### Starting Island

Each player spawns on their own small island. World is void - falling = death!

### Early Game Progression

1. **Tree farming**: Use saplings and dirt to expand
2. **Cobblestone generation**: Use water + lava
3. **Ore generation**: Sieving gravel/sand/dust
4. **Basic machines**: Crafting table → Furnace → Basic machines

### Mid-Game

- **Applied Energistics 2**: Storage and autocrafting
- **Thermal Expansion**: Power generation and automation
- **Tinkers' Construct**: Custom tools and weapons

### Late Game

- **Extreme Reactors**: Massive power generation
- **Refined Storage**: Alternative to AE2
- **Prestige System**: Reset progress for rewards

## Server-Specific Settings

### Spawn Protection

Edit `servers/skyfactory4/data/server.properties`:

```properties
# Disable spawn protection (skyblock)
spawn-protection=0

# Allow nether
allow-nether=true

# Peaceful mode or not (recommended: normal)
difficulty=2
```

### Island Spacing

Players spawn on separate islands. Configure spacing in:
`servers/skyfactory4/data/config/skyfactory.cfg`

## Performance Tips

SkyFactory 4 is generally lighter than modern modpacks:

- **Stable TPS**: Usually maintains 20 TPS with 4GB RAM
- **Chunk Loading**: Players should use minimal chunk loaders
- **Automation**: Excessive cobblestone generators can cause lag

### Common Lag Sources

1. **Too many sieves running**: Limit to 4-5 per player
2. **Huge AE2 systems**: Use level emitters to control crafting
3. **Animal farms**: Use industrial alternatives (Rancher, etc.)

## Backup Recommendations

```bash
# Daily backups recommended
./scripts/backup.sh skyfactory4

# Worlds typically 200MB-2GB after extended play
```

## Admin Commands

```bash
# Enter console
docker exec -it mc-skyfactory4 rcon-cli

# Common commands
op PlayerName
tp @a 0 64 0          # Teleport all to spawn
gamemode 1 PlayerName # Creative mode

# Exit
exit
```

## Troubleshooting

### Players Falling Through World

This is normal - void world! Players need to:

1. Be careful near edges
2. Build platforms before moving
3. Use flight items (Angel Ring, etc.) later

### Islands Not Generating

Check config: `servers/skyfactory4/data/config/skyfactory.cfg`

Ensure spawn type is set correctly.

## Mod Highlights

### Prestige System

Unique to SF4 - allows resetting progress for powerful bonuses.

### Bonsai Trees

Automated tree farming in small space - essential early game.

### Culinary Construct

Custom food creation for powerful buffs.

### Mystical Agriculture

Resource farming through crops - late game essential.

## Community & Support

- **Modpack Discord**: [SkyFactory Discord](https://discord.gg/playcdu)
- **Wiki**: [SkyFactory 4 Wiki](https://ftb.fandom.com/wiki/FTB_SkyFactory_4)
- **Reddit**: [r/SkyFactory](https://reddit.com/r/SkyFactory)

## Recommended Rules

1. **No griefing** other islands
2. **Request permission** before visiting other islands
3. **Limit chunk loaders**: 1-2 per player
4. **Regular backups**: Before major builds

## Additional Resources

- [SkyFactory 4 Quest Book](https://ftb.fandom.com/wiki/FTB_SkyFactory_4/Quests)
- [Progression Guide](https://ftb.fandom.com/wiki/FTB_SkyFactory_4/Getting_Started)

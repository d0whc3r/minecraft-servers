# Quick Start Guide

Get your first Minecraft server running in ~5 minutes. For how the system works internally, see [Architecture](ARCHITECTURE.md).

## Prerequisites

- **Docker** 20.10+ and **Docker Compose** v2+ installed
- **Linux** server (Ubuntu 20.04+, Debian 11+, or compatible)
- **4GB RAM** minimum (2GB for the vanilla server)
- **20GB disk space** minimum

### Verify Docker Installation

```bash
docker --version       # Should show 20.10.x+
docker compose version # Should show v2.x.x+
docker ps              # Should run without errors
```

## Quick Start

### 1. Configure Environment

```bash
# Copy the shared template
cp .env.example .env

# Defaults work out of the box; typically you only set:
#   CF_API_KEY      – required for CurseForge modpacks (vanilla works without it)
#   RCON_PASSWORD   – change it in production
nano .env
```

⚠️ **Important**: `EULA=TRUE` (already set in the template) indicates you accept the
[Minecraft EULA](https://www.minecraft.net/en-us/eula).

### 2. Start Vanilla Server

```bash
# Start the vanilla server (Paper 26.2, port 25567)
./scripts/start-server.sh vanilla

# Monitor startup (takes ~2 minutes first time)
docker logs -f mc-vanilla

# Look for: "Done (…)! For help, type 'help'"
# Press Ctrl+C to exit logs (server keeps running)
```

### 3. Connect

1. Open **Minecraft Java Edition**
2. Click **Multiplayer** → **Add Server**
3. Enter:
   - **Server Name**: My Vanilla Server
   - **Server Address**: `your-server-ip:25567`
4. Click **Done** and **Join Server**

🎉 **You're in!** Your first server is running.

## Verify Persistence

```bash
# Build something in-game, then restart
docker restart mc-vanilla

# Reconnect - your build is still there!
```

World data persists in `./servers/vanilla/data/` on your host.

## What You Built

```
minecraft-servers/
├── docker-compose.yml       # Single template service
├── .env                     # Shared settings
├── config/modpacks/
│   └── vanilla.env          # Vanilla config
├── servers/
│   └── vanilla/
│       └── data/            # ← Your world is here!
└── backups/
    └── vanilla/             # Backup storage
```

## Day-to-Day Operations

```bash
# Start all servers
./scripts/start-all.sh

# Stop all servers
./scripts/stop-all.sh

# View logs
docker logs -f mc-vanilla

# Check status
./scripts/list-servers.sh

# Create backup
./scripts/backup.sh vanilla

# Restart server
./scripts/restart-server.sh vanilla
```

## Add More Servers

### Pre-Configured Modpacks

```bash
# Start RLCraft (first start takes 5-10 min: downloads the modpack)
./scripts/start-server.sh rlcraft

# Start all configured servers
./scripts/start-all.sh
```

Available servers (full table in the [README](../README.md#pre-configured-modpacks)):

| Server Name           | Version | Memory | Port  | Notes                          |
| --------------------- | ------- | ------ | ----- | ------------------------------ |
| `vanilla`             | 26.2    | 2G     | 25567 | Paper, light — good first test |
| `skyfactory4`         | 1.12.2  | 6G     | 25565 | Skyblock, needs Java 8 image   |
| `rlcraft`             | 1.12.2  | 6G     | 25566 | Hardcore survival              |
| `cobbleverse`         | 1.21.1  | 6G     | 25568 | Pokémon-style adventure        |
| `slimes-adventure`    | 1.21.1  | 4G     | 25569 | Exploration                    |
| `solocraft-modpack`   | 1.20.1  | 3G     | 25570 | Solo-leveling-style survival   |
| `all-the-mods-10`     | 1.21.1  | 8G     | 25578 | Heavy kitchen-sink pack        |
| `all-the-mods-10-sky` | 1.21.1  | 8G     | 25585 | ATM10 skyblock variant         |
| `better-mc-bmc4`      | 1.20.1  | 6G     | 25580 | Enhanced vanilla+ (top pack)   |
| `cursed-walking`      | 1.20.1  | 8G     | 25584 | Zombie survival                |
| `deceasedcraft`       | 1.20.1  | 6G     | 25583 | Urban zombie apocalypse        |
| `pixelmon`            | 1.21.1  | 6G     | 25582 | Classic Pokémon mod            |
| `prominence-2`        | 1.20.1  | 6G     | 25581 | RPG adventure                  |
| …                     |         |        |       | 21 total — see README          |

> CurseForge modpacks require `CF_API_KEY` in `.env`. First start downloads the whole
> modpack — give it 5–10 minutes and watch `docker logs -f mc-<name>`.

### Custom Servers

```bash
# Add a new server from a template (auto-assigns a free port)
./scripts/add-modpack.sh my-custom --modpack=vanilla --port=25580

# Customize configuration
nano config/modpacks/my-custom.env

# Start it
./scripts/start-server.sh my-custom
```

Details and all options: [Adding Modpacks](ADDING_MODPACKS.md).

## Backup & Restore

```bash
# Create backup (world + configs)
./scripts/backup.sh vanilla

# List backups (keeps 3 most recent)
ls ./backups/vanilla/

# Restore from backup
./scripts/restore.sh vanilla vanilla-20251107-023015.tar.gz
```

### Automate Backups

```bash
# Add daily 3 AM backup to crontab
crontab -e

# Add this line:
0 3 * * * /path/to/minecraft-servers/scripts/backup.sh vanilla
```

Full guide: [Backup & Restore](BACKUP_RESTORE.md).

## Configuration

### Memory Allocation

```bash
# Edit server config
nano config/modpacks/vanilla.env

# Change memory:
MEMORY=4G

# Restart server to apply
./scripts/restart-server.sh vanilla
```

All per-server variables: [Environment Variables](ENVIRONMENT_VARIABLES.md).

### Server Settings

```bash
# Edit server.properties directly
nano servers/vanilla/data/server.properties

# Common settings:
# max-players=20
# difficulty=normal
# pvp=true
# view-distance=10

# Restart to apply
./scripts/restart-server.sh vanilla
```

### Make Yourself Admin

```bash
# Grant operator permissions (uses the server's RCON port: SERVER_PORT + 1000)
docker exec mc-vanilla rcon-cli op YourMinecraftUsername
```

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs mc-vanilla

# Common issues:
# - EULA not accepted: set EULA=TRUE in .env
# - Port in use: change SERVER_PORT in config/modpacks/vanilla.env
# - Out of memory: increase MEMORY in config/modpacks/vanilla.env
# - CurseForge download failing: check CF_API_KEY in .env
```

### Can't Connect

```bash
# Check server is running
docker ps --filter "name=mc-vanilla"

# Check port is open
sudo ss -tulnp | grep 25567

# Open firewall (if needed)
sudo ufw allow 25567/tcp
```

### Performance Issues

```bash
# Check resource usage
docker stats mc-vanilla

# Increase memory
nano config/modpacks/vanilla.env # increase MEMORY

# Check TPS (ticks per second)
docker exec mc-vanilla rcon-cli tps
# Healthy: 20 TPS, laggy: <18 TPS
```

More: [Troubleshooting Guide](TROUBLESHOOTING.md).

## Essential Commands

```bash
# Server Management
./scripts/start-server.sh <name>    # Start specific server
./scripts/start-all.sh              # Start all servers
./scripts/stop-server.sh <name>     # Stop specific server
./scripts/stop-all.sh               # Stop all servers
./scripts/restart-server.sh <name>  # Restart server
./scripts/list-servers.sh           # Show status
./scripts/health-check.sh           # Check health

# Backups
./scripts/backup.sh <name>          # Create backup
./scripts/restore.sh <name> <file>  # Restore backup

# Configuration
./scripts/add-modpack.sh <name>     # Add new server
./scripts/validate-config.sh        # Validate configs

# Logs
docker logs -f mc-<name>            # Follow logs
docker logs --tail=100 mc-<name>    # Last 100 lines
```

## File Locations

```
Worlds:         ./servers/<name>/data/
Backups:        ./backups/<name>/
Configs:        ./config/modpacks/<name>.env
Logs:           docker logs mc-<name>
```

## Next Steps

- 🏗️ Understand [the Architecture](ARCHITECTURE.md)
- ➕ Add your own modpacks: [Adding Modpacks](ADDING_MODPACKS.md)
- 🏥 Set up [Health Monitoring & Auto-Restart](MONITORING.md)
- 💾 Automate [Backups](BACKUP_RESTORE.md)
- 🎛️ Tune servers: [Environment Variables](ENVIRONMENT_VARIABLES.md)
- 🔧 Fix problems: [Troubleshooting](TROUBLESHOOTING.md)

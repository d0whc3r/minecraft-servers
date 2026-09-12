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
# Start the vanilla server (Paper 26.2; auto-starts mc-router, the shared
# entry point players connect to)
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
   - **Server Address**: `vanilla.<your-ip>.nip.io` — set
     `MC_ROUTER_DOMAIN=<your-ip>.nip.io` in `.env` and LAN players need zero
     DNS/hosts setup ([docs/ROUTER.md](ROUTER.md))
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
├── docker-compose.yml        # Server template (route labels, loopback RCON)
├── docker-compose.router.yml # mc-router: the one port players connect to
├── .env                      # Shared settings (incl. MC_ROUTER_DOMAIN)
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

Available servers (full catalog in [Modpacks](MODPACKS.md)):

| Server Name              | Version | Memory | Notes                                  |
| ------------------------ | ------- | ------ | -------------------------------------- |
| `vanilla`                | 26.2    | 2G     | Paper, light — good first test         |
| `skyfactory4`            | 1.12.2  | 6G     | Skyblock, needs Java 8 image           |
| `stoneblock4`            | 1.21.1  | 8G     | Skyblock-in-a-cave (2025 top pick)     |
| `rlcraft`                | 1.12.2  | 6G     | Hardcore survival                      |
| `cobbleverse`            | 1.21.1  | 6G     | Pokémon-style adventure                |
| `cobblemon`              | 1.21.1  | 6G     | Official Cobblemon pack                |
| `slimes-adventure`       | 1.21.1  | 4G     | Exploration                            |
| `solocraft-modpack`      | 1.20.1  | 3G     | Solo-leveling-style survival           |
| `all-the-mods-10`        | 1.21.1  | 8G     | Heavy kitchen-sink pack                |
| `all-the-mods-10-sky`    | 1.21.1  | 8G     | ATM10 skyblock variant                 |
| `all-the-mods-11`        | 26.1.2  | 8G     | Next-gen ATM (beta, Java 25)           |
| `better-mc-bmc4`         | 1.20.1  | 6G     | Enhanced vanilla+ (top pack)           |
| `better-mc-bmc5`         | 1.21.1  | 8G     | BMC4 successor (NeoForge)              |
| `cursed-walking`         | 1.20.1  | 8G     | Zombie survival                        |
| `dawncraft`              | 1.18.2  | 8G     | RPG soulslike adventure                |
| `deceasedcraft`          | 1.20.1  | 10G    | Urban zombie apocalypse                |
| `homestead`              | 1.20.1  | 6G     | Cozy survival                          |
| `zombie-invade-100-days` | 1.20.1  | 6G     | Horde siege survival                   |
| `pixelmon`               | 1.21.1  | 6G     | Classic Pokémon mod                    |
| `prominence-2`           | 1.20.1  | 6G     | RPG adventure                          |
| …                        |         |        | 29 total — see [Modpacks](MODPACKS.md) |

> CurseForge modpacks require `CF_API_KEY` in `.env`. First start downloads the whole
> modpack — give it 5–10 minutes and watch `docker logs -f mc-<name>`.

### Custom Servers

```bash
# Add a new server from a template (auto-assigns its loopback RCON port)
./scripts/add-modpack.sh my-custom --modpack=vanilla

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
# Grant operator permissions (rcon-cli runs inside the container)
docker exec mc-vanilla rcon-cli op YourMinecraftUsername
```

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs mc-vanilla

# Common issues:
# - EULA not accepted: set EULA=TRUE in .env
# - Router port busy: change MC_ROUTER_PORT in .env (see docs/ROUTER.md)
# - Out of memory: increase MEMORY in config/modpacks/vanilla.env
# - CurseForge download failing: check CF_API_KEY in .env
```

### Can't Connect

```bash
# Check server is running
docker ps --filter "name=mc-vanilla"

# Check the router entry point is listening (the only public game port)
sudo ss -tulnp | grep ':25565'

# Open firewall for the router (if needed)
sudo ufw allow 25565/tcp

# Check the route is registered
./scripts/router.sh status
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

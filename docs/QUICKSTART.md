# Quick Start Guide

Get your first Minecraft server running in ~5 minutes.

## Prerequisites

- **Docker** 20.10+ and **Docker Compose** v2+ installed
- **Linux** server (Ubuntu 20.04+, Debian 11+, or compatible)
- **4GB RAM** minimum (2GB for vanilla server)
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
# Copy template
cp .env.template .env

# Content (defaults are fine):
EULA=TRUE
NETWORK_NAME=minecraft-network
BASE_PORT=25565
```

⚠️ **Important**: Setting `EULA=TRUE` indicates you accept the [Minecraft EULA](https://www.minecraft.net/en-us/eula).

### 2. Start Vanilla Server

```bash
# Start the vanilla server (Paper 1.20.4)
./scripts/start-server.sh vanilla

# Monitor startup (takes ~2 minutes first time)
docker logs -f mc-vanilla

# Look for: "Done! For help, type 'help'"
# Press Ctrl+C to exit logs (server keeps running)
```

### 3. Connect

1. Open **Minecraft Java Edition**
2. Click **Multiplayer** → **Add Server**
3. Enter:
   - **Server Name**: My Vanilla Server
   - **Server Address**: `your-server-ip:25569`
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
├── docker-compose.yml       # Server definitions
├── .env                     # Global settings
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
# Start All The Mods 8 (takes 5-10 min first time)
./scripts/start-server.sh atm8

# Start all configured servers
./scripts/start-all.sh
```

Available modpacks:

| Server      | Version | Memory | Port  |
| ----------- | ------- | ------ | ----- |
| vanilla     | 1.20.4  | 2G     | 25569 |
| atm8        | 1.20.1  | 8G     | 25565 |
| skyfactory4 | 1.12.2  | 4G     | 25566 |
| prominence2 | 1.20.1  | 6G     | 25567 |
| rlcraft     | 1.12.2  | 6G     | 25568 |

### Custom Servers

```bash
# Add new server using template
./scripts/add-modpack.sh my-custom --modpack=vanilla --port=25570

# Customize configuration
nano config/modpacks/my-custom.env

# Start it
./scripts/start-server.sh my-custom
```

## Backup & Restore

```bash
# Create backup (includes world + configs)
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

## Configuration

### Memory Allocation

```bash
# Edit server config
nano config/modpacks/vanilla.env

# Change memory:
MEMORY=4G # 4 gigabytes

# Restart server
./scripts/restart-server.sh vanilla
```

### Server Settings

```bash
# Edit server.properties
nano servers/vanilla/data/server.properties

# Common settings:
max-players=20
difficulty=normal
pvp=true
view-distance=10

# Restart to apply
./scripts/restart-server.sh vanilla
```

### Make Yourself Admin

```bash
# Grant operator permissions
docker exec mc-vanilla rcon-cli op YourMinecraftUsername
```

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs mc-vanilla

# Common issues:
# - EULA not accepted: Set EULA=TRUE in .env
# - Port in use: Change SERVER_PORT in config
# - Out of memory: Increase MEMORY in config
```

### Can't Connect

```bash
# Check server is running
docker ps --filter "name=mc-vanilla"

# Check port is open
sudo ss -tulnp | grep 25569

# Open firewall (if needed)
sudo ufw allow 25569/tcp
```

### Performance Issues

```bash
# Check resource usage
docker stats mc-vanilla

# Increase memory
nano config/modpacks/vanilla.env # Increase MEMORY

# Check TPS (ticks per second)
docker exec mc-vanilla rcon-cli tps
# Healthy: 20 TPS, Laggy: <18 TPS
```

## Essential Commands

```bash
# Server Management
./scripts/start-server.sh <name>    # Start specific server
./scripts/start-all.sh              # Start all servers
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
Worlds:         ./servers/{name}/data/
Backups:        ./backups/{name}/
Configs:        ./config/modpacks/{name}.env
Logs:           docker logs mc-{name}
```

## Next Steps

- 📖 Read full [Architecture Documentation](ARCHITECTURE.md)
- ➕ Learn about [Adding Modpacks](ADDING_MODPACKS.md)
- 🏥 Set up [Health Monitoring](MONITORING.md)
- 💾 Configure [Automated Backups](BACKUP_RESTORE.md)
- 🔧 See [Troubleshooting Guide](TROUBLESHOOTING.md)

## Success! 🎉

You now have:

- ✅ A working Minecraft server
- ✅ Persistent world data
- ✅ Backup capabilities
- ✅ Knowledge to add more servers

**Time to completion**: ~5 minutes for experienced users, ~30 minutes for first-timers

**Enjoy your server!** 🎮

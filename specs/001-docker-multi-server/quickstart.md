# Quickstart Guide: Multi-Configuration Minecraft Server System

**Feature**: 001-docker-multi-server  
**Target Audience**: Server administrators with basic command-line knowledge  
**Time to First Server**: ~30 minutes  
**Prerequisites**: Linux server with Docker installed

---

## What You'll Build

By the end of this guide, you'll have:

- ✅ A working Minecraft server running in Docker
- ✅ Persistent world data that survives restarts
- ✅ Automated backup system
- ✅ Knowledge to add more servers with different modpacks

---

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+, Debian 11+, or compatible)
- **RAM**: 8GB minimum (4GB for OS + 4GB for one server)
- **Disk Space**: 20GB minimum
- **CPU**: 2+ cores recommended
- **Network**: Open port 25565 for players to connect

### Software Requirements

- Docker 20.10+ ([Install Docker](https://docs.docker.com/engine/install/))
- Docker Compose v2 ([Install Compose](https://docs.docker.com/compose/install/))
- Git (for cloning the repository)
- Bash 4.0+ (standard on modern Linux)

### Verify Installation

```bash
# Check Docker
docker --version
# Expected: Docker version 20.10.x or higher

# Check Docker Compose
docker compose version
# Expected: Docker Compose version v2.x.x or higher

# Check Docker daemon is running
docker ps
# Expected: Empty list or existing containers (no errors)
```

---

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
# Clone the project
git clone https://github.com/your-org/minecraft-servers.git
cd minecraft-servers

# Verify structure
ls -la
# Expected: docker-compose.yml, scripts/, config/, etc.
```

### Step 2: Configure Environment

```bash
# Copy template to actual .env file
cp .env.template .env

# Edit .env (optional - defaults are fine for testing)
nano .env

# Minimal required content:
EULA=TRUE
```

**Important**: Setting `EULA=TRUE` indicates you accept the [Minecraft EULA](https://www.minecraft.net/en-us/eula).

### Step 3: Start Your First Server

```bash
# Start the vanilla server (simplest option)
docker compose up -d vanilla

# Check status
docker compose ps
```

**Expected Output**:

```
NAME        IMAGE                             STATUS         PORTS
mc-vanilla  itzg/minecraft-server:latest      Up 30 seconds  0.0.0.0:25569->25565/tcp
```

### Step 4: Monitor Startup

```bash
# Watch logs (server takes ~2 minutes to start first time)
docker logs -f mc-vanilla

# Look for this message:
# [Server thread/INFO]: Done! For help, type "help"
```

Press `Ctrl+C` to stop following logs (server keeps running).

### Step 5: Connect

1. Open Minecraft Java Edition
2. Click **Multiplayer** → **Add Server**
3. Enter:
   - **Server Name**: My Vanilla Server
   - **Server Address**: `your-server-ip:25569`
4. Click **Done** and **Join Server**

🎉 **You're in!** Your first Minecraft server is running.

---

## Understanding What You Built

### What Happened?

1. **Docker downloaded the itzg/minecraft-server image** (~500MB)
2. **Script ran docker compose with SERVER_NAME=vanilla** creating container `mc-vanilla`
3. **Container loaded config** from `config/modpacks/vanilla.env`
4. **World generated** in `./servers/vanilla/data/`
5. **Port mapped**: Server's 25565 → Your host's 25569

### Where Is Everything?

```
minecraft-servers/
├── docker-compose.yml          # Server definitions
├── .env                        # Global settings
├── servers/
│   └── vanilla/
│       └── data/               # ← Your world is here!
│           ├── world/          # Overworld
│           ├── world_nether/   # Nether
│           ├── world_the_end/  # End
│           └── server.properties
└── backups/
    └── vanilla/                # Backup storage
```

### Try This: Verify Persistence

```bash
# Build something in-game, then restart server
docker restart mc-vanilla

# Reconnect - your build is still there!
```

World data persists because it's stored in `./servers/vanilla/data/` on your host filesystem, not inside the temporary container.

---

## Adding More Servers

### Add a Modded Server (All The Mods 8)

```bash
# Verify ATM8 configuration exists
cat config/modpacks/atm8.env

# Start ATM8 server using the script
./scripts/start-server.sh atm8

# Monitor startup (modpacks take longer - 5-10 minutes first time)
docker logs -f mc-atm8
```

**Connect**: Same as before, but use port **25565** (ATM8 uses default port)

### Run Multiple Servers Simultaneously

```bash
# Start all configured servers
./scripts/start-all.sh

# Check status
./scripts/list-servers.sh
```

**Expected Output**:

```

```

# Minecraft Servers Status

## Name Status Port Memory Players Uptime Health

atm8 running 25565 8G 0/20 5m healthy
skyfactory4 running 25566 4G 0/10 5m healthy
vanilla running 25569 2G 0/20 10m healthy

```

Each server:
- Runs in **isolated container** (`mc-atm8`, `mc-skyfactory4`, etc.)
- Has **own world data** in `./servers/{name}/`
- Uses **unique port** (25565, 25566, 25567, etc.)
- Loads **own configuration** from `config/modpacks/{name}.env`
- Can be **managed independently**
```

Each server:

- Runs in **isolated container**
- Has **own world data** in `./servers/{name}/`
- Uses **unique port** (25565, 25566, 25567, etc.)
- Can be **managed independently**

---

## Day-to-Day Operations

### Starting Servers

```bash
# Start all servers
./scripts/start-all.sh

# Start specific server
./scripts/start-server.sh atm8

# Start multiple servers manually
./scripts/start-server.sh atm8
./scripts/start-server.sh vanilla
```

### Stopping Servers

```bash
# Stop all servers (graceful shutdown, saves worlds)
./scripts/stop-all.sh

# Stop specific server
docker stop mc-atm8
```

### Restarting a Server

```bash
# Restart after config changes
./scripts/restart-server.sh atm8
```

### Viewing Logs

```bash
# Follow logs for specific server
docker logs -f mc-atm8

# View last 100 lines
docker logs --tail=100 mc-atm8

# View all servers' logs
docker logs mc-atm8 mc-vanilla mc-rlcraft
```

### Checking Status

```bash
# Detailed status table
./scripts/list-servers.sh

# Health check
./scripts/health-check.sh

# Docker container status
docker ps --filter "name=mc-*"
```

---

## Backup & Restore

### Create a Backup

```bash
# Backup specific server
./scripts/backup.sh atm8

# Backup is saved to:
# ./backups/atm8/atm8-20251108-143022.tar.gz
```

**What Gets Backed Up**:

- World files (overworld, nether, end)
- Server configuration (server.properties)
- Player data (ops, whitelist, bans)
- Server logs (optional)

**Backup Policy**:

- Keeps **3 most recent backups** per server
- Automatically deletes older backups
- Backups created while server is stopped (ensures consistency)

### Restore from Backup

```bash
# List available backups
ls ./backups/atm8/

# Restore from specific backup
./scripts/restore.sh atm8 atm8-20251107-023015.tar.gz

# Follow prompts to confirm
```

⚠️ **Warning**: Restore replaces current world data. Backup first if needed!

### Automate Backups

```bash
# Add to crontab for daily 3 AM backups
crontab -e

# Add this line:
0 3 * * * /path/to/minecraft-servers/scripts/backup.sh atm8
```

---

## Configuring Servers

### Memory Allocation

Each server needs RAM. Default allocations:

- **Vanilla**: 2GB
- **Light modpacks**: 4GB
- **Heavy modpacks** (ATM8, Prominence II): 8GB

**To change**:

```bash
# Edit server-specific config
nano config/modpacks/atm8.env

# Change MEMORY value:
MEMORY=6G # 6 gigabytes

# Restart server to apply
./scripts/restart-server.sh atm8
```

### Server Settings

```bash
# Edit configuration
nano servers/atm8/data/server.properties

# Common settings:
max-players=20
difficulty=normal
gamemode=survival
pvp=true
view-distance=10

# Restart to apply
./scripts/restart-server.sh atm8
```

### Admin Permissions

```bash
# Make yourself an operator (admin)
docker exec mc-atm8 rcon-cli op YourMinecraftUsername

# Verify
cat servers/atm8/data/ops.json
```

---

## Adding Custom Modpacks

### Using the Add-Modpack Script

```bash
# Add a new server with ATM8 template
./scripts/add-modpack.sh my-custom-server --modpack=atm8 --port=25570

# This creates:
# - config/modpacks/my-custom-server.env (editable configuration)
# - ./servers/my-custom-server/ (data directory)
# - ./backups/my-custom-server/ (backup directory)
# No changes to docker-compose.yml needed!

# Customize configuration
nano config/modpacks/my-custom-server.env

# Start it
./scripts/start-server.sh my-custom-server
```

### Manual Configuration

1. **Copy template**:

```bash
cp config/templates/modpack-template.env config/modpacks/mynewserver.env
```

2. **Edit configuration**:

```bash
nano config/modpacks/mynewserver.env

# Example for custom CurseForge modpack:
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=6G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/your-modpack
SERVER_NAME=My Custom Server
MAX_PLAYERS=15
```

3. **Add to docker-compose.yml**:

```bash
nano docker-compose.yml

# Add service (follow existing pattern):
mynewserver:
image: itzg/minecraft-server:latest
container_name: mc-mynewserver
environment:
EULA: "TRUE"
env_file:
- config/modpacks/mynewserver.env
ports:
- "25570:25565"
volumes:
- ./servers/mynewserver/data:/data
- ./servers/mynewserver/mods:/mods
- ./backups/mynewserver:/backups
networks:
- minecraft-network
restart: unless-stopped
stdin_open: true
tty: true
```

4. **Create directories**:

```bash
mkdir -p servers/mynewserver/{data,mods}
mkdir -p backups/mynewserver
```

4. **Start server**:

```bash
./scripts/start-server.sh mynewserver
```

````

5. **Start server**:

```bash
docker compose up -d mynewserver
````

---

## Troubleshooting

### Server Won't Start

**Check logs**:

```bash
docker compose logs atm8
```

**Common issues**:

1. **"EULA not accepted"**: Set `EULA=TRUE` in .env
2. **Port already in use**: Change port in docker-compose.yml
3. **Out of memory**: Increase MEMORY in config file
4. **Invalid modpack URL**: Verify CF_PAGE_URL is correct

### Can't Connect

**Verify server is running**:

```bash
docker compose ps
# STATUS should show "Up"
```

**Check port forwarding**:

```bash
# Test from server itself
telnet localhost 25565

# Test from remote machine
telnet your-server-ip 25565
```

**Firewall check**:

```bash
# Ubuntu/Debian
sudo ufw allow 25565/tcp

# Check if port is open
sudo ss -tulnp | grep 25565
```

### Server Performance Issues

**Check resource usage**:

```bash
docker stats
```

**Increase memory allocation**:

```bash
nano config/modpacks/atm8.env
# Change MEMORY=8G to MEMORY=12G

./scripts/restart-server.sh atm8
```

**View server TPS (ticks per second)**:

```bash
docker compose exec atm8 rcon-cli tps
# Healthy: 20 TPS
# Laggy: <18 TPS
```

### Backup Fails

**Check disk space**:

```bash
df -h .
# Need at least 2x your world size free
```

**Manual backup**:

````bash
**Manual backup**:
```bash
# Stop server
docker stop mc-atm8

# Create backup manually
tar czf backups/atm8/manual-backup.tar.gz -C servers/atm8 data/

# Restart server
docker start mc-atm8
````

````

---

## Next Steps

### You Can Now:

- ✅ Deploy and manage Minecraft servers
- ✅ Configure memory and server settings
- ✅ Create and restore backups
- ✅ Add custom modpacks
- ✅ Troubleshoot common issues

### Learn More:

- **Full Documentation**: See `docs/README.md`
- **Modpack-Specific Guides**: See `docs/modpacks/{name}.md`
- **Advanced Configuration**: See `docs/ADVANCED.md`
- **itzg Image Docs**: https://docker-minecraft-server.readthedocs.io

### Recommended Next Actions:

1. **Set up automated backups** (cron job)
2. **Configure firewall** properly (close unused ports)
3. **Set up monitoring** (health-check.sh via cron)
4. **Document your server settings** for your community

---

## Quick Reference

### Essential Commands

```bash
# Server Management
./scripts/start-all.sh              # Start all servers
./scripts/stop-all.sh               # Stop all servers
./scripts/start-server.sh <name>    # Start specific server
./scripts/restart-server.sh <name>  # Restart specific server
./scripts/list-servers.sh           # Show status

# Backups
./scripts/backup.sh <name>          # Create backup
./scripts/restore.sh <name> <file>  # Restore from backup

# Configuration
./scripts/add-modpack.sh <name>     # Add new server
./scripts/validate-config.sh        # Validate configs

# Monitoring
./scripts/health-check.sh           # Check server health
docker logs -f mc-<name>            # View logs
docker ps --filter "name=mc-*"      # List containers
````

### File Locations

```
Worlds:         ./servers/{name}/data/
Backups:        ./backups/{name}/
Configs:        ./config/modpacks/{name}.env
Server logs:    docker compose logs <name>
```

### Port Assignments

```
atm8:        25565
skyfactory4: 25566
prominence2: 25567
rlcraft:     25568
vanilla:     25569
```

### Support Resources

- **GitHub Issues**: https://github.com/your-org/minecraft-servers/issues
- **itzg/minecraft-server**: https://github.com/itzg/docker-minecraft-server
- **Docker Compose Docs**: https://docs.docker.com/compose/
- **Minecraft Wiki**: https://minecraft.fandom.com

---

## Success Criteria Check

By completing this quickstart, you should have achieved:

- ✅ **SC-001**: Deployed server accessible within 5 minutes _(Vanilla server in Step 3)_
- ✅ **SC-003**: World persists across restarts _(Tested in "Verify Persistence")_
- ✅ **SC-009**: User with basic CLI knowledge deployed successfully within 30 minutes _(This guide)_

**Time to complete**: ~30 minutes for first-time users

---

## What's Different from Other Setups?

### vs. Manual Minecraft Server

- ✅ **Easier**: No Java installation, automatic updates
- ✅ **Isolated**: Each server in its own container
- ✅ **Reproducible**: Configuration as code

### vs. Server Hosting Services

- ✅ **Cost**: Free (except hardware)
- ✅ **Control**: Full access to server files
- ✅ **Flexibility**: Unlimited customization

### vs. Pterodactyl Panel

- ✅ **Simpler**: No web UI, just scripts
- ✅ **Lighter**: Lower resource overhead
- ✅ **Transparent**: All operations visible and auditable

---

## Congratulations!

You now have a production-ready multi-server Minecraft hosting platform. Your servers are:

- 🐳 **Containerized** for isolation and portability
- 💾 **Backed up** with rolling 3-backup retention
- 🔧 **Configurable** via simple environment files
- 📈 **Scalable** to add more servers easily
- 🛡️ **Persistent** - worlds survive restarts

**Enjoy your servers!** 🎮

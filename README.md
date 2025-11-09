# Minecraft Multi-Configuration Server System

A Docker-based system for running multiple Minecraft server instances with different modpacks simultaneously, featuring automated backups, health monitoring, and easy configuration management.

## Features

- 🚀 **Multi-Server Support**: Run 14+ Minecraft servers concurrently with different modpacks
- 🔧 **Template-Based Configuration**: Single docker-compose.yml for all servers
- 💾 **Automated Backups**: 3-backup rolling window with integrity verification
- 🏥 **Health Monitoring**: Built-in health checks with auto-restart on failure
- 📦 **Pre-Configured Modpacks**: Vanilla, ATM8, SkyFactory 4, Prominence II RPG, RLCraft, Solo Leveling series, Dragon Block C, My Hero Academia, Cobbleverse, Slimes Adventure, and more
- 🔌 **Easy Extensibility**: Add custom modpacks with simple scripts
- 🔒 **Complete Isolation**: Each server has isolated configs, worlds, and mods
- ✅ **Production Ready**: Comprehensive validation, monitoring, and troubleshooting

## Prerequisites

- **Docker Engine** 20.10+ ([Installation Guide](https://docs.docker.com/engine/install/))
- **Docker Compose** v2+ ([Installation Guide](https://docs.docker.com/compose/install/))
- **Linux Server**: Ubuntu 20.04+, Debian 11+, or compatible
- **Bash** 4.0+ (standard on most Linux distributions)
- **Minimum Hardware**:
  - 2-8GB RAM per modpack (lightweight: 2GB, heavy modpacks: 8GB+)
  - 50GB+ disk space for worlds and backups
  - Multi-core CPU recommended

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/minecraft-servers.git
cd minecraft-servers
```

### 2. Configure Environment

```bash
cp .env.template .env
# Edit .env if needed (defaults are fine for most setups)
```

### 3. Start Your First Server

```bash
# Start vanilla server (Paper 1.20.4)
./scripts/start-server.sh vanilla

# Check status
docker logs -f mc-vanilla

# Wait for "Done! For help, type 'help'" message
# Connect with Minecraft client on port 25569
```

### 4. Connect to Server

Open Minecraft Java Edition and connect to:

- **Address**: `your-server-ip:25569`
- **Version**: 1.20.4

## Management Scripts

| Script               | Purpose                        | Usage                                       |
| -------------------- | ------------------------------ | ------------------------------------------- |
| `start-server.sh`    | Start specific server          | `./scripts/start-server.sh <name>`          |
| `stop-server.sh`     | Stop server (with purge opts)  | `./scripts/stop-server.sh <name> [--purge]` |
| `start-all.sh`       | Start all configured servers   | `./scripts/start-all.sh`                    |
| `stop-all.sh`        | Stop all servers gracefully    | `./scripts/stop-all.sh`                     |
| `restart-server.sh`  | Restart specific server        | `./scripts/restart-server.sh <name>`        |
| `list-servers.sh`    | Show status of all servers     | `./scripts/list-servers.sh`                 |
| `health-check.sh`    | Check health of servers        | `./scripts/health-check.sh --all`           |
| `auto-restart.sh`    | Auto-restart unhealthy servers | `./scripts/auto-restart.sh --daemon`        |
| `backup.sh`          | Create backup of server        | `./scripts/backup.sh <name>`                |
| `restore.sh`         | Restore from backup            | `./scripts/restore.sh <name> <backup-file>` |
| `add-modpack.sh`     | Add new server config          | `./scripts/add-modpack.sh <name> [options]` |
| `validate-config.sh` | Validate configuration         | `./scripts/validate-config.sh --all`        |

## Pre-Configured Modpacks

| Modpack                       | Version | Memory | Port  | Type              | Platform   | Status   |
| ----------------------------- | ------- | ------ | ----- | ----------------- | ---------- | -------- |
| **All The Mods 8**            | 1.20.1  | 8G     | 25565 | Kitchen sink      | CurseForge | ✅ Ready |
| **SkyFactory 4**              | 1.12.2  | 4G     | 25566 | Skyblock          | CurseForge | ✅ Ready |
| **Prominence II RPG**         | 1.20.1  | 6G     | 25567 | RPG adventure     | CurseForge | ✅ Ready |
| **RLCraft**                   | 1.12.2  | 6G     | 25568 | Hardcore survival | CurseForge | ✅ Ready |
| **Vanilla (Paper)**           | 1.20.4  | 2G     | 25569 | Optimized vanilla | Paper      | ✅ Ready |
| **Cobbleverse**               | 1.21.1  | 6G     | 25570 | Pokemon adventure | Modrinth   | ✅ Ready |
| **Slimes Adventure**          | 1.19.2  | 4G     | 25571 | Exploration       | Modrinth   | ✅ Ready |
| **SoloCraft**                 | 1.20.1  | 3G     | 25572 | Survival focused  | Modrinth   | ✅ Ready |
| **Solo Leveling Reawakening** | 1.20.1  | 4G     | 25573 | Hunter RPG        | CurseForge | ✅ Ready |
| **Unofficial Dragon Block C** | 1.12.2  | 4G     | 25574 | Dragon Ball RPG   | CurseForge | ✅ Ready |
| **Amazing FPS Booster**       | 1.20.1  | 2G     | 25575 | Performance opt.  | CurseForge | ✅ Ready |
| **Solo Leveling Shadows**     | 1.20.1  | 6G     | 25576 | Advanced RPG      | CurseForge | ✅ Ready |
| **Solo Leveling Level Up**    | 1.20.1  | 4G     | 25577 | RPG progression   | CurseForge | ✅ Ready |
| **My Hero Adventure**         | 1.12.2  | 4G     | 25578 | Hero Academia     | CurseForge | ✅ Ready |

## Documentation

- 📖 [**Quick Start Guide**](docs/QUICKSTART.md) - Detailed setup instructions
- 🏗️ [**Architecture**](docs/ARCHITECTURE.md) - Template-based orchestration design
- ➕ [**Adding Modpacks**](docs/ADDING_MODPACKS.md) - How to add custom configurations
- 💾 [**Backup & Restore**](docs/BACKUP_RESTORE.md) - Backup strategy and recovery
- 🏥 [**Monitoring**](docs/MONITORING.md) - Health checks and auto-restart
- 🔧 [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🔐 [**Environment Variables**](docs/ENVIRONMENT_VARIABLES.md) - Complete configuration reference
- 📚 [**Modpack Guides**](docs/modpacks/) - Individual setup guides for each modpack

## Quick Command Reference

```bash
# Validate system setup
./scripts/validate-config.sh --all --verbose

# Start all servers
./scripts/start-all.sh

# Check status with health
./scripts/list-servers.sh

# Monitor server health
./scripts/health-check.sh --all --verbose

# Start auto-restart daemon
./scripts/auto-restart.sh --daemon --interval=300

# View logs for specific server
docker logs -f mc-atm8

# Create backup
./scripts/backup.sh atm8

# Start a Solo Leveling server
./scripts/start-server.sh solo-leveling-shadows

# Add custom server
./scripts/add-modpack.sh my-custom --modpack=vanilla --port=25570

# Stop all servers
./scripts/stop-all.sh
```

## Project Structure

```
minecraft-servers/
├── docker-compose.yml          # Single template service
├── .env                        # Global configuration
├── scripts/                    # Management scripts (11 total)
├── config/
│   ├── modpacks/              # Per-server .env files (14+ pre-configured)
│   └── templates/             # Configuration templates
├── servers/                    # Server data (gitignored)
│   └── {name}/
│       ├── data/              # World, configs, logs
│       └── mods/              # Additional mods
├── backups/                    # Backup archives (gitignored)
│   └── {name}/                # Rolling 3-backup retention
└── docs/                       # Comprehensive documentation
    ├── QUICKSTART.md
    ├── ARCHITECTURE.md
    ├── ADDING_MODPACKS.md
    ├── BACKUP_RESTORE.md
    ├── MONITORING.md
    ├── TROUBLESHOOTING.md
    └── modpacks/              # Individual modpack guides
```

## Architecture Highlights

**Template-Based Orchestration**: Unlike traditional multi-service docker-compose files, this system uses a **single service definition** that gets instantiated per-server:

```yaml
services:
  minecraft-server:
    container_name: mc-${SERVER_NAME}
    env_file: config/modpacks/${SERVER_NAME}.env
    ports: ["${SERVER_PORT}:25565"]
```

**Benefits**:

- ✅ No compose file edits when adding servers
- ✅ Single source of truth for service definition
- ✅ Per-server .env files for isolated configuration
- ✅ Unique container names prevent overwrites
- ✅ Scales to unlimited servers

## Health Monitoring & Auto-Restart

The system includes comprehensive health monitoring:

```bash
# Check all servers
./scripts/health-check.sh --all --verbose

# Start continuous monitoring
./scripts/auto-restart.sh --daemon --interval=300
```

**Health Checks Monitor**:

- Container running status
- Network port responsiveness
- Server log errors
- Disk space usage
- Docker health status

## Backup & Recovery

Automated backup system with integrity verification:

```bash
# Create backup (server stopped temporarily)
./scripts/backup.sh atm8

# Restore from backup
./scripts/restore.sh atm8 backups/atm8/backup-2024-01-01.tar.gz

# List available backups
ls -la backups/atm8/
```

**Features**:

- SHA256 checksum verification
- 3-backup rolling retention
- Atomic operations
- Temporary server stop for consistency

## Adding Custom Modpacks

Easy addition of custom servers:

```bash
# Use pre-configured template
./scripts/add-modpack.sh my-atm8 --modpack=atm8 --port=25570

# Add custom CurseForge modpack
./scripts/add-modpack.sh my-custom --port=25571
# Then edit config/modpacks/my-custom.env manually
```

## Validation & Troubleshooting

Comprehensive validation and troubleshooting tools:

```bash
# Validate entire setup
./scripts/validate-config.sh --all --fix

# Quick system check
./scripts/validate-config.sh --system

# Get help with issues
cat docs/TROUBLESHOOTING.md
```

## Production Deployment

For production use:

1. **Enable Monitoring**:

   ```bash
   nohup ./scripts/auto-restart.sh --daemon --interval=300 > monitoring.log 2>&1 &
   ```

2. **Set Up Backups**:

   ```bash
   # Add to crontab for daily backups
   0 2 * * * /path/to/minecraft-servers/scripts/backup.sh --all
   ```

3. **Monitor Logs**:
   ```bash
   # Check health status
   ./scripts/health-check.sh --all --json
   ```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Adding pre-configured modpacks
- Improving management scripts
- Testing requirements
- Documentation standards

## License

[Your License Here]

## Support

- 📝 [Issues](https://github.com/yourusername/minecraft-servers/issues)
- 💬 [Discussions](https://github.com/yourusername/minecraft-servers/discussions)
- 📧 [Email](mailto:your-email@example.com)

## Acknowledgments

- [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server) - Excellent Docker image for Minecraft servers
- Minecraft modding community for incredible modpacks
- CurseForge and Modrinth platforms for modpack distribution
- Open source community for development tools and libraries

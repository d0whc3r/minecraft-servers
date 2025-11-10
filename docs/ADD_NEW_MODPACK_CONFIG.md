# Guide to Adding a New Modpack Configuration

This guide explains step by step how to add a new configuration for a custom modpack to the Minecraft servers system.

## 📋 Prerequisites

- Access to the `minecraft-servers` repository
- Basic knowledge of Docker and Minecraft
- Modpack URL (if CurseForge/Modrinth) or modpack files

## 🚀 Quick Method: Using the Automatic Script

For most cases, use the `add-modpack.sh` script:

```bash
# Example: Add ATM8 server
./scripts/add-modpack.sh my-atm8 --modpack=atm8

# Example: Add custom server with specific port
./scripts/add-modpack.sh my-server --port=25570 --memory=6G
```

**Available templates:**

- `atm8` - All The Mods 8
- `skyfactory4` - SkyFactory 4
- `rlcraft` - RLCraft
- `vanilla` - Optimized Vanilla
- `prominence2` - Prominence II RPG

## 🔧 Manual Method: Step-by-Step Configuration

If you need custom configuration, follow these steps:

### Step 1: Create the Configuration File

1. Copy the base template:

```bash
cp config/templates/modpack-template.env config/modpacks/your-modpack.env
```

2. Edit the file:

```bash
nano config/modpacks/your-modpack.env
```

### Step 2: Configure Required Parameters

Edit these critical variables:

```env
# Server Type (choose one)
TYPE=AUTO_CURSEFORGE    # For CurseForge modpacks
TYPE=MODRINTH          # For Modrinth modpacks
TYPE=FORGE             # For Forge modpacks
TYPE=FABRIC            # For Fabric modpacks
TYPE=PAPER             # For vanilla with plugins

# Minecraft Version (CRITICAL)
VERSION=1.20.1         # Must match EXACTLY with the modpack

# RAM Memory
MEMORY=4G              # Adjust according to modpack (2G-16G)

# Unique Port (check existing ports)
SERVER_PORT=25570      # Must be unique across all servers

# Server Name (no spaces, lowercase)
SERVER_NAME=your-modpack
```

### Step 3: Configure According to Modpack Type

#### For CurseForge Modpacks:

```env
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/modpack-name
VERSION=1.20.1  # Leave empty for auto-detection
```

#### For Modrinth Modpacks:

```env
TYPE=MODRINTH
MODRINTH_MODPACK=modpack-name
VERSION=1.20.1  # MUST match the modpack's Minecraft version
```

#### For Custom Forge/Fabric Modpacks:

```env
TYPE=FORGE
VERSION=1.19.2
# Manually copy .jar files to servers/your-modpack/mods/
```

### Step 4: Create Required Directories

```bash
# Create server directories
mkdir -p servers/your-modpack/data
mkdir -p servers/your-modpack/mods
mkdir -p backups/your-modpack

# For custom modpacks, copy mods:
cp path/to/your/mods/*.jar servers/your-modpack/mods/
```

### Step 5: Configure Additional Options

Customize according to your needs:

```env
# Players and difficulty
MAX_PLAYERS=20
DIFFICULTY=normal
MODE=survival
PVP=true

# Performance
VIEW_DISTANCE=10
USE_AIKAR_FLAGS=true

# Network and security
ONLINE_MODE=false
ENABLE_RCON=true
RCON_PORT=25575

# Auto-pause (saves resources)
ENABLE_AUTOPAUSE=true
AUTOPAUSE_TIMEOUT_EST=300
```

### Step 6: Validate Configuration

```bash
# Run validation
./scripts/validate-config.sh your-modpack

# If there are errors, fix them and validate again
```

### Step 7: Test the Server

```bash
# Start the server
./scripts/start-server.sh your-modpack

# Verify it works
docker ps | grep mc-your-modpack

# View logs in real-time
docker logs -f mc-your-modpack

# Stop when done testing
./scripts/stop-server.sh your-modpack
```

## 📋 Final Checklist

- [ ] `.env` file created in `config/modpacks/`
- [ ] `SERVER_NAME` unique and valid (lowercase, no spaces)
- [ ] `SERVER_PORT` unique (25565-25664)
- [ ] `TYPE` correct for the modpack
- [ ] `VERSION` compatible with the modpack
- [ ] `MEMORY` sufficient for the modpack
- [ ] Directories created: `servers/`, `backups/`
- [ ] Configuration validated without errors
- [ ] Server tested successfully

## 🔍 Common Troubleshooting

### "Port already in use"

```bash
# Check used ports
grep SERVER_PORT config/modpacks/*.env

# Choose a different port
SERVER_PORT=25571
```

### "Incompatible version"

```bash
# For Modrinth, check supported versions
curl -s "https://api.modrinth.com/v2/project/modpack-name" | grep game_versions

# Adjust VERSION in the .env
VERSION=1.20.1
```

### "Not enough memory"

```bash
# Increase memory
MEMORY=8G

# Restart the server
./scripts/restart-server.sh your-modpack
```

### "Modpack won't download"

```bash
# Verify CurseForge URL
curl -I "https://www.curseforge.com/minecraft/modpacks/your-modpack"

# Check container logs
docker logs mc-your-modpack
```

## 📚 Additional Resources

- [Docker Minecraft Server Documentation](https://docker-minecraft-server.readthedocs.io/)
- [Complete Variables List](https://docker-minecraft-server.readthedocs.io/en/latest/variables/)
- [Detailed Modpacks Guide](../docs/ADDING_MODPACKS.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)

## 🎯 Complete Examples

### Example 1: CurseForge Modpack

```env
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
MEMORY=8G
SERVER_PORT=25570
SERVER_NAME=atm8-custom
MAX_PLAYERS=50
DIFFICULTY=normal
```

### Example 2: Vanilla Server with Plugins

```env
TYPE=PAPER
VERSION=1.20.4
MEMORY=4G
SERVER_PORT=25571
SERVER_NAME=vanilla-plugins
MAX_PLAYERS=20
# Copy plugins to servers/vanilla-plugins/data/plugins/
```

### Example 3: Modrinth Modpack

```env
TYPE=MODRINTH
MODRINTH_MODPACK=cobbleverse
VERSION=1.20.1
MEMORY=6G
SERVER_PORT=25572
SERVER_NAME=cobbleverse-server
```

# Adding Custom Modpacks

**Purpose**: Guide for administrators to add new Minecraft server configurations beyond the pre-configured templates, enabling unlimited server customization.

## Overview

The `add-modpack.sh` script enables administrators to:

- **Add custom servers** with automatic port assignment
- **Use pre-configured templates** for popular modpacks
- **Create custom configurations** for any modpack
- **Validate configurations** before deployment
- **Avoid conflicts** through automatic validation

## Quick Start

### Add Server with Template

```bash
# Add ATM8 server with auto-assigned port
./scripts/add-modpack.sh my-atm8 --modpack=atm8

# Add SkyFactory 4 server with custom port
./scripts/add-modpack.sh sf4-creative --modpack=skyfactory4 --port=25571

# Add vanilla server with custom memory
./scripts/add-modpack.sh vanilla-large --modpack=vanilla --memory=8G
```

### Add Custom Server

```bash
# Add custom modpack server
./scripts/add-modpack.sh my-custom-modpack --port=25572 --memory=6G

# This creates a basic PAPER configuration that you can customize
```

## Available Templates

| Template      | Description       | Type            | Version | Memory | CurseForge |
| ------------- | ----------------- | --------------- | ------- | ------ | ---------- |
| `atm8`        | All The Mods 8    | AUTO_CURSEFORGE | 1.20.1  | 8G     | ✅         |
| `skyfactory4` | SkyFactory 4      | AUTO_CURSEFORGE | 1.12.2  | 4G     | ✅         |
| `prominence2` | Prominence II RPG | AUTO_CURSEFORGE | 1.20.1  | 6G     | ✅         |
| `rlcraft`     | RLCraft           | AUTO_CURSEFORGE | 1.12.2  | 6G     | ✅         |
| `vanilla`     | Vanilla Optimized | PAPER           | 1.20.4  | 2G     | ❌         |

## Command Syntax

```bash
./scripts/add-modpack.sh <server-name> [options]

Required:
  <server-name>    Unique identifier (lowercase, numbers, hyphens only)

Options:
  --modpack=<name> Use pre-configured template
  --port=<number>  Specific port (25565-25664, auto-assigned if omitted)
  --memory=<size>  RAM allocation (e.g., 4G, 8G, 2048M)
```

## Examples

### Example 1: Basic ATM8 Server

```bash
./scripts/add-modpack.sh my-atm8 --modpack=atm8
```

**Output**:

```
[INFO] Adding new server: my-atm8
[INFO] Using template: All The Mods 8
[INFO] Auto-assigning port...
[INFO] Assigned port: 25570
[SUCCESS] Created config: ./config/modpacks/my-atm8.env
[SUCCESS] Created directories:
  - ./servers/my-atm8/data
  - ./servers/my-atm8/mods
  - ./backups/my-atm8
[SUCCESS] New server configuration created successfully!

Configuration Summary:
  Name: my-atm8
  Type: AUTO_CURSEFORGE (All The Mods 8)
  Port: 25570
  Memory: 8G

To start the server:
  ./scripts/start-server.sh my-atm8
```

### Example 2: Custom Configuration

```bash
./scripts/add-modpack.sh creative-server --port=25575 --memory=12G
```

**Output**:

```
[INFO] Adding new server: creative-server
[INFO] Created basic configuration (no template specified)
[SUCCESS] Created config: ./config/modpacks/creative-server.env
[SUCCESS] Created directories:
  - ./servers/creative-server/data
  - ./servers/creative-server/mods
  - ./backups/creative-server
[SUCCESS] New server configuration created successfully!

Configuration Summary:
  Name: creative-server
  Type: PAPER (Vanilla)
  Version: 1.20.4
  Port: 25575
  Memory: 12G
```

## Custom Modpack Integration

### CurseForge Modpacks

For CurseForge modpacks not in templates:

1. **Find the modpack URL**:

   ```
   https://www.curseforge.com/minecraft/modpacks/your-modpack-name
   ```

2. **Add custom server**:

   ```bash
   ./scripts/add-modpack.sh your-modpack --port=25580 --memory=6G
   ```

3. **Edit configuration**:

   ```bash
   nano config/modpacks/your-modpack.env
   ```

4. **Update settings**:
   ```env
   # Custom Modpack Configuration
   TYPE=AUTO_CURSEFORGE
   VERSION=1.20.1  # Check modpack requirements
   MEMORY=6G
   CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/your-modpack-name
   SERVER_NAME=Your Modpack Server
   SERVER_PORT=25580
   MAX_PLAYERS=20
   ```

### Forge/Fabric Modpacks

For non-CurseForge modpacks:

1. **Create basic server**:

   ```bash
   ./scripts/add-modpack.sh forge-server --port=25581 --memory=8G
   ```

2. **Edit configuration**:

   ```bash
   nano config/modpacks/forge-server.env
   ```

3. **Update for Forge**:

   ```env
   # Forge Modpack Configuration
   TYPE=FORGE
   VERSION=1.19.2  # Match modpack version
   MEMORY=8G
   SERVER_NAME=Forge Server
   SERVER_PORT=25581
   MAX_PLAYERS=20
   ```

4. **Add mods manually**:
   ```bash
   # Copy mod files to server mods directory
   cp *.jar servers/forge-server/mods/
   ```

### Vanilla with Plugins

For vanilla servers with plugins:

1. **Create vanilla server**:

   ```bash
   ./scripts/add-modpack.sh plugins-server --modpack=vanilla --port=25582 --memory=4G
   ```

2. **Add plugins**:

   ```bash
   # Create plugins directory
   mkdir servers/plugins-server/data/plugins

   # Copy plugin JARs
   cp *.jar servers/plugins-server/data/plugins/
   ```

## Configuration File Format

### Basic Structure

```env
# Server Configuration
TYPE=PAPER|FORGE|FABRIC|AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=4G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/name  # If AUTO_CURSEFORGE
SERVER_NAME=Display Name
SERVER_PORT=25565
MAX_PLAYERS=20
DIFFICULTY=normal
VIEW_DISTANCE=10
```

### Advanced Options

```env
# Server Settings
MOTD="Welcome to My Server"
DIFFICULTY=hard
GAMEMODE=survival
PVP=true
ONLINE_MODE=false

# Performance
VIEW_DISTANCE=12
SIMULATION_DISTANCE=10
MAX_TICK_TIME=60000

# Resource Limits
MEMORY=8G
MAX_PLAYERS=50

# World Settings
LEVEL_TYPE=minecraft\:normal
ALLOW_NETHER=true
ALLOW_FLIGHT=false
```

## Port Management

### Automatic Assignment

The script automatically finds the next available port:

```bash
# Check current ports
grep SERVER_PORT config/modpacks/*.env

# Add new server (auto-assigns next available)
./scripts/add-modpack.sh new-server
```

### Manual Port Assignment

```bash
# Specify exact port
./scripts/add-modpack.sh custom-server --port=25590
```

### Port Range

- **Valid range**: 25565-25664 (100 servers maximum)
- **Default start**: 25565
- **Auto-assignment**: Finds first unused port

## Memory Configuration

### Format

- `4G` = 4 gigabytes
- `2048M` = 2048 megabytes (same as 2G)
- `8G` = 8 gigabytes

### Recommendations by Modpack

| Modpack Type            | Memory | Notes              |
| ----------------------- | ------ | ------------------ |
| **Vanilla**             | 2-4G   | Basic gameplay     |
| **Light modded**        | 4-6G   | Few mods           |
| **Medium modded**       | 6-8G   | Popular modpacks   |
| **Heavy modded** (ATM8) | 8-12G  | Complex automation |
| **RLCraft**             | 6-8G   | Performance issues |

## Validation & Error Handling

### Server Name Validation

- **Format**: `^[a-z0-9-]+$` (lowercase, numbers, hyphens)
- **Uniqueness**: Cannot duplicate existing servers
- **Length**: 3-32 characters recommended

**Invalid examples**:

```bash
./scripts/add-modpack.sh MyServer      # ❌ Uppercase
./scripts/add-modpack.sh server_name   # ❌ Underscore
./scripts/add-modpack.sh server@domain # ❌ Special chars
```

### Port Validation

- **Range**: 25565-25664
- **Uniqueness**: Cannot conflict with existing servers
- **Availability**: Checked against running services

### Memory Validation

- **Format**: `<number>G` or `<number>M`
- **Examples**: `4G`, `8G`, `2048M`, `4096M`

## Troubleshooting

### "Server already exists"

**Problem**: Trying to add server with name that already exists

**Solution**:

```bash
# Check existing servers
ls config/modpacks/

# Use different name
./scripts/add-modpack.sh different-name --modpack=atm8
```

### "No available ports"

**Problem**: All ports in range 25565-25664 are used

**Solution**:

```bash
# Remove unused servers
rm config/modpacks/unused-server.env
rm -rf servers/unused-server backups/unused-server

# Or use manual port assignment
./scripts/add-modpack.sh new-server --port=25565  # If available
```

### "Invalid memory format"

**Problem**: Memory not in correct format

**Solution**:

```bash
# Use correct format
./scripts/add-modpack.sh server --memory=4G     # ✅
./scripts/add-modpack.sh server --memory=4096M  # ✅
./scripts/add-modpack.sh server --memory=4GB    # ❌ (no B)
```

### Modpack Won't Download

**Problem**: AUTO_CURSEFORGE server fails to start

**Solution**:

```bash
# Check CurseForge URL
curl -I "https://www.curseforge.com/minecraft/modpacks/your-modpack"

# Verify version compatibility
nano config/modpacks/server.env
# Check VERSION matches modpack requirements
```

### Permission Errors

**Problem**: Cannot create directories or files

**Solution**:

```bash
# Fix permissions
sudo chown -R $USER:$USER .

# Or run with sudo (not recommended)
sudo ./scripts/add-modpack.sh server-name
```

## Advanced Usage

### Bulk Server Creation

```bash
# Create multiple servers
for i in {1..3}; do
    ./scripts/add-modpack.sh "atm8-test-$i" --modpack=atm8
done
```

### Custom Templates

Create your own templates by editing the script:

```bash
# Edit script
nano scripts/add-modpack.sh

# Add to TEMPLATES array
TEMPLATES["my-template"]="My Modpack,AUTO_CURSEFORGE,1.20.1,6G,https://curseforge.com/link,My Server"
```

### Integration with Docker Compose

The script creates configurations that work with the existing docker-compose.yml. No manual editing needed.

### Server Removal

To remove a server:

```bash
# Stop if running
docker stop mc-server-name

# Remove configuration
rm config/modpacks/server-name.env

# Remove data (CAUTION: irreversible)
rm -rf servers/server-name backups/server-name
```

## Best Practices

### Naming Conventions

- **Descriptive**: `atm8-creative`, `vanilla-survival`
- **Consistent**: Use prefixes for related servers
- **Short**: Keep under 20 characters

### Resource Planning

- **Start small**: Begin with minimal memory, increase if needed
- **Monitor usage**: Use `docker stats` to check resource consumption
- **Plan for growth**: Allocate extra capacity for world expansion

### Backup Strategy

- **Configure backups** after adding servers
- **Test restores** before going live
- **Automate** with cron jobs

### Security

- **Limit access** to server files
- **Use strong passwords** for admin accounts
- **Keep software updated** (Minecraft, mods, Docker)

## Related Documentation

- [QUICKSTART.md](../QUICKSTART.md) - Getting started guide
- [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) - Backup procedures
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Common issues
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [contracts/management-api.md](../../specs/001-docker-multi-server/contracts/management-api.md) - API specifications

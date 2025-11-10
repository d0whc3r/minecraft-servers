# Management API Contract: Multi-Configuration Minecraft Server System

**Feature**: 001-docker-multi-server  
**Date**: 2025-11-08  
**Type**: CLI/Script-based management interface  
**Access Model**: SSH/physical access only (no web API)

## Overview

This system is managed via command-line scripts and Docker Compose CLI rather than a traditional REST/GraphQL API. This contract defines the command-line interface, input/output formats, exit codes, and operational contracts for all management operations.

---

## Global Conventions

### Exit Codes

- `0`: Success
- `1`: General error
- `2`: Invalid arguments/usage
- `3`: Resource not found (server/backup doesn't exist)
- `4`: Validation failure (config error, port conflict, etc.)
- `5`: Operation timeout
- `126`: Permission denied
- `127`: Command not found

### Output Format

- **Standard output (stdout)**: Success messages, status information, lists
- **Standard error (stderr)**: Error messages, warnings
- **Logging**: All scripts log to console (captured by terminal/cron)

### Common Arguments

- `{server-name}`: Server instance name (must match docker compose service name)
- `--verbose`, `-v`: Enable verbose output
- `--dry-run`, `-n`: Show what would happen without executing
- `--help`, `-h`: Show usage information

---

## Contract 1: Server Lifecycle Management

### 1.1 Start Specific Server

**Command**: `./scripts/start-server.sh <server-name>`

**Purpose**: Start a specific server using the template docker-compose.yml

**Preconditions**:

- docker-compose.yml exists and is valid
- Docker daemon is running
- `config/modpacks/{server-name}.env` exists and is valid
- Port assigned to server is not in use

**Input**:

- `server-name`: Name of server to start (e.g., "atm8", "skyfactory4")

**Output**:

```
Starting server: atm8
✓ Loading config from: config/modpacks/atm8.env
✓ Using port: 25565
✓ Container created: mc-atm8
✓ Server started successfully
Health check will begin in 30 seconds...
```

**Exit Codes**:

- `0`: Server started successfully
- `2`: Invalid server name provided
- `3`: Configuration file not found
- `4`: Port conflict or validation error
- `1`: Docker error during startup

**Side Effects**:

- Docker container created with name `mc-{server-name}`
- Volumes mounted from `./servers/{server-name}/`
- Port bound on host
- Logs available via `docker logs mc-{server-name}`

**Postconditions**:

- Container in "running" state
- Health check monitoring started

**Implementation Sketch**:

```bash
#!/bin/bash
SERVER_NAME=$1
# Validate inputs
if [[ ! -f "config/modpacks/${SERVER_NAME}.env" ]]; then
  echo "Error: Config file not found" >&2
  exit 3
fi
# Load port from config
SERVER_PORT=$(grep "^SERVER_PORT=" "config/modpacks/${SERVER_NAME}.env" | cut -d= -f2)
# Start via docker compose template
SERVER_NAME=$SERVER_NAME SERVER_PORT=$SERVER_PORT docker compose up -d
```

---

### 1.2 Start All Servers

**Command**: `./scripts/start-all.sh`

**Purpose**: Start all servers by iterating through all config files

**Preconditions**:

- docker-compose.yml exists and is valid
- Docker daemon is running
- At least one .env file exists in `config/modpacks/`

**Input**: None

**Output**:

```
Starting all Minecraft servers...
✓ atm8: Started successfully (port 25565)
✓ skyfactory4: Started successfully (port 25566)
✓ rlcraft: Started successfully (port 25568)
✓ vanilla: Started successfully (port 25569)
All servers started. Total: 4
```

**Exit Codes**:

- `0`: All servers started successfully
- `1`: One or more servers failed to start (non-blocking)
- `4`: No configuration files found

**Side Effects**:

- Multiple Docker containers created (one per server)
- Volumes mounted and initialized if first run
- Network created if not exists
- Log streams for each container

**Postconditions**:

- All configured servers in "running" state
- Health checks active for each server

**Implementation Sketch**:

```bash
#!/bin/bash
for config in config/modpacks/*.env; do
  SERVER_NAME=$(basename "$config" .env)
  ./scripts/start-server.sh "$SERVER_NAME"
done
```

---

### 1.3 Stop All Servers

**Command**: `./scripts/stop-all.sh`

**Purpose**: Gracefully stop all running Minecraft containers

**Preconditions**:

- At least one server is running

**Input**: None

**Output**:

```
Stopping all Minecraft servers gracefully...
✓ mc-atm8: Stopped
✓ mc-skyfactory4: Stopped
✓ mc-rlcraft: Stopped
✓ mc-vanilla: Stopped
All servers stopped. Total: 4
```

**Exit Codes**:

- `0`: All servers stopped successfully
- `1`: One or more servers had issues stopping
- `5`: Timeout waiting for graceful shutdown

**Side Effects**:

- Worlds saved via server shutdown hook
- Containers stopped and removed
- Networks and volumes persist

**Postconditions**:

- All `mc-*` containers in "exited" state or removed
- World data safely persisted to volumes

**Implementation Sketch**:

```bash
#!/bin/bash
docker ps --filter "name=mc-*" -q | xargs -r docker stop
```

---

### 1.4 Restart Specific Server

**Command**: `./scripts/restart-server.sh <server-name>`

**Purpose**: Restart a single server (graceful stop + start)

**Preconditions**:

- Server exists in docker-compose.yml
- Docker daemon running

**Input**:

- `<server-name>`: Name of server to restart (required)

**Output**:

```
**Preconditions**:

- Server is currently running

**Input**:

- `server-name`: Server to restart

**Output**:

```

Restarting server: atm8
✓ Stopping mc-atm8...
✓ World saved
✓ Container stopped
✓ Starting mc-atm8...
✓ Server restarted successfully

````

**Exit Codes**:

- `0`: Restart successful
- `3`: Server not found
- `1`: Error during restart

**Implementation Sketch**:

```bash
#!/bin/bash
docker restart mc-$1
````

````

**Exit Codes**:

- `0`: Server restarted successfully
- `2`: Missing server-name argument
- `3`: Server not found in docker-compose.yml
- `5`: Restart timeout

**Side Effects**:

- Container stopped and removed
- New container created from image
- Configuration reloaded from .env files
- World data persists across restart

**Postconditions**:

- Server container is running
- Health check passes within 30 seconds

**Implementation**:

```bash
#!/bin/bash
SERVER_NAME=$1
docker compose restart "$SERVER_NAME"
````

---

## Contract 2: Backup Operations

### 2.1 Create Backup

**Command**: `./scripts/backup.sh <server-name> [--compress-level=6]`

**Purpose**: Create a backup of specified server's world data and configuration

**Preconditions**:

- Server exists
- Sufficient disk space in ./backups/{server-name}/
- Write permissions on backup directory

**Input**:

- `<server-name>`: Server to backup (required)
- `--compress-level=N`: gzip compression level 1-9 (optional, default 6)

**Output**:

```
Creating backup for server: atm8
✓ Server stopped for backup
✓ Creating archive: atm8-20251108-143022.tar.gz
✓ Compressed 1.2GB → 780MB (65% ratio)
✓ Verifying archive integrity...
✓ Checksum: abc123def456...
✓ Backup saved: ./backups/atm8/atm8-20251108-143022.tar.gz
✓ Server restarted
✓ Cleaning old backups (keeping 3 most recent)
  - Deleted: atm8-20251105-120000.tar.gz

Backup completed successfully
Duration: 2m 15s
```

**Exit Codes**:

- `0`: Backup created successfully
- `1`: Backup creation failed (disk full, permission error)
- `2`: Missing server-name argument
- `3`: Server not found
- `4`: Archive verification failed (corruption)

**Side Effects**:

- Server stopped temporarily (or save-off issued)
- New .tar.gz file created in ./backups/{server-name}/
- Oldest backup deleted if >3 exist
- Server restarted after backup

**Postconditions**:

- Backup file exists and is valid (checksum verified)
- Maximum 3 backups per server maintained
- Server returns to previous state (running/stopped)

**Implementation Details**:

```bash
#!/bin/bash
SERVER_NAME=$1
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="./backups/$SERVER_NAME"
BACKUP_FILE="$BACKUP_DIR/$SERVER_NAME-$TIMESTAMP.tar.gz"

# Stop server or issue save-off
docker compose stop "$SERVER_NAME"

# Create backup
tar czf "$BACKUP_FILE" -C "./servers/$SERVER_NAME" data/

# Verify
tar tzf "$BACKUP_FILE" > /dev/null

# Calculate checksum
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"

# Restart server
docker compose start "$SERVER_NAME"

# Clean old backups (keep 3)
ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +4 | xargs rm -f
```

---

### 2.2 Restore from Backup

**Command**: `./scripts/restore.sh <server-name> <backup-file> [--force]`

**Purpose**: Restore a server from a backup archive

**Preconditions**:

- Backup file exists and is valid
- Server is stopped
- Backup file matches server name

**Input**:

- `<server-name>`: Server to restore (required)
- `<backup-file>`: Backup filename or path (required)
- `--force`: Skip confirmation prompt (optional)

**Output**:

```
WARNING: This will replace all world data for server: atm8
Backup: atm8-20251107-023015.tar.gz (780MB)
Server will be stopped during restore.

Proceed? [y/N]: y

✓ Stopping server: atm8
✓ Verifying backup integrity...
✓ Checksum valid: abc123...
✓ Extracting backup...
✓ Restored 1.2GB of data
✓ Setting permissions...
✓ Starting server: atm8

Restore completed successfully
Duration: 45s
```

**Exit Codes**:

- `0`: Restore successful
- `1`: Restore failed (corruption, extraction error)
- `2`: Missing required arguments
- `3`: Backup file not found
- `4`: Checksum verification failed
- `126`: User declined confirmation (unless --force)

**Side Effects**:

- Server stopped
- Current world data deleted (irreversible without backup)
- Backup archive extracted to ./servers/{server-name}/data/
- File permissions set to UID 1000
- Server restarted with restored data

**Postconditions**:

- Server running with restored world state
- All files from backup time restored
- World accessible to players

**Implementation**:

```bash
#!/bin/bash
SERVER_NAME=$1
BACKUP_FILE=$2

# Verify backup
sha256sum -c "$BACKUP_FILE.sha256"

# Stop server
docker compose stop "$SERVER_NAME"

# Clear existing data
rm -rf "./servers/$SERVER_NAME/data"/*

# Extract backup
tar xzf "$BACKUP_FILE" -C "./servers/$SERVER_NAME"

# Fix permissions
chown -R 1000:1000 "./servers/$SERVER_NAME/data"

# Restart
docker compose start "$SERVER_NAME"
```

---

## Contract 3: Server Configuration

### 3.1 Add New Modpack

**Command**: `./scripts/add-modpack.sh <server-name> [--modpack=<name>] [--port=<port>]`

**Purpose**: Add a new server configuration using a template

**Preconditions**:

- Server name not already in use
- Port not already assigned
- Template exists (or manual configuration provided)

**Input**:

- `<server-name>`: Unique identifier for new server (required)
- `--modpack=<name>`: Pre-configured modpack template (optional)
- `--port=<port>`: External port (optional, auto-assigned if omitted)
- `--memory=<amount>`: RAM allocation (optional, default from template)

**Available Templates**:

- `atm8`: All The Mods 8
- `skyfactory4`: SkyFactory 4
- `prominence2`: Prominence II RPG
- `rlcraft`: RLCraft
- `vanilla`: Vanilla optimized (Paper)

**Output**:

```
Adding new server: my-custom-atm8
Using template: atm8
Assigning port: 25570 (auto-selected)

✓ Created config: ./config/modpacks/my-custom-atm8.env
✓ Created directories:
  - ./servers/my-custom-atm8/data
  - ./servers/my-custom-atm8/mods
  - ./backups/my-custom-atm8
✓ Added service to docker-compose.yml
✓ Validated configuration

New server ready. To start:
  docker compose up -d my-custom-atm8

Configuration:
  Name: my-custom-atm8
  Type: AUTO_CURSEFORGE (All The Mods 8)
  Port: 25570
  Memory: 8G
  Version: 1.20.1
```

**Exit Codes**:

- `0`: Server configuration added successfully
- `2`: Invalid arguments
- `3`: Template not found
- `4`: Validation failed (duplicate name/port)

**Side Effects**:

- New .env file created in config/modpacks/
- Directories created for server volumes
- docker-compose.yml updated with new service
- No containers started (manual start required)

**Postconditions**:

- Server configuration ready for deployment
- All directories and files created
- docker-compose.yml valid and parseable

**Implementation Sketch**:

```bash
#!/bin/bash
SERVER_NAME=$1
TEMPLATE=${2:-custom}
PORT=${3:-$(next_available_port)}

# Copy template
cp "config/templates/modpack-template.env" "config/modpacks/$SERVER_NAME.env"

# Update template values
sed -i "s/{{SERVER_NAME}}/$SERVER_NAME/g" "config/modpacks/$SERVER_NAME.env"

# Create directories
mkdir -p "./servers/$SERVER_NAME"/{data,mods}
mkdir -p "./backups/$SERVER_NAME"

# Add to docker-compose.yml (append service block)
cat >> docker-compose.yml <<EOF
  $SERVER_NAME:
    image: itzg/minecraft-server:latest
    container_name: mc-$SERVER_NAME
    env_file:
      - config/modpacks/$SERVER_NAME.env
    ports:
      - "$PORT:25565"
    volumes:
      - ./servers/$SERVER_NAME/data:/data
      - ./servers/$SERVER_NAME/mods:/mods
      - ./backups/$SERVER_NAME:/backups
    networks:
      - minecraft-network
    restart: unless-stopped
EOF

# Validate
docker compose config > /dev/null
```

---

## Contract 4: Monitoring & Status

### 4.1 List Servers

**Command**: `./scripts/list-servers.sh [--format=table|json]`

**Purpose**: Display status of all configured servers

**Preconditions**: None

**Input**:

- `--format=<type>`: Output format (optional, default: table)

**Output (table format)**:

```
Minecraft Servers Status
================================================================================
Name          Status     Port    Memory  Players  Uptime      Health
--------------------------------------------------------------------------------
atm8          running    25565   8G      3/20     2d 14h      healthy
skyfactory4   running    25566   4G      0/10     2d 14h      healthy
prominence2   stopped    25567   6G      -        -           -
rlcraft       running    25568   6G      5/15     1d 8h       healthy
vanilla       running    25569   2G      12/20    6d 3h       healthy
================================================================================
Total: 5 servers | Running: 4 | Stopped: 1
```

**Output (json format)**:

```json
{
  "servers": [
    {
      "name": "atm8",
      "status": "running",
      "port": 25565,
      "memory": "8G",
      "players": { "current": 3, "max": 20 },
      "uptime_seconds": 221400,
      "health": "healthy"
    },
    ...
  ],
  "summary": {
    "total": 5,
    "running": 4,
    "stopped": 1
  }
}
```

**Exit Codes**:

- `0`: Status retrieved successfully
- `1`: Docker daemon not running

**Side Effects**: None (read-only)

**Implementation**:

```bash
#!/bin/bash
docker compose ps --format json | jq '...'
```

---

### 4.2 Health Check

**Command**: `./scripts/health-check.sh [<server-name>]`

**Purpose**: Check health status of servers

**Preconditions**:

- Docker daemon running
- Servers have health checks configured

**Input**:

- `<server-name>`: Check specific server (optional, all if omitted)

**Output**:

```
Health Check Report - 2025-11-08 14:30:22
================================================================================
atm8:         ✓ healthy   (response: 45ms)
skyfactory4:  ✓ healthy   (response: 38ms)
rlcraft:      ✗ unhealthy (timeout after 3 retries)
vanilla:      ✓ healthy   (response: 52ms)
================================================================================
Summary: 3 healthy, 1 unhealthy, 0 starting
```

**Exit Codes**:

- `0`: All servers healthy
- `1`: One or more servers unhealthy
- `3`: Server not found (if specific server requested)

**Side Effects**:

- Health check query sent to each server
- May trigger container restart if unhealthy and restart policy active

**Implementation**:

```bash
#!/bin/bash
docker ps --filter "name=mc-" --format "{{.Names}}: {{.Status}}"
```

---

## Contract 5: Validation & Testing

### 5.1 Validate Configuration

**Command**: `./scripts/validate-config.sh`

**Purpose**: Validate docker-compose.yml and all .env files before deployment

**Preconditions**: Configuration files exist

**Input**: None

**Output**:

```
Validating configuration...
✓ docker-compose.yml: Valid YAML syntax
✓ docker-compose.yml: All services valid
✓ Checking port assignments...
  - atm8: 25565 ✓
  - skyfactory4: 25566 ✓
  - prominence2: 25567 ✓
  - rlcraft: 25568 ✓
  - vanilla: 25569 ✓
✓ No port conflicts detected
✓ Checking environment files...
  - config/modpacks/atm8.env: Valid ✓
  - config/modpacks/skyfactory4.env: Valid ✓
  - config/modpacks/prominence2.env: Valid ✓
  - config/modpacks/rlcraft.env: Valid ✓
  - config/modpacks/vanilla.env: Valid ✓
✓ All required variables present
✓ Network configuration valid

Configuration valid - ready to deploy
```

**Exit Codes**:

- `0`: All validations passed
- `4`: Validation failures detected

**Validation Checks**:

1. YAML syntax validation
2. Docker Compose schema validation
3. Port uniqueness check
4. Port range check (25565-25664)
5. Environment file existence
6. Required variables present (TYPE, VERSION, MEMORY, etc.)
7. Server name uniqueness
8. Volume path existence
9. Network configuration

**Side Effects**: None (dry-run validation)

---

## Contract 6: Docker Compose Direct Access

### 6.1 Standard Docker Compose Commands

Users can directly use `docker compose` for advanced operations:

**Start specific server**:

```bash
docker compose up -d <server-name>
```

**View logs**:

```bash
docker compose logs -f <server-name>
```

**Execute command in container**:

```bash
docker compose exec <server-name> rcon-cli <command>
```

**Scale (not recommended for this use case)**:

```bash
# Not used - each server is unique
```

**Down with volumes**:

```bash
docker compose down -v  # WARNING: Deletes all data
```

---

## Error Handling Standards

### Error Message Format

```
ERROR: {Component}: {Brief description}
Details: {Extended explanation}
Suggestion: {Remediation steps}
```

**Example**:

```
ERROR: backup.sh: Failed to create backup archive
Details: Insufficient disk space in ./backups/atm8/ (required: 1.2GB, available: 500MB)
Suggestion: Free up disk space or change backup location in BACKUP_PATH environment variable
```

### Logging

- All scripts log to stdout/stderr
- Timestamps in ISO 8601 format
- Log levels: INFO, WARN, ERROR
- No log files written (capture via systemd/cron if needed)

---

## Security Considerations

### Access Control

- All scripts require filesystem access (SSH/physical only)
- No authentication implemented (OS-level security)
- Scripts should validate input to prevent injection

### Input Sanitization

- Server names must match `^[a-z0-9-]+$`
- Paths must not contain `..` (directory traversal)
- Ports must be numeric 1-65535

### Permissions

- Scripts executable (755)
- Config files readable (644)
- Volume directories writable by UID 1000

---

## Testing Contracts

### Integration Tests

**Test 1: Full Deployment Cycle**

```bash
./tests/test-deployment.sh
# Expected: Deploy server, connect client, verify persistence
```

**Test 2: Multi-Server Isolation**

```bash
./tests/test-multi-server.sh
# Expected: Start 3 servers, verify no cross-contamination
```

**Test 3: Backup/Restore Cycle**

```bash
./tests/test-backup-restore.sh
# Expected: Backup → Modify world → Restore → Verify original state
```

**Exit Codes**:

- `0`: All tests passed
- `1`: One or more tests failed

---

## Summary

This contract defines the management interface for the multi-configuration Minecraft server system. Unlike traditional APIs, this is a CLI-based contract emphasizing:

- **Script-based operations** rather than HTTP endpoints
- **Exit codes** instead of status codes
- **Stdout/stderr** instead of JSON responses
- **File-based state** instead of database records

All management operations satisfy the functional requirements (FR-001 through FR-017) and align with the SSH-only access model established in the clarification session.

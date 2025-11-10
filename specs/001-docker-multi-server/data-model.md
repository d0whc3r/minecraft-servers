# Data Model: Multi-Configuration Minecraft Server System

**Feature**: 001-docker-multi-server  
**Date**: 2025-11-08  
**Purpose**: Define data structures, relationships, and state management for the multi-server system

## Overview

This system manages multiple Minecraft server instances with isolated configurations. The data model is file-based and declarative, using Docker Compose YAML and environment files as the source of truth. No traditional database is required.

---

## Core Entities

### 1. Server Instance

**Description**: Represents a single Minecraft server process running in an isolated Docker container

**Identity**: Unique string name assigned by administrator (e.g., "atm8", "rlcraft-hardcore")

**Attributes**:

| Attribute         | Type    | Required    | Description                                                 | Source                     |
| ----------------- | ------- | ----------- | ----------------------------------------------------------- | -------------------------- |
| name              | string  | Yes         | Unique identifier, lowercase with hyphens                   | Admin choice               |
| modpack_type      | enum    | Yes         | SERVER_TYPE: VANILLA, FORGE, FABRIC, PAPER, AUTO_CURSEFORGE | config/modpacks/{name}.env |
| minecraft_version | string  | Yes         | Minecraft version (e.g., "1.20.1", "1.19.2")                | config/modpacks/{name}.env |
| memory_allocation | string  | Yes         | RAM limit (e.g., "4G", "8G")                                | config/modpacks/{name}.env |
| cf_page_url       | string  | Conditional | CurseForge URL (required if type=AUTO_CURSEFORGE)           | config/modpacks/{name}.env |
| port              | integer | Yes         | External port (25565 + offset)                              | docker-compose.yml         |
| container_name    | string  | Yes         | Docker container name (mc-{name})                           | docker-compose.yml         |
| operational_state | enum    | Computed    | running, stopped, starting, unhealthy                       | docker ps / healthcheck    |
| data_volume_path  | path    | Yes         | Host path for world data                                    | ./servers/{name}/data      |
| mods_volume_path  | path    | Yes         | Host path for mods/plugins                                  | ./servers/{name}/mods      |
| backup_path       | path    | Yes         | Host path for backups                                       | ./backups/{name}           |

**Validation Rules**:

- `name` must be unique across all servers
- `name` must match regex: `^[a-z0-9-]+$` (lowercase alphanumeric with hyphens)
- `port` must be unique across all servers
- `port` must be in range 25565-25664 (100-server maximum)
- `memory_allocation` must match format: `^\d+[GMgm]$`
- `cf_page_url` must be valid CurseForge URL if modpack_type is AUTO_CURSEFORGE

**State Transitions**:

```
stopped → starting → running → stopping → stopped
              ↓
          unhealthy → restarting → starting
```

**Lifecycle**:

- Created: Via `add-modpack.sh` script or manual docker-compose.yml edit
- Started: Via `docker compose up -d {name}` or `start-all.sh`
- Stopped: Via `docker compose down {name}` or `stop-all.sh`
- Removed: Delete service from docker-compose.yml, remove ./servers/{name}/ and ./backups/{name}/

**File Representation**:

```yaml
# docker-compose.yml (single template service)
services:
  minecraft-server:
    image: itzg/minecraft-server:latest
    container_name: mc-${SERVER_NAME}
    environment:
      EULA: "TRUE"
    env_file:
      - config/modpacks/${SERVER_NAME}.env
    ports:
      - "${SERVER_PORT}:25565"
    volumes:
      - ./servers/${SERVER_NAME}/data:/data
      - ./servers/${SERVER_NAME}/mods:/mods
      - ./backups/${SERVER_NAME}:/backups
    networks:
      - minecraft-network
    restart: unless-stopped
    stdin_open: true
    tty: true
```

**Instantiation**:

```bash
# Start atm8 server
SERVER_NAME=atm8 SERVER_PORT=25565 docker compose up -d
# Creates container: mc-atm8

# Start skyfactory4 server (doesn't conflict with atm8)
SERVER_NAME=skyfactory4 SERVER_PORT=25566 docker compose up -d
# Creates container: mc-skyfactory4

# Both containers run simultaneously, isolated, with their own .env configs
```

---

### 2. Modpack Configuration

**Description**: Template defining the characteristics and requirements of a specific Minecraft modpack

**Identity**: Modpack type name (e.g., "atm8", "skyfactory4", "vanilla")

**Attributes**:

| Attribute         | Type    | Required    | Description                                    | Example                                                        |
| ----------------- | ------- | ----------- | ---------------------------------------------- | -------------------------------------------------------------- |
| modpack_name      | string  | Yes         | Display name                                   | "All The Mods 8"                                               |
| server_type       | enum    | Yes         | FORGE, FABRIC, PAPER, VANILLA, AUTO_CURSEFORGE | AUTO_CURSEFORGE                                                |
| minecraft_version | string  | Yes         | Target Minecraft version                       | "1.20.1"                                                       |
| default_memory    | string  | Yes         | Recommended RAM                                | "8G"                                                           |
| cf_page_url       | string  | Conditional | CurseForge modpack page                        | "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8" |
| java_args         | string  | Optional    | Custom JVM arguments                           | "-XX:+UseG1GC"                                                 |
| min_players       | integer | Optional    | Minimum player slots                           | 10                                                             |
| max_players       | integer | Optional    | Maximum player slots                           | 20                                                             |
| documentation_url | string  | Optional    | Link to modpack docs                           | "./docs/modpacks/atm8.md"                                      |

**File Representation** (`config/modpacks/atm8.env`):

```env
# All The Mods 8 Configuration
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=8G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
SERVER_NAME=ATM8 Server
MAX_PLAYERS=20
```

**Pre-configured Modpacks**:

| Modpack           | Type            | Version | Memory | CF URL                                                         |
| ----------------- | --------------- | ------- | ------ | -------------------------------------------------------------- |
| All The Mods 8    | AUTO_CURSEFORGE | 1.20.1  | 8G     | https://www.curseforge.com/minecraft/modpacks/all-the-mods-8   |
| SkyFactory 4      | AUTO_CURSEFORGE | 1.12.2  | 4G     | https://www.curseforge.com/minecraft/modpacks/skyfactory-4     |
| Prominence II RPG | AUTO_CURSEFORGE | 1.20.1  | 6G     | https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg |
| RLCraft           | AUTO_CURSEFORGE | 1.12.2  | 6G     | https://www.curseforge.com/minecraft/modpacks/rlcraft          |
| Vanilla Optimized | PAPER           | 1.20.4  | 2G     | N/A                                                            |

---

### 3. Persistent Volume

**Description**: Storage container for server data persisted between container restarts

**Identity**: Volume type + server name (e.g., "atm8-data", "atm8-mods")

**Volume Types**:

| Type    | Path                  | Contents                             | Size Estimate  | Backup Priority |
| ------- | --------------------- | ------------------------------------ | -------------- | --------------- |
| data    | ./servers/{name}/data | World files, server.properties, logs | 100MB-10GB     | Critical        |
| mods    | ./servers/{name}/mods | Additional mods/plugins              | 10MB-500MB     | Medium          |
| backups | ./backups/{name}      | Backup archives                      | 3x data volume | Low             |

**Attributes**:

| Attribute      | Type    | Description                |
| -------------- | ------- | -------------------------- |
| volume_type    | enum    | data, mods, backups        |
| server_name    | string  | Associated server instance |
| host_path      | path    | Absolute path on host      |
| container_path | path    | Mount point in container   |
| read_only      | boolean | Mount as read-only         |
| size_bytes     | integer | Current disk usage         |

**Ownership**:

- Host UID: 1000 (minecraft user in itzg image)
- Permissions: 755 for directories, 644 for files
- Must be writable by container user

**Lifecycle**:

- Created: Automatically by Docker on first container start
- Persisted: Survives container recreation
- Removed: Manual deletion by administrator

---

### 4. Backup Archive

**Description**: Point-in-time snapshot of complete server state

**Identity**: Server name + timestamp (e.g., "atm8-20251108-143022.tar.gz")

**Attributes**:

| Attribute         | Type     | Description               | Example                                      |
| ----------------- | -------- | ------------------------- | -------------------------------------------- |
| server_name       | string   | Associated server         | "atm8"                                       |
| timestamp         | datetime | ISO 8601 format           | "2025-11-08T14:30:22Z"                       |
| filename          | string   | Archive filename          | "atm8-20251108-143022.tar.gz"                |
| size_bytes        | integer  | Compressed archive size   | 524288000 (500MB)                            |
| backup_path       | path     | Full path to archive      | "./backups/atm8/atm8-20251108-143022.tar.gz" |
| contents          | object   | What's included           | { world: true, config: true, mods: true }    |
| checksum          | string   | SHA256 hash for integrity | "abc123..."                                  |
| compression_ratio | float    | Original / Compressed     | 0.65                                         |

**Naming Convention**:

```
{server-name}-{YYYYMMDD}-{HHMMSS}.tar.gz
Example: atm8-20251108-143022.tar.gz
```

**Retention Policy**:

- Keep most recent 3 backups per server
- Automatically delete 4th oldest on new backup creation
- Sorted by timestamp (newest first)

**Contents** (all relative to `./servers/{name}/data`):

- world/ (overworld)
- world_nether/
- world_the_end/
- server.properties
- ops.json
- whitelist.json
- banned-players.json
- banned-ips.json
- logs/ (optional)

**Exclusions**:

- cache/
- crash-reports/ (optional exclusion)
- logs/ (optional exclusion)

**File Structure**:

```
./backups/{name}/
├── atm8-20251108-143022.tar.gz  (newest)
├── atm8-20251107-023015.tar.gz  (middle)
└── atm8-20251106-153010.tar.gz  (oldest)
```

**Lifecycle**:

1. Created: Via `backup.sh {server-name}` script
2. Validated: Checksum verification on creation
3. Retained: Until 4th backup triggers deletion of oldest
4. Restored: Via `restore.sh {server-name} {backup-file}` script

---

### 5. Environment Configuration

**Description**: Central and per-server configuration settings managed via environment variables

**Configuration Layers**:

```
Global (.env)
    ↓
Modpack-specific (config/modpacks/{name}.env)
    ↓
Docker Compose (docker-compose.yml)
```

**Global Configuration** (`.env`):

| Variable             | Type    | Required | Description                   | Default             |
| -------------------- | ------- | -------- | ----------------------------- | ------------------- |
| EULA                 | boolean | Yes      | Minecraft EULA acceptance     | "TRUE"              |
| NETWORK_NAME         | string  | Yes      | Docker network name           | "minecraft-network" |
| BASE_PORT            | integer | Yes      | Starting port for servers     | 25565               |
| COMPOSE_PROJECT_NAME | string  | Optional | Docker Compose project prefix | "minecraft-servers" |

**Modpack-Specific Configuration** (`config/modpacks/{name}.env`):

| Variable      | Type    | Required    | Description                                    |
| ------------- | ------- | ----------- | ---------------------------------------------- |
| TYPE          | enum    | Yes         | VANILLA, FORGE, FABRIC, PAPER, AUTO_CURSEFORGE |
| VERSION       | string  | Yes         | Minecraft version                              |
| MEMORY        | string  | Yes         | RAM allocation (e.g., "4G")                    |
| CF_PAGE_URL   | string  | Conditional | CurseForge URL (if TYPE=AUTO_CURSEFORGE)       |
| SERVER_NAME   | string  | Optional    | Display name in server list                    |
| SERVER_PORT   | integer | No          | Internal port (always 25565)                   |
| MAX_PLAYERS   | integer | Optional    | Player slot limit                              |
| ONLINE_MODE   | boolean | Optional    | Enforce auth (default: true)                   |
| DIFFICULTY    | enum    | Optional    | peaceful, easy, normal, hard                   |
| GAMEMODE      | enum    | Optional    | survival, creative, adventure                  |
| PVP           | boolean | Optional    | Enable PVP (default: true)                     |
| VIEW_DISTANCE | integer | Optional    | Render distance (default: 10)                  |

**Validation**:

- All required variables must be present
- TYPE must be valid enum value
- MEMORY must match format `^\d+[GMgm]$`
- VERSION must match Minecraft version format (e.g., "1.20.1")
- CF_PAGE_URL must be valid URL if TYPE=AUTO_CURSEFORGE

**File Representation**:

```env
# .env (global)
EULA=TRUE
NETWORK_NAME=minecraft-network
BASE_PORT=25565

# config/modpacks/atm8.env (server-specific)
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=8G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
SERVER_NAME=ATM8 Server
MAX_PLAYERS=20
DIFFICULTY=normal
```

---

## Relationships

### Server Instance ↔ Modpack Configuration

- **Cardinality**: Many-to-One
- **Relationship**: A server instance uses one modpack configuration; a modpack configuration can be used by multiple server instances
- **Implementation**: Server's `env_file` references modpack config file
- **Constraint**: Server name should logically relate to modpack (e.g., "atm8", "atm8-creative")

### Server Instance ↔ Persistent Volume

- **Cardinality**: One-to-Many
- **Relationship**: One server has three volume types (data, mods, backups)
- **Implementation**: docker-compose.yml volume mounts
- **Constraint**: Volume paths must include server name for isolation

### Server Instance ↔ Backup Archive

- **Cardinality**: One-to-Many (max 3 active)
- **Relationship**: One server has up to 3 backup archives (rolling window)
- **Implementation**: Backups stored in `./backups/{server-name}/`
- **Constraint**: Maximum 3 backups per server enforced by backup script

### Backup Archive ↔ Persistent Volume (data)

- **Cardinality**: One-to-One (snapshot)
- **Relationship**: Each backup is a point-in-time copy of the data volume
- **Implementation**: tar.gz archive of `./servers/{name}/data/`
- **Constraint**: Backup must be atomic (complete snapshot)

---

## State Management

### Server Operational States

```
┌─────────┐
│ stopped │ ◄──────────────┐
└────┬────┘                │
     │ start               │ stop
     ▼                     │
┌──────────┐               │
│ starting │               │
└────┬─────┘               │
     │ health OK           │
     ▼                     │
┌─────────┐     fail       │
│ running ├────────►┌──────────┐
└────┬────┘          │unhealthy │
     │               └────┬─────┘
     │ stop               │ restart
     │                    │
     ▼                    ▼
┌──────────┐        ┌────────────┐
│ stopping │        │ restarting │
└────┬─────┘        └─────┬──────┘
     │                    │
     └────────────────────┘
```

**State Transitions**:

- **stopped → starting**: Administrator executes `docker compose up -d {name}`
- **starting → running**: Health check passes (mc-health returns success)
- **starting → unhealthy**: Health check fails after retries
- **running → stopping**: Administrator executes `docker compose down {name}`
- **running → unhealthy**: Health check fails during operation
- **unhealthy → restarting**: Docker restart policy triggers
- **restarting → starting**: Container recreates
- **stopping → stopped**: Graceful shutdown completes (saves world)

**State Queries**:

```bash
# Check state of all servers
docker compose ps

# Check health of specific server
docker inspect --format='{{.State.Health.Status}}' mc-atm8

# Script-based state check
./scripts/list-servers.sh
```

---

## Data Consistency Rules

### 1. Backup Integrity

- Backups must be created while server is stopped OR save-off is active
- Each backup must include complete world data + configurations + mods
- Partial backups are not allowed (violates FR-009)

### 2. Server Isolation

- No shared volumes between servers
- No shared configuration files between servers
- Each server's data/mods/backups in separate directories

### 3. Port Uniqueness

- Each server must have unique external port
- Port conflicts detected at validation time
- docker-compose will fail if port already bound

### 4. Name Uniqueness

- Server names must be unique across docker-compose.yml
- Docker Compose service names enforce uniqueness
- Attempting to add duplicate name will fail validation

### 5. Configuration Completeness

- All required environment variables must be set
- Missing variables cause container startup failure
- Validation should occur before deployment

---

## File System Layout

```
minecraft-servers/
├── .env                                    # Global environment
├── docker-compose.yml                      # Service definitions
├── config/
│   └── modpacks/
│       ├── atm8.env                        # Server configs
│       ├── skyfactory4.env
│       ├── prominence2.env
│       ├── rlcraft.env
│       └── vanilla.env
├── servers/
│   ├── atm8/
│   │   ├── data/                          # World & config (volume)
│   │   │   ├── world/
│   │   │   ├── world_nether/
│   │   │   ├── world_the_end/
│   │   │   ├── server.properties
│   │   │   ├── ops.json
│   │   │   └── ...
│   │   └── mods/                          # Additional mods (volume)
│   ├── skyfactory4/
│   │   ├── data/
│   │   └── mods/
│   └── ...
└── backups/
    ├── atm8/
    │   ├── atm8-20251108-143022.tar.gz    # Backup archives
    │   ├── atm8-20251107-023015.tar.gz
    │   └── atm8-20251106-153010.tar.gz
    ├── skyfactory4/
    └── ...
```

---

## Validation Schema

### Server Instance Validation

```yaml
name:
  type: string
  pattern: "^[a-z0-9-]+$"
  min_length: 3
  max_length: 32
  unique: true

port:
  type: integer
  min: 25565
  max: 25664
  unique: true

memory_allocation:
  type: string
  pattern: "^\d+[GMgm]$"
  min_value: "1G"

modpack_type:
  type: enum
  values: [VANILLA, FORGE, FABRIC, PAPER, AUTO_CURSEFORGE]

minecraft_version:
  type: string
  pattern: "^\d+\.\d+(\.\d+)?$"
  examples: ["1.20.1", "1.19.2", "1.12.2"]

cf_page_url:
  type: string
  pattern: "^https://www\.curseforge\.com/minecraft/modpacks/.+$"
  required_if: modpack_type == AUTO_CURSEFORGE
```

---

## Migration & Versioning

### Adding New Server

1. Create `config/modpacks/{name}.env` with required variables
2. Add service to `docker-compose.yml` using template
3. Assign unique port (next available offset)
4. Create directories: `./servers/{name}/data`, `./servers/{name}/mods`, `./backups/{name}/`
5. Run `docker compose up -d {name}`

### Removing Server

1. Stop container: `docker compose down {name}`
2. Remove service from `docker-compose.yml`
3. Optionally: Backup and delete `./servers/{name}/` and `./backups/{name}/`
4. Optionally: Delete `config/modpacks/{name}.env`

### Modpack Version Update

1. Update `VERSION` in `config/modpacks/{name}.env`
2. Update `CF_PAGE_URL` if modpack has new version page
3. Recreate container: `docker compose up -d --force-recreate {name}`
4. Image will download updated modpack automatically

---

## Summary

The data model is intentionally simple and declarative:

- **No database required**: All state in Docker and filesystem
- **File-based configuration**: YAML + environment files
- **Immutable backups**: Atomic tar.gz archives
- **Clear isolation**: Each server completely independent
- **Predictable structure**: Consistent naming and paths

This design satisfies all constitution principles and specification requirements while maintaining simplicity and transparency.

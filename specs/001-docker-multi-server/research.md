# Research: Multi-Configuration Minecraft Server System

**Feature**: 001-docker-multi-server  
**Date**: 2025-11-08  
**Purpose**: Document technology decisions, best practices research, and architectural rationale

## Technology Decisions

### 1. Base Docker Image: itzg/minecraft-server

**Decision**: Use `itzg/minecraft-server` as the foundation for all server containers

**Rationale**:

- Industry-standard image with 10,000+ stars on Docker Hub
- Comprehensive support for all required modpack types (Forge, Fabric, Paper, Vanilla, CurseForge)
- Built-in automatic mod/plugin download via CF_PAGE_URL
- Active maintenance and extensive documentation
- Built-in health checks and graceful shutdown handling
- Environment-variable driven configuration (aligns with Constitution Principle VI)

**Alternatives Considered**:

- Custom Dockerfile from scratch: Rejected due to complexity and maintenance burden
- minecraft-server (official): Rejected due to lack of modpack automation
- pterodactyl/panel: Rejected as too heavy and requires web UI (conflicts with SSH-only access model)

**Reference**: https://github.com/itzg/docker-minecraft-server

---

### 2. Orchestration: Docker Compose v2 with Template Service

**Decision**: Use Docker Compose v2 with a single template service definition that instantiates per-server using environment variables

**Architecture**:

```yaml
# docker-compose.yml (single template service)
services:
  minecraft-server:
    image: itzg/minecraft-server:latest
    container_name: mc-${SERVER_NAME}
    env_file:
      - config/modpacks/${SERVER_NAME}.env
    ports:
      - '${SERVER_PORT}:25565'
    volumes:
      - ./servers/${SERVER_NAME}/data:/data
      - ./servers/${SERVER_NAME}/mods:/mods
      - ./backups/${SERVER_NAME}:/backups
    networks:
      - minecraft-network
    restart: unless-stopped
```

**Usage Pattern**:

```bash
# Start specific server by providing SERVER_NAME and SERVER_PORT
SERVER_NAME=atm8 SERVER_PORT=25565 docker compose up -d

# Each invocation creates a unique container (mc-atm8, mc-skyfactory4, etc.)
# Multiple containers run simultaneously without conflicts
```

**Rationale**:

- **Single source of truth**: Only one service definition in docker-compose.yml
- **No file edits for new servers**: Adding servers doesn't require editing compose file
- **Per-server .env files**: Each server loads its own `config/modpacks/{name}.env`
- **Unique container names**: `mc-${SERVER_NAME}` prevents container name conflicts
- **No overwrites**: Each container has unique name and port, runs independently
- **Simpler than Kubernetes** for self-hosted single-host deployment
- **Scalable**: Can spawn unlimited servers without bloating compose file
- **Aligns with Constitution**: Environment-driven (Principle VI), modular (Principle I)

**Alternatives Considered**:

- Multiple services in docker-compose.yml (atm8:, skyfactory4:, etc.): Rejected due to maintenance burden, requires editing compose file for each new server
- Separate docker-compose file per server: Rejected as creates file sprawl and management complexity
- Docker Compose profiles: Rejected as still requires defining each service explicitly
- Kubernetes: Rejected as over-engineered for single-host deployment
- Docker Swarm: Rejected as deprecated and less active than Compose

**Script Integration**:

Management scripts wrap the environment variable pattern:

```bash
# start-server.sh atm8
SERVER_NAME=$1 SERVER_PORT=$(get_port $1) docker compose up -d

# stop-server.sh atm8
docker stop mc-$1

# list-servers.sh
docker ps --filter "name=mc-*"
```

**Reference**: https://docs.docker.com/compose/environment-variables/set-environment-variables/

---

### 3. Modpack Configuration: CurseForge URL-based

**Decision**: Use `CF_PAGE_URL` environment variable for automatic modpack download

**Rationale**:

- itzg/minecraft-server has built-in CurseForge integration
- Eliminates manual mod download and version management
- Automatic updates when CF_PAGE_URL points to latest version
- Supports all target modpacks (ATM8, SkyFactory 4, Prominence II, RLCraft)
- Vanilla uses TYPE=VANILLA (no CF_PAGE_URL needed)

**Alternatives Considered**:

- Manual mod downloads: Rejected due to maintenance burden and version drift
- Modrinth integration: Secondary option, but CurseForge has wider modpack coverage
- Pre-built custom images per modpack: Rejected due to storage and update complexity

**Reference**: https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/auto-curseforge/

---

### 4. Volume Strategy: Host-mapped directories

**Decision**: Map host directories to container volumes using bind mounts

**Volume Mappings**:

```yaml
volumes:
  - ./servers/{name}/data:/data
  - ./servers/{name}/mods:/mods
  - ./backups/{name}:/backups
```

**Rationale**:

- Direct filesystem access for administrators (SSH access model)
- Easy backup via standard filesystem tools (tar, rsync)
- Transparent inspection and troubleshooting
- No Docker volume management overhead
- Supports Constitution Principle III (persistent data management)

**Alternatives Considered**:

- Named Docker volumes: Rejected due to reduced transparency and backup complexity
- NFS mounts: Rejected as over-engineered for single-host deployment
- Embedded data in containers: Rejected due to data loss risk

**Reference**: https://docs.docker.com/storage/bind-mounts/

---

### 5. Port Assignment: Sequential offset pattern

**Decision**: Base port 25565 + offset per server

**Pattern**:

```
atm8:         25565 (base)
skyfactory4:  25566 (+1)
prominence2:  25567 (+2)
rlcraft:      25568 (+3)
vanilla:      25569 (+4)
```

**Rationale**:

- Predictable, human-memorable pattern
- Automatic conflict prevention
- Simple to document for players
- Easy to extend for new servers
- Docker Compose handles port mapping declaratively

**Alternatives Considered**:

- Random port assignment: Rejected due to documentation and player confusion
- All servers on 25565 with different IPs: Rejected as requires multiple network interfaces
- Port range (25565-25600): Selected approach is subset of this, more structured

**Reference**: Minecraft standard port 25565 + sequential allocation

---

### 6. Network Architecture: Custom bridge network

**Decision**: Create Docker custom bridge network for inter-server communication

**Configuration**:

```yaml
networks:
  minecraft-network:
    driver: bridge
```

**Rationale**:

- Servers can communicate by service name if needed (future proxy integration)
- Isolated from other Docker containers
- Supports network-level monitoring
- Better than default bridge (DNS resolution, network segmentation)

**Alternatives Considered**:

- Default bridge: Rejected due to lack of DNS and isolation
- Host networking: Rejected due to security concerns and port conflict risk
- Separate network per server: Rejected as prevents future cross-server features

**Reference**: https://docs.docker.com/network/bridge/

---

### 7. Backup Strategy: tar.gz with rolling window

**Decision**: Use tar.gz compression with 3-backup rolling window per server

**Implementation**:

```bash
# Backup format: {server}-{timestamp}.tar.gz
backup.sh <server-name>
# Keeps: latest, previous, oldest (auto-delete 4th)
```

**Rationale**:

- Standard format, universally compatible
- Good compression for world files (50-70% typical)
- Rolling window prevents disk exhaustion (Constitution Principle III)
- 3 backups balance recovery options with storage
- Atomic backup via tar creation then move

**Alternatives Considered**:

- Incremental backups (rsync): Rejected due to complexity and restore difficulty
- 7-day retention: Rejected per clarification session (3-backup window selected)
- Database-style backups: Not applicable for file-based world storage

**Reference**: Standard tar best practices

---

### 8. Environment Variable Management: .env + per-modpack files

**Decision**: Central `.env` for globals + `config/modpacks/{name}.env` for specifics

**Structure**:

```
.env                        # Global: EULA=TRUE, network settings
config/modpacks/atm8.env    # Specific: TYPE, VERSION, MEMORY, CF_PAGE_URL
```

**Rationale**:

- Satisfies Constitution Principle VI (all parameters via environment)
- Separation of global vs. server-specific configuration
- docker-compose.yml references via `env_file` directive
- Easy to version control (`.env` gitignored, `.env.template` tracked)
- Supports add-modpack.sh script generation

**Alternatives Considered**:

- All in docker-compose.yml: Rejected as too verbose and less maintainable
- Single .env file: Rejected as mixing global and specific concerns
- Per-server .env only: Rejected due to duplication of global settings

**Reference**: https://docs.docker.com/compose/environment-variables/

---

### 9. Management Scripts: Bash 4.0+

**Decision**: Implement management operations as Bash scripts

**Script Set**:

- start-all.sh, stop-all.sh, restart-server.sh
- backup.sh, restore.sh
- add-modpack.sh
- list-servers.sh, health-check.sh

**Rationale**:

- Native to Linux target platform
- Direct docker-compose CLI integration
- Simple, transparent operations (aligns with SSH access model)
- No additional runtime dependencies
- Easy to audit and modify
- Supports Constitution Principle V (easy modpack addition)

**Alternatives Considered**:

- Python scripts: Rejected due to dependency installation requirement
- Makefile: Rejected due to less readable for non-developers
- Custom Go/Rust binary: Rejected as over-engineered

**Reference**: Standard bash scripting practices

---

### 10. Health Checks: Docker HEALTHCHECK + script

**Decision**: Use Docker's built-in HEALTHCHECK instruction in itzg image + custom script

**Implementation**:

```yaml
healthcheck:
  test: mc-health
  interval: 30s
  timeout: 10s
  retries: 3
```

**Rationale**:

- itzg/minecraft-server includes `mc-health` command
- Docker-native monitoring (docker ps shows health status)
- health-check.sh script aggregates all server statuses
- Supports Constitution Principle monitoring requirement
- 30-second interval aligns with SC-006 (failure detection <30s)

**Alternatives Considered**:

- External monitoring (Prometheus): Rejected as over-engineered for single admin
- Manual port checks: Rejected as less reliable than mc-health
- No health checks: Rejected per specification requirement FR-011

**Reference**: https://docker-minecraft-server.readthedocs.io/en/latest/misc/healthcheck/

---

## Best Practices Research

### Docker Compose for Minecraft Servers

**Key Findings**:

- Restart policy `unless-stopped` recommended for game servers (FR-013 auto-restart)
- Memory limits should be set to `MEMORY + 512MB` for JVM overhead
- Use `stdin_open: true` and `tty: true` for console access
- Label containers for identification and filtering

**Source**: itzg/docker-minecraft-server documentation, community examples

---

### CurseForge Modpack Integration

**Key Findings**:

- CF_PAGE_URL can point to specific version or "latest"
- Supports both project URL and file URL formats
- Automatic mod conflict resolution built into image
- Update by changing CF_PAGE_URL and recreating container

**Source**: https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/auto-curseforge/

---

### Minecraft Server Resource Requirements

**Modpack-Specific Minimums**:

- Vanilla: 2GB RAM
- Forge (light): 4GB RAM
- ATM8: 6-8GB RAM
- SkyFactory 4: 4-6GB RAM
- Prominence II: 6-8GB RAM
- RLCraft: 4-6GB RAM

**Recommendation**: Default 4GB, configurable per modpack via MEMORY variable

**Source**: Modpack documentation, community benchmarks

---

### Backup Best Practices for Minecraft

**Key Findings**:

- Always stop writes before backup (use `rcon save-off` or stop server)
- World data typically 100MB-10GB depending on playtime
- Compression ratios: 50-70% with tar.gz
- Backup during low-traffic hours to minimize impact

**Source**: Minecraft server administration guides

---

### Port Management

**Key Findings**:

- Default Minecraft port: 25565
- Query port: 25565 (same, but optional protocol)
- RCON port: 25575 (for remote console)
- Recommendation: Sequential ports for main, separate range for RCON if needed

**Source**: Minecraft protocol documentation

---

### Security Considerations

**Key Findings**:

- Run containers as non-root user (itzg image uses UID 1000)
- Bind only to specific interfaces if needed (e.g., `127.0.0.1:25565` for localhost)
- Keep itzg image updated for security patches
- Firewall: Allow only necessary ports

**Source**: Docker security best practices, Minecraft server hardening guides

---

## Architectural Patterns

### Pattern: Service per Modpack

Each modpack = dedicated Docker Compose service with isolated resources

**Benefits**:

- Independent lifecycle (start/stop individual servers)
- Resource isolation and limits
- Separate logging streams
- Aligns with Constitution Principle I (modular architecture)

---

### Pattern: Template-based Configuration

Use `add-modpack.sh` to generate new configurations from template

**Benefits**:

- Consistent structure across servers
- Reduced human error
- Self-documenting (template shows all required variables)
- Aligns with Constitution Principle V (easy modpack addition)

---

### Pattern: Backup as Code

Backup logic in script, not manual commands

**Benefits**:

- Repeatable, testable backup process
- Scheduled via cron if desired
- Consistent naming and rotation
- Aligns with Constitution Principle III (backup strategy)

---

## Integration Points

### 1. itzg/minecraft-server Image API

**Key Environment Variables**:

- `TYPE`: Server type (FORGE, FABRIC, PAPER, VANILLA, AUTO_CURSEFORGE)
- `VERSION`: Minecraft version (e.g., "1.20.1")
- `MEMORY`: RAM allocation (e.g., "4G")
- `EULA`: Must be "TRUE" to accept Minecraft EULA
- `CF_PAGE_URL`: CurseForge modpack URL
- `SERVER_NAME`: Server display name
- `SERVER_PORT`: Internal port (usually 25565, mapped externally)

**Source**: https://docker-minecraft-server.readthedocs.io/en/latest/variables/

---

### 2. Docker Compose CLI

**Key Commands**:

```bash
docker compose up -d <service>        # Start specific server
docker compose down <service>          # Stop specific server
docker compose logs -f <service>       # Follow logs
docker compose ps                      # List all services
docker compose restart <service>       # Restart server
```

---

### 3. Backup/Restore Integration

**Workflow**:

1. Stop server or issue `save-off` via RCON
2. Create tar.gz of `./servers/{name}/data`
3. Move to `./backups/{name}/` with timestamp
4. Delete oldest if >3 backups exist
5. Resume server or issue `save-on`

---

## Open Questions Resolved

All technical unknowns from initial plan have been resolved through research:

1. ✅ Image selection: itzg/minecraft-server chosen
2. ✅ Modpack automation: CF_PAGE_URL for CurseForge, TYPE for others
3. ✅ Volume strategy: Bind mounts to host directories
4. ✅ Networking: Custom bridge network
5. ✅ Port management: Sequential offset pattern
6. ✅ Backup approach: tar.gz with 3-backup rolling window
7. ✅ Script language: Bash 4.0+
8. ✅ Health monitoring: Docker HEALTHCHECK with mc-health

No remaining NEEDS CLARIFICATION items.

---

## References

- itzg/docker-minecraft-server: https://github.com/itzg/docker-minecraft-server
- Documentation: https://docker-minecraft-server.readthedocs.io
- Docker Compose: https://docs.docker.com/compose/
- CurseForge Integration: https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/auto-curseforge/
- Docker Networking: https://docs.docker.com/network/
- Minecraft Protocol: https://wiki.vg/Protocol

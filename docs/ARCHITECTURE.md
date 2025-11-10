# Architecture Overview

This document describes the architecture of the minecraft-servers multi-configuration system, focusing on the template-based orchestration pattern that enables unlimited server scalability.

## Core Design Principles

### 1. Template-Based Orchestration

**Problem**: Traditional Docker Compose multi-server setups require editing the compose file for each new server, leading to:

- Configuration drift
- Manual port management conflicts
- Service definition duplication
- Scaling limitations

**Solution**: Single service template instantiated per-server using environment variables.

```yaml
# docker-compose.yml - Single template service
services:
  minecraft-server:
    image: itzg/minecraft-server:latest
    container_name: mc-${SERVER_NAME}
    env_file: config/modpacks/${SERVER_NAME}.env
    ports: ['${SERVER_PORT}:25565']
    volumes:
      - ./servers/${SERVER_NAME}/data:/data
      - ./servers/${SERVER_NAME}/mods:/mods
      - ./backups/${SERVER_NAME}:/backups
    networks:
      - minecraft-network
    restart: unless-stopped
    healthcheck:
      test: mc-health
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5m
```

**Benefits**:

- ✅ Zero compose file changes when adding servers
- ✅ Isolated per-server configuration
- ✅ Automatic port and naming conflict prevention
- ✅ Unlimited horizontal scaling
- ✅ Single source of truth for service definition

### 2. Environment-Driven Configuration

**Pattern**: Configuration as code with hierarchical environment variables.

```
Global (.env)
├── Docker Compose variables
└── Default settings

Per-Server (config/modpacks/{name}.env)
├── Server-specific variables
├── Modpack configuration
└── Resource allocation
```

**Example**:

```bash
# Global .env
COMPOSE_PROJECT_NAME=minecraft-servers

# Per-server config/modpacks/atm8.env
SERVER_NAME=atm8
SERVER_PORT=25565
TYPE=AUTO_CURSEFORGE
VERSION=1.20.1
MEMORY=8G
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
```

### 3. Contract-Based Scripting

**Pattern**: All management scripts follow `contracts/management-api.md` specifications.

**Exit Code Contract**:

- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: Resource not found
- `4`: Validation failure

**Benefits**:

- Predictable error handling
- Consistent user experience
- Automation-friendly interfaces
- Debugging standardization

## System Components

### Directory Structure

```
minecraft-servers/
├── docker-compose.yml          # Template service definition
├── .env                        # Global environment variables
├── scripts/                    # Management scripts (11 total)
│   ├── start-server.sh        # Single server startup
│   ├── start-all.sh           # Bulk server startup
│   ├── stop-all.sh            # Graceful shutdown all
│   ├── restart-server.sh      # Server restart with validation
│   ├── list-servers.sh        # Status display with health
│   ├── health-check.sh        # Comprehensive health monitoring
│   ├── auto-restart.sh        # Daemon auto-restart functionality
│   ├── backup.sh              # Atomic backup creation
│   ├── restore.sh              # Verified restore operations
│   ├── add-modpack.sh         # Server configuration addition
│   └── validate-config.sh     # System validation suite
├── config/
│   ├── modpacks/              # Per-server configurations (5+)
│   │   ├── atm8.env
│   │   ├── skyfactory4.env
│   │   ├── prominence2.env
│   │   ├── rlcraft.env
│   │   └── vanilla.env
│   └── templates/             # Configuration templates
├── servers/{name}/            # Runtime server data
│   ├── data/                  # World, configs, logs
│   └── mods/                  # Additional mod files
├── backups/{name}/            # Backup archives with checksums
└── docs/                      # Comprehensive documentation
```

### Data Flow Architecture

```
User Request → Script → Validation → Docker Compose → Container → Minecraft Server
                      ↓
               Configuration Files (.env)
                      ↓
               Volume Mounts (Persistent Data)
```

### Component Interactions

1. **User Interface Layer**: Bash scripts with colored output and progress indicators
2. **Validation Layer**: Pre-flight checks prevent misconfigurations
3. **Orchestration Layer**: Docker Compose template instantiation
4. **Runtime Layer**: itzg/minecraft-server containers with health checks
5. **Persistence Layer**: Named volumes with backup integration

## Template System

### Configuration Templates

**Purpose**: Pre-configured server setups for common modpacks.

```bash
# scripts/add-modpack.sh template definitions
declare -A TEMPLATES=(
  ["atm8"]="All The Mods 8:AUTO_CURSEFORGE:1.20.1:8G:https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
  ["skyfactory4"]="SkyFactory 4:AUTO_CURSEFORGE:1.12.2:4G:https://www.curseforge.com/minecraft/modpacks/skyfactory-4"
  ["vanilla"]="Vanilla Optimized:PAPER:1.20.4:2G:"
)
```

**Benefits**:

- Consistent configurations
- Tested resource allocations
- Automatic CurseForge URL management
- Easy customization starting point

### Template Instantiation Process

1. **Name Validation**: `^[a-z0-9-]+$` format enforcement
2. **Port Assignment**: Automatic 25565-25664 range scanning
3. **Template Copy**: Base configuration from templates
4. **Variable Substitution**: SERVER_NAME, SERVER_PORT injection
5. **Directory Creation**: servers/{name}/ structure setup
6. **Permission Setting**: Docker volume ownership correction

## Health Monitoring Architecture

### Multi-Layer Health Checks

```
Layer 1: Container Status (Docker)
Layer 2: Network Connectivity (Port)
Layer 3: Application Health (Minecraft)
Layer 4: Resource Monitoring (Disk)
Layer 5: Log Analysis (Errors)
```

### Auto-Restart System

**Design**: Daemon process with configurable intervals.

```bash
# Auto-restart daemon architecture
while true; do
  health-check.sh --all --json | process_results
  identify_unhealthy_servers
  restart_failed_servers
  sleep $INTERVAL
done
```

**Safety Features**:

- Configurable timeouts
- Dry-run capability
- Force restart option
- Comprehensive logging

## Backup & Recovery System

### Atomic Backup Process

```
1. Validate server running
2. Temporary server stop
3. Create compressed archive
4. Generate SHA256 checksum
5. Restart server
6. Clean old backups (rolling window)
```

### Recovery Process

```
1. Validate backup integrity
2. User confirmation (unless --force)
3. Stop server
4. Clear existing data
5. Extract backup archive
6. Set ownership permissions
7. Restart server
```

**Integrity Guarantees**:

- SHA256 checksum verification
- Atomic operations
- Rollback protection
- Permission restoration

## Security Considerations

### Container Isolation

- **Network**: Dedicated minecraft-network bridge
- **Volumes**: Per-server isolated data directories
- **Users**: Non-root container execution (1000:1000)
- **Capabilities**: Minimal required permissions

### Data Protection

- **Encryption**: Optional backup encryption support
- **Access Control**: Script execution permissions
- **Audit Trail**: Comprehensive logging
- **Integrity**: Cryptographic checksums

## Scalability Design

### Horizontal Scaling

**Pattern**: Add unlimited servers without architecture changes.

```bash
# Adding server N+1 requires only:
./scripts/add-modpack.sh server-n-plus-1 --modpack=template
```

**Scaling Limits**:

- **Host Resources**: CPU, RAM, Disk I/O
- **Network**: Available ports (25565-25664 range)
- **Docker**: Container limits, overlay filesystem performance

### Performance Optimizations

1. **Lazy Loading**: Servers start only when requested
2. **Resource Pooling**: Shared Docker layer caching
3. **Health Checks**: Efficient polling with smart intervals
4. **Backup Optimization**: Incremental-like behavior via rolling windows

## Operational Patterns

### Deployment Workflow

```
1. System Validation (validate-config.sh --all)
2. Server Addition (add-modpack.sh)
3. Configuration Testing (start-server.sh)
4. Health Verification (health-check.sh)
5. Production Deployment (start-all.sh)
6. Monitoring Setup (auto-restart.sh --daemon)
```

### Maintenance Workflow

```
Daily:
├── Health checks (automated)
├── Backup creation (automated)
└── Log rotation (system)

Weekly:
├── Backup integrity verification
├── Configuration validation
└── Performance monitoring

Monthly:
├── Full system backup testing
├── Security updates
└── Documentation review
```

## Integration Points

### External Systems

- **Monitoring**: JSON output for external monitoring systems
- **Backup**: NFS/external storage mount support
- **Networking**: Reverse proxy integration (nginx, traefik)
- **CI/CD**: Validation scripts for automated testing

### API Compatibility

- **Docker API**: Native Docker command integration
- **Compose API**: Environment variable driven orchestration
- **Systemd**: Service integration for auto-startup
- **Cron**: Scheduled backup and maintenance jobs

## Failure Modes & Recovery

### Single Server Failure

**Detection**: Health check failure
**Recovery**: Automatic restart via auto-restart.sh
**Fallback**: Manual restart-server.sh execution

### System-wide Failure

**Detection**: validate-config.sh --system failure
**Recovery**: System administrator intervention
**Prevention**: Regular validation and monitoring

### Data Corruption

**Detection**: Backup checksum mismatch
**Recovery**: Restore from previous backup
**Prevention**: Multiple backup retention with verification

## Future Extensibility

### Plugin Architecture

**Mod Management**: Additional mod installation scripts
**Server Types**: Support for Bedrock, custom JARs
**Cloud Integration**: AWS ECS, Kubernetes deployments
**Monitoring**: Prometheus/Grafana integration

### Configuration Extensions

**Environment Overrides**: Multi-environment support
**Secret Management**: External credential storage
**Network Policies**: Advanced container networking
**Resource Limits**: Per-server resource constraints

## Constitution Compliance

The architecture follows the project constitution principles:

1. **Modular Design**: Independent, replaceable components
2. **Separated Configuration**: Environment-driven settings
3. **Persistent Volumes**: Docker volume data isolation
4. **Comprehensive Documentation**: Inline and external docs
5. **Extensible Architecture**: Template-based addition pattern
6. **Environment-Driven**: No hardcoded values
7. **Observable Systems**: Health checks and monitoring
8. **Resilient Operations**: Auto-restart and backup systems

This architecture enables reliable, scalable Minecraft server management while maintaining simplicity and operational safety.

# Implementation Plan: Multi-Configuration Minecraft Server System

**Branch**: `001-docker-multi-server` | **Date**: 2025-11-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-docker-multi-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deploy a multi-configuration Minecraft server system using Docker containers to host multiple independent server instances with different modpacks (vanilla, Forge, Fabric, Paper, CurseForge). The system uses a **single template-based docker-compose.yml** that instantiates servers dynamically via environment variables, eliminating the need to edit the compose file when adding new servers. Each server has its own `.env` configuration file in `config/modpacks/{name}.env`, isolated volume mappings, automated backup scripts, and custom bridge networking. Servers run independently with unique container names (`mc-{name}`), unique ports, persistent storage, and complete isolation while sharing common management scripts.

## Technical Context

**Technical Context**: Bash 4.0+ for management scripts, Docker 20.10+, Docker Compose v2  
**Primary Dependencies**: itzg/minecraft-server (Docker image), Docker Engine, Docker Compose v2  
**Storage**: Docker volumes mapped to host filesystem (`./servers/{name}/data`, `./servers/{name}/mods`, `./backups/{name}`)  
**Configuration Model**: Single template docker-compose.yml + per-server .env files (`config/modpacks/{name}.env`)  
**Orchestration Pattern**: Template service instantiated via `SERVER_NAME` and `SERVER_PORT` environment variables  
**Testing**: Manual integration testing, container health checks, docker compose validation  
**Target Platform**: Linux server (Ubuntu 20.04+, Debian 11+, or compatible with Docker support)  
**Project Type**: Infrastructure/DevOps - Docker orchestration with Bash automation scripts  
**Performance Goals**: Support minimum 5 concurrent servers, <5 minute deployment time, <30 second health check response  
**Constraints**: Servers must remain isolated (no shared state), backups must not impact gameplay, port conflicts prevented via sequential assignment  
**Scale/Scope**: 5-20 concurrent servers (hardware-dependent), 5 pre-configured modpacks, ~10 management scripts, comprehensive documentation

## Key Architectural Decision: Template-Based Orchestration

**Innovation**: Unlike traditional multi-service docker-compose files, this system uses a **single template service** that gets instantiated per-server:

```yaml
# docker-compose.yml (single service definition)
services:
  minecraft-server:
    container_name: mc-${SERVER_NAME}
    env_file: config/modpacks/${SERVER_NAME}.env
    ports: ["${SERVER_PORT}:25565"]
    volumes:
      - ./servers/${SERVER_NAME}/data:/data
```

**Usage**:

```bash
# Start server by providing variables
SERVER_NAME=atm8 SERVER_PORT=25565 docker compose up -d
# Creates unique container: mc-atm8

# Start another server (no conflicts)
SERVER_NAME=vanilla SERVER_PORT=25569 docker compose up -d
# Creates unique container: mc-vanilla
```

**Benefits**:

- ✅ **No compose file edits** when adding servers
- ✅ **Single source of truth** for service definition
- ✅ **Per-server .env files** for isolated configuration
- ✅ **Unique container names** prevent overwrites
- ✅ **Scalable** without file bloat
- ✅ **Aligns with Constitution** (environment-driven, modular)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] All components designed with modular Docker containers for scalability
  - Each server runs in isolated container using itzg/minecraft-server image
  - Independent scaling via Docker Compose service definitions
- [x] Configurations properly separated by modpack with no shared state
  - Dedicated directory per server: `./servers/{name}/`
  - Isolated volumes for data, mods, and backups
- [x] Resource management includes persistent volumes and backup strategies
  - Volume mappings: `/data`, `/mods`, `/backups` per server
  - Automated backup script with 3-backup rolling window
- [x] Documentation plan covers all server configurations comprehensively
  - README.md for overview, quickstart.md for setup, per-modpack configuration docs
- [x] Design supports easy addition and modification of modpacks
  - Template-based approach with `add-modpack.sh` script
  - Environment variable configuration in docker-compose.yml
- [x] All configurable parameters use environment variables exclusively
  - TYPE, VERSION, MEMORY, CF_PAGE_URL, EULA, etc. all environment-based
  - No hard-coded values in compose file or scripts

**GATE STATUS**: ✅ PASSED - All constitution principles satisfied by design

## Project Structure

### Documentation (this feature)

```text
specs/001-docker-multi-server/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── management-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
minecraft-servers/
├── docker-compose.yml           # Main orchestration file with all server definitions
├── .env.template                # Template for environment variables
├── .env                         # Actual environment values (gitignored)
├── scripts/
│   ├── start-all.sh            # Start all configured servers
│   ├── stop-all.sh             # Stop all servers gracefully
│   ├── restart-server.sh       # Restart specific server
│   ├── backup.sh               # Create backups for server(s)
│   ├── restore.sh              # Restore from backup
│   ├── add-modpack.sh          # Add new modpack configuration
│   ├── list-servers.sh         # Show status of all servers
│   └── health-check.sh         # Check health of all servers
├── servers/
│   ├── atm8/
│   │   ├── data/               # Persistent world data (volume mount)
│   │   └── mods/               # Additional mods (volume mount)
│   ├── skyfactory4/
│   │   ├── data/
│   │   └── mods/
│   ├── prominence2/
│   │   ├── data/
│   │   └── mods/
│   ├── rlcraft/
│   │   ├── data/
│   │   └── mods/
│   └── vanilla/
│       └── data/
├── backups/
│   ├── atm8/                   # Rolling 3-backup storage
│   ├── skyfactory4/
│   ├── prominence2/
│   ├── rlcraft/
│   └── vanilla/
├── config/
│   ├── modpacks/
│   │   ├── atm8.env            # Modpack-specific variables
│   │   ├── skyfactory4.env
│   │   ├── prominence2.env
│   │   ├── rlcraft.env
│   │   └── vanilla.env
│   └── templates/
│       └── modpack-template.env # Template for new modpacks
├── docs/
│   ├── README.md               # Project overview
│   ├── QUICKSTART.md           # Getting started guide
│   ├── ADDING_MODPACKS.md      # How to add new configurations
│   ├── TROUBLESHOOTING.md      # Common issues and solutions
│   └── modpacks/
│       ├── atm8.md             # All The Mods 8 specific docs
│       ├── skyfactory4.md
│       ├── prominence2.md
│       ├── rlcraft.md
│       └── vanilla.md
└── tests/
    ├── test-deployment.sh      # Test single server deployment
    ├── test-multi-server.sh    # Test concurrent servers
    └── test-backup-restore.sh  # Test backup/restore cycle
```

**Structure Decision**: Infrastructure/DevOps project structure focused on Docker orchestration. No traditional src/ directory needed as this is configuration-driven with management scripts. The structure emphasizes:

- Clear separation of server instances (`servers/{name}/`)
- Isolated backups per server (`backups/{name}/`)
- Management scripts in dedicated directory
- Comprehensive documentation per modpack
- Environment-based configuration approach

## Complexity Tracking

> **No violations** - All constitution principles are satisfied without compromise. The design naturally aligns with modular Docker architecture principles.

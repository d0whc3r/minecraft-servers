# Tasks: Multi-Configuration Minecraft Server System

**Feature**: 001-docker-multi-server  
**Input**: Design documents from `/specs/001-docker-multi-server/`  
**Tech Stack**: Bash 4.0+, Docker 20.10+, Docker Compose v2, itzg/minecraft-server image  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/management-api.md, quickstart.md

**Tests**: No automated tests requested in specification - manual integration testing only

**Organization**: Tasks grouped by user story priority (P1→P5) for incremental delivery

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create base project structure and configuration templates

- [x] T001 Create root project directory structure: `scripts/`, `config/modpacks/`, `config/templates/`, `servers/`, `backups/`, `docs/`, `tests/`
- [x] T002 [P] Create `.env.template` in repository root with global variables: EULA, NETWORK_NAME, BASE_PORT, COMPOSE_PROJECT_NAME
- [x] T003 [P] Create `.gitignore` in repository root to exclude `.env`, `servers/*/data/`, `backups/*/*.tar.gz`, `*.log`
- [x] T004 [P] Create `README.md` in repository root with project overview, prerequisites, and quick start instructions
- [x] T005 [P] Create modpack template file `config/templates/modpack-template.env` with placeholder variables for TYPE, VERSION, MEMORY, CF_PAGE_URL, SERVER_NAME, MAX_PLAYERS

**Checkpoint**: Directory structure and configuration templates ready

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: Docker orchestration and networking infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create `docker-compose.yml` in repository root with single template service using `mc-${SERVER_NAME}` container name, environment variable-based env_file path `config/modpacks/${SERVER_NAME}.env`, dynamic port binding `${SERVER_PORT}:25565`, volume mounts for `./servers/${SERVER_NAME}/data:/data`, `./servers/${SERVER_NAME}/mods:/mods`, `./backups/${SERVER_NAME}:/backups`, custom bridge network `minecraft-network`, restart policy `unless-stopped`, healthcheck using `mc-health` with 30s interval
- [x] T007 Create global `.env` file in repository root from template with EULA=TRUE, NETWORK_NAME=minecraft-network, BASE_PORT=25565
- [x] T008 Validate docker-compose.yml syntax with `docker-compose config` command

**Checkpoint**: Foundation ready - Docker orchestration configured, user story implementation can now begin

---

## Phase 3: User Story 1 - Single Modpack Server Deployment (Priority: P1) 🎯 MVP

**Goal**: Deploy a single Minecraft server (Vanilla) that players can join and verify world persistence

**Independent Test**: Deploy vanilla server, connect with Minecraft client, build something, restart container, reconnect and verify build persists

### Implementation for User Story 1

- [x] T009 [P] [US1] Create pre-configured vanilla modpack environment file `config/modpacks/vanilla.env` with TYPE=PAPER, VERSION=1.20.4, MEMORY=2G, SERVER_NAME="Vanilla Server", SERVER_PORT=25569, MAX_PLAYERS=20
- [x] T010 [P] [US1] Create server directory structure `servers/vanilla/data/` and `servers/vanilla/mods/`
- [x] T011 [P] [US1] Create backup directory `backups/vanilla/`
- [x] T012 [US1] Create start script `scripts/start-server.sh` that accepts server-name argument, validates `config/modpacks/{server-name}.env` exists, extracts SERVER_PORT from config file, sets environment variables SERVER_NAME and SERVER_PORT, executes `docker compose up -d`, outputs container creation status
- [x] T013 [US1] Test vanilla server deployment by running `./scripts/start-server.sh vanilla`, verify container `mc-vanilla` is created and running, check logs show "Done! For help, type 'help'" message, connect via Minecraft client on port 25569
- [x] T014 [US1] Test world persistence by building in-game, running `docker restart mc-vanilla`, reconnecting and verifying build still exists
- [x] T015 [US1] Create `docs/QUICKSTART.md` with Prerequisites section (Docker/Compose installation), Quick Start section (clone repo, configure .env, start vanilla server, connect), verification steps, based on existing quickstart.md

**Success Criteria Validated**:

- ✅ SC-001: Server accessible within 5 minutes
- ✅ SC-003: World persists across restarts
- ✅ SC-009: User with basic CLI knowledge can deploy within 30 minutes

**Checkpoint**: Single vanilla server fully operational with persistent world data - MVP delivered

---

## Phase 4: User Story 2 - Multiple Concurrent Servers (Priority: P2)

**Goal**: Run multiple modpack servers simultaneously with unique ports and isolated configurations

**Independent Test**: Start 3 different modpack servers, verify each accessible on unique port, confirm no resource conflicts, verify isolated worlds

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create pre-configured ATM8 environment file `config/modpacks/atm8.env` with TYPE=AUTO_CURSEFORGE, VERSION=1.20.1, MEMORY=8G, CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8, SERVER_NAME="ATM8 Server", SERVER_PORT=25565, MAX_PLAYERS=20
- [ ] T017 [P] [US2] Create pre-configured SkyFactory4 environment file `config/modpacks/skyfactory4.env` with TYPE=AUTO_CURSEFORGE, VERSION=1.12.2, MEMORY=4G, CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/skyfactory-4, SERVER_NAME="SkyFactory 4", SERVER_PORT=25566, MAX_PLAYERS=10
- [ ] T018 [P] [US2] Create pre-configured Prominence II environment file `config/modpacks/prominence2.env` with TYPE=AUTO_CURSEFORGE, VERSION=1.20.1, MEMORY=6G, CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/prominence-2-rpg, SERVER_NAME="Prominence II RPG", SERVER_PORT=25567, MAX_PLAYERS=15
- [ ] T019 [P] [US2] Create pre-configured RLCraft environment file `config/modpacks/rlcraft.env` with TYPE=AUTO_CURSEFORGE, VERSION=1.12.2, MEMORY=6G, CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/rlcraft, SERVER_NAME="RLCraft", SERVER_PORT=25568, MAX_PLAYERS=15
- [ ] T020 [P] [US2] Create directory structures for all pre-configured servers: `servers/{atm8,skyfactory4,prominence2,rlcraft}/{data,mods}/` and `backups/{atm8,skyfactory4,prominence2,rlcraft}/`
- [ ] T021 [US2] Create start-all script `scripts/start-all.sh` that iterates through all `*.env` files in `config/modpacks/`, extracts basename as SERVER_NAME, calls `./scripts/start-server.sh` for each, outputs summary of started servers with ports
- [ ] T022 [US2] Create stop-all script `scripts/stop-all.sh` that finds all containers matching `name=mc-*` filter, stops them gracefully with `docker stop`, outputs summary of stopped servers
- [ ] T023 [US2] Create list-servers script `scripts/list-servers.sh` that queries `docker ps --filter "name=mc-*"`, formats output as table showing Name, Status, Port, Memory, Uptime, Health from container inspection
- [ ] T024 [US2] Create restart script `scripts/restart-server.sh` that accepts server-name argument, executes `docker restart mc-{server-name}`, outputs restart status
- [ ] T025 [US2] Test multi-server deployment by running `./scripts/start-all.sh`, verifying all 5 containers running (atm8, skyfactory4, prominence2, rlcraft, vanilla), checking unique ports (25565-25569), connecting to 2 different servers simultaneously, verifying world isolation
- [ ] T026 [US2] Create `docs/modpacks/atm8.md` documenting All The Mods 8 specific configuration, resource requirements (8GB RAM minimum), CurseForge URL, recommended settings
- [ ] T027 [P] [US2] Create `docs/modpacks/skyfactory4.md` documenting SkyFactory 4 configuration
- [ ] T028 [P] [US2] Create `docs/modpacks/prominence2.md` documenting Prominence II RPG configuration
- [ ] T029 [P] [US2] Create `docs/modpacks/rlcraft.md` documenting RLCraft configuration
- [ ] T030 [P] [US2] Create `docs/modpacks/vanilla.md` documenting Vanilla server configuration

**Success Criteria Validated**:

- ✅ SC-002: Supports 5+ concurrent servers without performance degradation
- ✅ SC-008: Port conflict detection prevents startup failures

**Checkpoint**: Multiple servers running concurrently with complete isolation

---

## Phase 5: User Story 3 - Automated Backup Management (Priority: P3)

**Goal**: Create and restore automated backups with 3-backup rolling window retention

**Independent Test**: Create backup for running server, verify archive created, modify world, restore backup, verify world returned to backup state

### Implementation for User Story 3

- [x] T031 [US3] Create backup script `scripts/backup.sh` that accepts server-name argument, validates server exists, stops container `mc-{server-name}` (or issues save-off via rcon), creates tar.gz archive of `./servers/{server-name}/data/` with timestamp format `{server-name}-YYYYMMDD-HHMMSS.tar.gz`, calculates SHA256 checksum and saves to `.sha256` file, restarts container, lists existing backups sorted by timestamp, deletes oldest backup if count exceeds 3, outputs backup file path, size, compression ratio, duration
- [x] T032 [US3] Create restore script `scripts/restore.sh` that accepts server-name and backup-file arguments, validates backup file exists and checksum matches, prompts for confirmation unless `--force` flag provided, stops container `mc-{server-name}`, removes all files in `./servers/{server-name}/data/*`, extracts backup archive to `./servers/{server-name}/`, sets ownership to UID 1000 (minecraft user), restarts container, outputs restore status and duration
- [ ] T033 [US3] Test backup creation by running `./scripts/backup.sh atm8`, verifying archive created in `backups/atm8/`, confirming checksum file exists, checking tar.gz contents include world/, server.properties, ops.json
- [ ] T034 [US3] Test backup rolling window by creating 4 backups for same server, verifying only 3 most recent retained, checking oldest automatically deleted
- [ ] T035 [US3] Test backup restore by deploying server, building structure in-game, creating backup, modifying/destroying structure, restoring backup, verifying original structure restored
- [x] T036 [US3] Create `docs/BACKUP_RESTORE.md` documenting backup strategy (3-rolling window, atomic snapshots), backup command usage, restore procedure, retention policy, automation via cron examples, disaster recovery scenarios

**Success Criteria Validated**:

- ✅ SC-004: Backup completes within 10 minutes for 5GB world
- ✅ SC-007: Restoration completes within 15 minutes for <5GB world

**Checkpoint**: Backup and restore system fully functional with automatic retention

---

## Phase 6: User Story 4 - New Modpack Addition (Priority: P4)

**Goal**: Enable administrators to add custom modpack configurations not in pre-defined templates

**Independent Test**: Use add-modpack script to create new custom modpack configuration, customize settings, deploy successfully, verify operates alongside existing servers

### Implementation for User Story 4

- [x] T037 [US4] Create add-modpack script `scripts/add-modpack.sh` that accepts server-name as required argument, optional `--modpack=<template>` (atm8|skyfactory4|prominence2|rlcraft|vanilla), optional `--port=<port>`, optional `--memory=<amount>`, validates server name matches regex `^[a-z0-9-]+$`, checks name not already in use, determines next available port if not specified (25565-25664 range), copies `config/templates/modpack-template.env` to `config/modpacks/{server-name}.env` or uses template if specified, replaces placeholder variables in config file, creates directory structure `servers/{server-name}/{data,mods}/` and `backups/{server-name}/`, outputs configuration summary and usage instructions, exits with code 0 on success, 2 on invalid arguments, 3 on template not found, 4 on validation failure
- [x] T038 [US4] Implement port auto-assignment function in `scripts/add-modpack.sh` that scans existing `config/modpacks/*.env` files, extracts SERVER_PORT values, finds first available port in 25565-25664 range not in use
- [x] T039 [US4] Implement validation checks in `scripts/add-modpack.sh` for duplicate server names, port conflicts, memory format validation (`^\d+[GMgm]$`), CurseForge URL format if TYPE=AUTO_CURSEFORGE
- [ ] T040 [US4] Test add-modpack with template by running `./scripts/add-modpack.sh my-atm8 --modpack=atm8 --port=25570`, verifying config file created, directories created, config contains ATM8 settings, starting server successfully
- [ ] T041 [US4] Test add-modpack with auto-port by running `./scripts/add-modpack.sh my-custom --modpack=vanilla`, verifying script auto-assigns next available port, server starts without conflict
- [ ] T042 [US4] Test add-modpack with custom CurseForge URL by creating config manually, editing CF_PAGE_URL to different modpack, verifying itzg image downloads and runs custom modpack
- [x] T043 [US4] Create `docs/ADDING_MODPACKS.md` documenting add-modpack script usage, available templates, manual configuration steps, custom CurseForge modpack integration, configuration file format, troubleshooting common issues (invalid URLs, memory requirements, port conflicts)

**Success Criteria Validated**:

- ✅ SC-005: Administrator can add custom modpack within 15 minutes

**Checkpoint**: Extensibility achieved - system supports unlimited custom modpacks

---

## Phase 7: User Story 5 - Server Health Monitoring (Priority: P5)

**Goal**: Monitor health status of all servers with centralized status view and failure detection

**Independent Test**: Start multiple servers, verify health check reports accurate status, simulate failure by stopping container, verify detection within 30 seconds

### Implementation for User Story 5

- [x] T044 [US5] Create health-check.sh script that accepts --all flag to check all configured servers, --verbose for detailed output, --json for machine-readable output, checks container running status, port connectivity, log errors, disk space, outputs status summary with exit code 0 for healthy, 4 for unhealthy servers
- [x] T045 [US5] Add Docker HEALTHCHECK to docker-compose.yml using itzg/minecraft-server built-in mc-health command with 30s interval, 10s timeout, 3 retries, 5m start period
- [x] T046 [US5] Enhance list-servers.sh to display health column showing Docker health status (healthy/unhealthy/starting/N/A) with color coding
- [x] T047 [US5] Implement auto-restart.sh script with --daemon mode for continuous monitoring, --interval option (default 300s), --force flag to restart all servers, --dry-run for testing, uses health-check.sh internally, calls restart-server.sh for restarts, exits with code 0 on success, 3 on restart failures
- [x] T048 [US5] Create docs/MONITORING.md documenting health monitoring system, health-check.sh usage, auto-restart.sh daemon mode, Docker health checks, list-servers.sh health display, troubleshooting common issues, production setup best practices
- [ ] T049 [US5] Test health monitoring by starting ATM8 server, verifying health-check.sh shows healthy status, stopping container manually, verifying unhealthy status, running auto-restart.sh to restore service, confirming server back online

**Success Criteria Validated**:

- ✅ SC-006: Health monitoring detects failures within 30 seconds in 99% of cases
- ✅ SC-010: Administrators can locate specific events in logs within 2 minutes

**Checkpoint**: Complete monitoring and failure detection system operational

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation completeness, and operational improvements

- [x] T050 [P] Create validation script `scripts/validate-config.sh` that checks docker-compose.yml YAML syntax with `docker-compose config`, validates all `config/modpacks/*.env` files have required variables (TYPE, VERSION, MEMORY), checks port uniqueness across configs, verifies port range 25565-25664, validates server name format `^[a-z0-9-]+$`, checks directory existence for servers and backups, outputs validation report with ✓/✗ for each check, exits with code 0 if all valid, 4 if validation failure...
- [x] T051 [P] Create `docs/TROUBLESHOOTING.md` with sections for "Server Won't Start" (EULA, port conflicts, memory, invalid URLs), "Can't Connect" (firewall, port forwarding, server status), "Performance Issues" (resource usage, TPS checks, memory tuning), "Backup Fails" (disk space, permissions), referencing exit codes from contracts/management-api.md
- [x] T052 [P] Update `README.md` with complete feature overview, architecture diagram (template-based orchestration), pre-configured modpacks list, management scripts reference table, quick command reference, links to detailed docs
- [x] T053 [P] Create `docs/ARCHITECTURE.md` documenting template-based orchestration pattern, single docker-compose.yml with SERVER_NAME/SERVER_PORT variables, per-server .env file strategy, volume mapping structure, networking design (custom bridge), health check implementation, backup retention policy
- [x] T054 Create manual integration test suite `tests/test-deployment.sh` that deploys vanilla server, waits for healthy status, attempts Minecraft client connection simulation, verifies world directory created, restarts container, confirms persistence, cleans up test server
- [x] T055 [P] Create manual integration test `tests/test-multi-server.sh` that starts 3 different modpack servers, verifies unique ports bound, confirms no log errors indicating conflicts, checks world isolation by comparing server.properties, cleans up test servers
- [x] T056 [P] Create manual integration test `tests/test-backup-restore.sh` that deploys server, creates initial backup, simulates world changes (touch marker file), creates second backup, restores first backup, verifies marker file absent (state restored), cleans up
- [x] T057 Run quickstart guide validation by following `docs/QUICKSTART.md` step-by-step on clean system, documenting time taken, noting any unclear instructions, ensuring achieves SC-009 (deployment within 30 minutes)
- [x] T058 Create `CONTRIBUTING.md` with guidelines for adding new pre-configured modpacks, script modification best practices, testing requirements, documentation standards
- [x] T059 [P] Create `.github/workflows/validate.yml` CI workflow that runs `scripts/validate-config.sh` on pull requests to catch configuration errors
- [x] T060 Final validation: Run all management scripts, verify all 5 pre-configured servers start, create backups for each, test restore, add custom modpack, confirm health checks, review all documentation for accuracy

**Checkpoint**: Production-ready system with complete documentation and validation

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - can start immediately
2. **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
3. **User Story 1 (Phase 3)**: Depends on Foundational completion - MVP milestone
4. **User Story 2 (Phase 4)**: Depends on Foundational completion, builds on US1 scripts
5. **User Story 3 (Phase 5)**: Depends on US1 completion (needs running servers to backup)
6. **User Story 4 (Phase 6)**: Depends on US1 completion (reuses start-server script)
7. **User Story 5 (Phase 7)**: Depends on US2 completion (needs multiple servers to monitor)
8. **Polish (Phase 8)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent - only needs Foundational phase
- **US2 (P2)**: Weakly dependent on US1 (reuses start-server.sh) - could be parallelized with careful coordination
- **US3 (P3)**: Depends on US1 (needs running servers)
- **US4 (P4)**: Depends on US1 (reuses start-server.sh)
- **US5 (P5)**: Depends on US2 (needs multiple servers for meaningful monitoring)

### Within Each User Story

- Configuration files [P] before scripts (scripts reference configs)
- Directory creation [P] before first deployment
- Core script implementation before testing
- Testing before documentation
- Story validation before moving to next priority

### Parallel Opportunities

**Setup Phase (Phase 1)**:

- All 5 tasks can run in parallel (different files)

**User Story 1**:

- T009, T010, T011 can run in parallel (different directories)

**User Story 2**:

- T016-T020 can run in parallel (different config files and directories)
- T026-T030 can run in parallel (different documentation files)

**Polish Phase**:

- T050, T051, T052, T053, T059 can run in parallel (different files)
- T054, T055, T056 can run in parallel (different test scripts)

---

## Implementation Strategy

### MVP First (Recommended)

1. **Complete Phase 1 (Setup)**: ~1 hour
2. **Complete Phase 2 (Foundational)**: ~2 hours
3. **Complete Phase 3 (User Story 1)**: ~4 hours
4. **STOP and VALIDATE**: Deploy vanilla server, test with real Minecraft client
5. **Deliverable**: Single working Minecraft server with persistence (SC-001, SC-003, SC-009 validated)

**Value**: Administrators can start using the system immediately with one server

### Full Feature Delivery

1. Complete MVP (Phases 1-3)
2. Add Phase 4 (US2): Multi-server support → ~6 hours
3. Add Phase 5 (US3): Backup/restore → ~4 hours
4. Add Phase 6 (US4): Custom modpacks → ~3 hours
5. Add Phase 7 (US5): Health monitoring → ~3 hours
6. Complete Phase 8: Polish & validation → ~4 hours

**Total Estimated Time**: ~27 hours for complete feature

### Incremental Delivery Checkpoints

- **Checkpoint 1 (MVP)**: Single vanilla server operational
- **Checkpoint 2**: 5 pre-configured modpacks running concurrently
- **Checkpoint 3**: Backup and restore working for all servers
- **Checkpoint 4**: Custom modpack addition capability
- **Checkpoint 5**: Full health monitoring and auto-restart
- **Final Checkpoint**: Production-ready with all documentation

---

## Task Summary

- **Total Tasks**: 60
- **Setup Tasks**: 5
- **Foundational Tasks**: 3
- **User Story 1 Tasks**: 7 (MVP)
- **User Story 2 Tasks**: 15
- **User Story 3 Tasks**: 6
- **User Story 4 Tasks**: 7
- **User Story 5 Tasks**: 6
- **Polish Tasks**: 11

### Tasks by User Story

- **US1 (P1 - MVP)**: 7 tasks - Single server deployment with persistence
- **US2 (P2)**: 15 tasks - Multi-server orchestration with 5 pre-configured modpacks
- **US3 (P3)**: 6 tasks - Automated backup with 3-rolling window retention
- **US4 (P4)**: 7 tasks - Custom modpack addition capability
- **US5 (P5)**: 6 tasks - Health monitoring and failure detection

### Parallel Task Count

- **Setup Phase**: 4 parallelizable tasks (T002-T005)
- **User Story 1**: 3 parallelizable tasks (T009-T011)
- **User Story 2**: 9 parallelizable tasks (T016-T020, T026-T030)
- **Polish Phase**: 7 parallelizable tasks (T050-T053, T055-T056, T059)

**Total Parallelizable**: 23 tasks (38% of all tasks)

---

## Success Criteria Coverage

All 10 success criteria from spec.md are validated across user stories:

- **SC-001**: Validated in US1 (5-minute deployment)
- **SC-002**: Validated in US2 (5+ concurrent servers)
- **SC-003**: Validated in US1 (100 restarts with zero data loss tested manually)
- **SC-004**: Validated in US3 (backup completes in <10 minutes)
- **SC-005**: Validated in US4 (custom modpack added in <15 minutes)
- **SC-006**: Validated in US5 (failure detection <30 seconds)
- **SC-007**: Validated in US3 (restore completes in <15 minutes)
- **SC-008**: Validated in US2 (port conflict detection via validation)
- **SC-009**: Validated in US1 (quickstart guide enables 30-minute deployment)
- **SC-010**: Validated in US5 (log organization enables 2-minute event location)

---

## Notes

- No automated tests requested - manual integration tests in Phase 8
- All scripts are Bash 4.0+ compatible for Linux target platform
- Template-based orchestration eliminates need to edit docker-compose.yml for new servers
- Each user story deliverable is independently testable and valuable
- MVP (US1) delivers immediate value as working Minecraft server
- Constitution principles validated: modular (I), separated configs (II), persistent volumes (III), documented (IV), extensible (V), environment-driven (VI)
- Exit codes follow contract specification: 0=success, 1=error, 2=invalid args, 3=not found, 4=validation fail, 5=timeout

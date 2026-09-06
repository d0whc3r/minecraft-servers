# Changelog

All notable changes to the Minecraft Multi-Server System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Minecraft Multi-Server System
- Support for 14+ pre-configured modpacks
- Automated backup system with integrity verification
- Health monitoring and auto-restart capabilities
- Template-based Docker Compose orchestration
- Comprehensive management scripts
- GitHub Actions CI/CD pipeline with parallel testing
- Extensive documentation and guides
- 6 new top-downloaded servers: `better-mc-bmc4`, `prominence-2`, `pixelmon`,
  `deceasedcraft`, `cursed-walking` and `all-the-mods-10-sky`
- New `add-modpack.sh` templates (`bmc4`, `pixelmon`, `atm10sky`, `deceasedcraft`,
  `cursed-walking`) with Modrinth template support

### Changed

- Verified every server against live CurseForge/Modrinth/Paper/Mojang APIs (2026-09-06)
- `my-hero-adventure`: corrected MC version 1.12.2 → 1.16.5 (the pack's only
  release, MHA-1.0.0, targets 1.16.5)
- `unofficial-dragon-block-c`: corrected MC version 1.12.2 → 1.7.10 (Dragon
  Block C is a 1.7.10 mod; latest pack 4.1.25)
- `solo-leveling-reawakening`: MC 1.20.1 → 1.21.1 (SLR 1.7.7 moved to
  NeoForge 1.21.1)
- `slimes-adventure`: MC 1.19.2 (Forge) → 1.21.1 (Fabric); modpack 1.13.x
  dropped Forge
- `vanilla`: Paper 1.20.4 → 26.2 (latest stable Mojang/Paper release)
- Modpack files without an explicit pin (`CF_FILE_ID` / `MODRINTH_MODPACK_VERSION`)
  auto-download the latest release on start; verified pins for
  `plants-vs-zombies` (3.2.0) and `deceasedcraft` (5.10.17) point at the
  current latest

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- `start-server.sh` now exports `RCON_PORT` to Docker Compose so each server binds
  its own RCON port (`SERVER_PORT + 1000`) instead of every server colliding on 25575
- `add-modpack.sh` writes a valid `SERVER_NAME` (server slug, not the display name)
  and includes `RCON_PORT` in generated configs

### Security

- N/A

## [1.0.0] - 2025-11-10

### Added

- Complete Docker-based multi-server system
- Pre-configured modpacks from CurseForge and Modrinth
- Automated backup and restore functionality
- Health monitoring with auto-restart
- Comprehensive validation and troubleshooting tools
- GitHub Actions CI/CD with parallel testing
- Full documentation suite
- MIT License
- Contributing guidelines and code of conduct

### Technical Details

- Template-based orchestration supporting unlimited servers
- Isolated server configurations and data
- BATS testing framework integration
- pnpm dependency management
- Docker Compose v2 compatibility
- Bash 4.0+ script compatibility

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Version Format

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

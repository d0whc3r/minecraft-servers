# Documentation Index

Technical documentation for the Minecraft Multi-Server System. For a product overview
and quick start, see the [main README](../README.md).

## Getting Started

| Document                                          | Description                                  |
| ------------------------------------------------- | -------------------------------------------- |
| [Quick Start](QUICKSTART.md)                      | First server in ~5 minutes, daily operations |
| [Adding Modpacks](ADDING_MODPACKS.md)             | Templates and manual creation of new servers |
| [Environment Variables](ENVIRONMENT_VARIABLES.md) | Complete per-server configuration reference  |

## Operations

| Document                              | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| [Backup & Restore](BACKUP_RESTORE.md) | Backup strategy, checksums, restore, disaster recovery |
| [Monitoring](MONITORING.md)           | Health checks, JSON output, auto-restart daemon        |
| [Troubleshooting](TROUBLESHOOTING.md) | Diagnosis and fixes for common problems                |

## Design & Development

| Document                           | Description                                            |
| ---------------------------------- | ------------------------------------------------------ |
| [Architecture](ARCHITECTURE.md)    | Template orchestration, env layering, component design |
| [CI/CD](CI_CD.md)                  | GitHub Actions workflows, caching, test pipeline       |
| [Scripts](../scripts/README.md)    | Management scripts and the shared `common.sh` library  |
| [Contributing](../CONTRIBUTING.md) | How to contribute: setup, tests, PR process            |

## Modpack Guides

One page per pre-configured server with requirements, connection info, and tuning tips:

| Server                     | Guide                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| All The Mods 10            | [all-the-mods-10](modpacks/all-the-mods-10.md)                     |
| Amazing FPS Booster        | [amazing-fps-booster](modpacks/amazing-fps-booster.md)             |
| Cobbleverse                | [cobbleverse](modpacks/cobbleverse.md)                             |
| Menagerie                  | [menagerie](modpacks/menagerie.md)                                 |
| My Hero Adventure          | [my-hero-adventure](modpacks/my-hero-adventure.md)                 |
| Plants vs. Zombies+        | [plants-vs-zombies](modpacks/plants-vs-zombies.md)                 |
| RLCraft                    | [rlcraft](modpacks/rlcraft.md)                                     |
| SkyFactory 4               | [skyfactory4](modpacks/skyfactory4.md)                             |
| Slimes Adventure           | [slimes-adventure](modpacks/slimes-adventure.md)                   |
| SoloCraft                  | [solocraft-modpack](modpacks/solocraft-modpack.md)                 |
| Solo Leveling: Level Up    | [solo-leveling-level-up](modpacks/solo-leveling-level-up.md)       |
| Solo Leveling: Reawakening | [solo-leveling-reawakening](modpacks/solo-leveling-reawakening.md) |
| Solo Leveling: Shadows     | [solo-leveling-shadows](modpacks/solo-leveling-shadows.md)         |
| Unofficial Dragon Block C  | [unofficial-dragon-block-c](modpacks/unofficial-dragon-block-c.md) |
| Vanilla (Paper)            | [vanilla](modpacks/vanilla.md)                                     |

## Archive

Point-in-time analyses kept for historical context (may reference servers or decisions
that no longer exist):

- [Failed Servers Analysis](archive/FAILED_SERVERS_ANALYSIS.md)

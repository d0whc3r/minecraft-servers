# Minecraft Multi-Server System

Run multiple Minecraft servers — each with a different modpack — on a single machine with Docker. One shared `docker-compose.yml` template, one small `.env` file per server, and a set of scripts to start, stop, back up, and monitor everything.

## Features

- 🚀 **Multi-server**: 21 pre-configured modpacks, ready to start (add as many as you want)
- 🧩 **One template, many servers**: a single `docker-compose.yml` instantiated per server — no compose edits to add servers
- 💾 **Backups**: atomic backups with SHA256 verification and rolling retention
- 🏥 **Monitoring**: Docker health checks plus scripts for health reports and auto-restart
- 🎮 **CurseForge & Modrinth**: modpacks auto-download on first start (CurseForge needs an API key)
- 🔌 **RCON**: remote console enabled on every server

## Requirements

- **Docker Engine** 20.10+ and **Docker Compose** v2+ ([install guide](https://docs.docker.com/compose/install/))
- **Linux** (Ubuntu 20.04+, Debian 11+, or compatible) with Bash 4.0+
- **RAM**: add up the memory of the servers you want running simultaneously (see table below)
- **Disk**: 50GB+ recommended (worlds + backups)
- **CurseForge API key**: only needed for CurseForge modpacks (free at [console.curseforge.com](https://console.curseforge.com/))

## Quick Start

```bash
# 1. Clone and configure
git clone https://github.com/d0whc3r/minecraft-servers.git
cd minecraft-servers
cp .env.example .env # shared settings (EULA, RCON password, CF_API_KEY...)
nano .env            # set your CF_API_KEY and RCON_PASSWORD

# 2. Start a server (vanilla is light and fast — good first test)
./scripts/start-server.sh vanilla

# 3. Watch it start (~2 minutes; look for "Done! For help, type 'help'")
docker logs -f mc-vanilla

# 4. Connect from Minecraft Java Edition
#    Address: your-server-ip:25567
```

Accepting `EULA=TRUE` in `.env` means you accept the [Minecraft EULA](https://www.minecraft.net/en-us/eula).

## Pre-Configured Modpacks

Start any of these with `./scripts/start-server.sh <server-name>`. Each server gets its own world, config, and backups under `servers/<name>/` and `backups/<name>/`.

| Server Name                 | Modpack                      | MC Version | Memory | Port  | Platform   |
| --------------------------- | ---------------------------- | ---------- | ------ | ----- | ---------- |
| `all-the-mods-10`           | All The Mods 10              | 1.21.1     | 8G     | 25578 | CurseForge |
| `all-the-mods-10-sky`       | All The Mods 10: To the Sky  | 1.21.1     | 8G     | 25585 | CurseForge |
| `amazing-fps-booster`       | Amazing FPS Booster          | 1.20.6     | 2G     | 25573 | CurseForge |
| `better-mc-bmc4`            | Better MC [FORGE] BMC4       | 1.20.1     | 6G     | 25580 | CurseForge |
| `cobbleverse`               | Cobbleverse                  | 1.21.1     | 6G     | 25568 | Modrinth   |
| `cursed-walking`            | Cursed Walking               | 1.20.1     | 8G     | 25584 | CurseForge |
| `deceasedcraft`             | DeceasedCraft                | 1.20.1     | 6G     | 25583 | CurseForge |
| `menagerie`                 | Menagerie                    | 1.20.1     | 6G     | 25577 | CurseForge |
| `my-hero-adventure`         | My Hero Adventure            | 1.16.5     | 4G     | 25576 | CurseForge |
| `pixelmon`                  | The Pixelmon Modpack         | 1.21.1     | 6G     | 25582 | Modrinth   |
| `plants-vs-zombies`         | Plants vs. Zombies+          | 26.1.2     | 4G     | 25579 | CurseForge |
| `prominence-2`              | Prominence II: Hasturian Era | 1.20.1     | 6G     | 25581 | Modrinth   |
| `rlcraft`                   | RLCraft                      | 1.12.2     | 6G     | 25566 | CurseForge |
| `skyfactory4`               | SkyFactory 4                 | 1.12.2     | 6G     | 25565 | CurseForge |
| `slimes-adventure`          | Slimes Adventure             | 1.21.1     | 4G     | 25569 | Modrinth   |
| `solocraft-modpack`         | SoloCraft                    | 1.20.1     | 3G     | 25570 | Modrinth   |
| `solo-leveling-level-up`    | Solo Leveling: Level Up      | 1.20.1     | 4G     | 25575 | CurseForge |
| `solo-leveling-reawakening` | Solo Leveling: Reawakening   | 1.21.1     | 4G     | 25571 | CurseForge |
| `solo-leveling-shadows`     | Solo Leveling: Shadows       | 1.20.1     | 6G     | 25574 | CurseForge |
| `unofficial-dragon-block-c` | Unofficial Dragon Block C    | 1.7.10     | 4G     | 25572 | CurseForge |
| `vanilla`                   | Vanilla (Paper)              | 26.2       | 2G     | 25567 | Paper      |

> [!TIP]
> Running **all** servers at once needs ~109GB of RAM. Start with the ones you actually play, and use `list-servers.sh` to see what's running.

Every server also exposes **RCON on port + 1000** (e.g. `vanilla`: game `25567`, RCON `26567`) using the `RCON_PASSWORD` from `.env`.

Per-modpack details (requirements, gameplay, tuning): [docs/modpacks/](docs/modpacks/).

## Everyday Commands

```bash
./scripts/list-servers.sh                  # status of all servers
./scripts/start-server.sh <name>           # start one
./scripts/stop-server.sh <name>            # stop one
./scripts/start-all.sh                     # start everything configured
./scripts/stop-all.sh                      # stop everything
./scripts/restart-server.sh <name>         # restart one
./scripts/backup.sh <name>                 # back up a world
./scripts/restore.sh <name> <file>         # restore a backup
./scripts/health-check.sh --all            # health report
./scripts/add-modpack.sh <name>            # add a new server
```

Full command reference: [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Where Is My Data?

```
servers/<name>/data/     worlds, server.properties, logs
servers/<name>/mods/     extra mods you add manually
backups/<name>/          backup archives (last 3 kept)
config/modpacks/<name>.env   server configuration
```

## Documentation

| Doc                                                    | Contents                                      |
| ------------------------------------------------------ | --------------------------------------------- |
| [Quick Start](docs/QUICKSTART.md)                      | Detailed setup, first steps, daily operations |
| [Architecture](docs/ARCHITECTURE.md)                   | How the template system works internally      |
| [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) | Full configuration reference per server       |
| [Adding Modpacks](docs/ADDING_MODPACKS.md)             | Add custom CurseForge/Modrinth/Forge servers  |
| [Backup & Restore](docs/BACKUP_RESTORE.md)             | Backup strategy, restore, disaster recovery   |
| [Monitoring](docs/MONITORING.md)                       | Health checks and the auto-restart daemon     |
| [Troubleshooting](docs/TROUBLESHOOTING.md)             | Common problems and fixes                     |
| [CI/CD](docs/CI_CD.md)                                 | GitHub Actions workflows and testing          |
| [Modpack Guides](docs/modpacks/)                       | One page per modpack with tuning tips         |

## Contributing

Contributions welcome — new modpacks, script improvements, docs, tests. See [CONTRIBUTING.md](CONTRIBUTING.md). Development happens with `pnpm` (lint and BATS test suite); CI details in [docs/CI_CD.md](docs/CI_CD.md).

## Support

- 🐛 [Issues](https://github.com/d0whc3r/minecraft-servers/issues)
- 💬 [Discussions](https://github.com/d0whc3r/minecraft-servers/discussions)
- 🔒 [Security Policy](SECURITY.md)

## Acknowledgments

- [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server) — the Docker image that powers every server
- The Minecraft modding community, and the CurseForge & Modrinth platforms

## License

[MIT](LICENSE)

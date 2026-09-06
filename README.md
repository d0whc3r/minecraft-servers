# Minecraft Multi-Server System

Run multiple Minecraft servers — each with a different modpack — on a single machine with Docker. One shared `docker-compose.yml` template, one small `.env` file per server, and a set of scripts to start, stop, back up, and monitor everything.

## Features

- 🚀 **Multi-server**: 28 pre-configured modpacks, ready to start (add as many as you want)
- 🧩 **One template, many servers**: a single `docker-compose.yml` instantiated per server — no compose edits to add servers
- 🌐 **One entry point**: [mc-router](docs/ROUTER.md) fronts every server and routes by hostname — a single port for all of them, no per-server ports
- 💾 **Backups**: atomic backups with SHA256 verification and rolling retention
- 🏥 **Monitoring**: Docker health checks plus scripts for health reports and auto-restart
- 🎮 **CurseForge & Modrinth**: modpacks auto-download on first start (CurseForge needs an API key)
- 🔌 **RCON**: console enabled on every server (loopback-only)

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
nano .env            # set CF_API_KEY, RCON_PASSWORD and MC_ROUTER_DOMAIN
# (no domain? use your IP: MC_ROUTER_DOMAIN=192.168.1.10.nip.io)

# 2. Start a server (vanilla is light and fast — good first test; it also
#    starts mc-router, the shared entry point)
./scripts/start-server.sh vanilla

# 3. Watch it start (~2 minutes; look for "Done! For help, type 'help'")
docker logs -f mc-vanilla

# 4. Connect from Minecraft Java Edition
#    Address: vanilla.192.168.1.10.nip.io  (your MC_ROUTER_DOMAIN)
```

Accepting `EULA=TRUE` in `.env` means you accept the [Minecraft EULA](https://www.minecraft.net/en-us/eula).

## Pre-Configured Modpacks

Start any of these with `./scripts/start-server.sh <server-name>`. Each server gets its own world, config, and backups under `servers/<name>/` and `backups/<name>/`.

| Server Name                 | Modpack                      | MC Version | Memory | Platform   |
| --------------------------- | ---------------------------- | ---------- | ------ | ---------- |
| `all-the-mods-10`           | All The Mods 10              | 1.21.1     | 8G     | CurseForge |
| `all-the-mods-10-sky`       | All The Mods 10: To the Sky  | 1.21.1     | 8G     | CurseForge |
| `all-the-mods-11`           | All The Mods 11              | 26.1.2     | 8G     | CurseForge |
| `amazing-fps-booster`       | Amazing FPS Booster          | 1.20.6     | 2G     | CurseForge |
| `better-mc-bmc4`            | Better MC [FORGE] BMC4       | 1.20.1     | 6G     | CurseForge |
| `better-mc-bmc5`            | Better MC [NEOFORGE] BMC5    | 1.21.1     | 8G     | CurseForge |
| `cobblemon`                 | Cobblemon Official [Fabric]  | 1.21.1     | 6G     | Modrinth   |
| `cobbleverse`               | Cobbleverse                  | 1.21.1     | 6G     | Modrinth   |
| `cursed-walking`            | Cursed Walking               | 1.20.1     | 8G     | CurseForge |
| `dawncraft`                 | DawnCraft: Echoes of Legends | 1.18.2     | 8G     | CurseForge |
| `deceasedcraft`             | DeceasedCraft                | 1.20.1     | 6G     | CurseForge |
| `homestead`                 | Homestead                    | 1.20.1     | 6G     | CurseForge |
| `menagerie`                 | Menagerie                    | 1.20.1     | 6G     | CurseForge |
| `my-hero-adventure`         | My Hero Adventure            | 1.16.5     | 4G     | CurseForge |
| `pixelmon`                  | The Pixelmon Modpack         | 1.21.1     | 6G     | Modrinth   |
| `plants-vs-zombies`         | Plants vs. Zombies+          | 26.1.2     | 4G     | CurseForge |
| `prominence-2`              | Prominence II: Hasturian Era | 1.20.1     | 6G     | Modrinth   |
| `rlcraft`                   | RLCraft                      | 1.12.2     | 6G     | CurseForge |
| `skyfactory4`               | SkyFactory 4                 | 1.12.2     | 6G     | CurseForge |
| `slimes-adventure`          | Slimes Adventure             | 1.21.1     | 4G     | Modrinth   |
| `solocraft-modpack`         | SoloCraft                    | 1.20.1     | 3G     | Modrinth   |
| `solo-leveling-level-up`    | Solo Leveling: Level Up      | 1.20.1     | 4G     | CurseForge |
| `solo-leveling-reawakening` | Solo Leveling: Reawakening   | 1.21.1     | 4G     | CurseForge |
| `solo-leveling-shadows`     | Solo Leveling: Shadows       | 1.20.1     | 6G     | CurseForge |
| `stoneblock4`               | FTB StoneBlock 4             | 1.21.1     | 8G     | CurseForge |
| `unofficial-dragon-block-c` | Unofficial Dragon Block C    | 1.7.10     | 4G     | CurseForge |
| `vanilla`                   | Vanilla (Paper)              | 26.2       | 2G     | Paper      |
| `zombie-invade-100-days`    | Zombie Invade 100 Days       | 1.20.1     | 6G     | Modrinth   |

> [!TIP]
> Running **all** servers at once needs ~159GB of RAM. Start with the ones you actually play, and use `list-servers.sh` to see what's running.

### Connecting players

All servers sit behind **[mc-router](docs/ROUTER.md)**: players connect once to
`MC_ROUTER_PORT` (default `25565`) and the hostname picks the server —
`<server>.<MC_ROUTER_DOMAIN>`. There are no published game ports and no direct
`IP:port` access.

No domain of your own? Use **[nip.io](https://nip.io)** — set
`MC_ROUTER_DOMAIN=192.168.1.10.nip.io` (your host's IP) in `.env` and everyone
connects to `vanilla.192.168.1.10.nip.io` with zero DNS/hosts setup. Details:
[docs/ROUTER.md](docs/ROUTER.md).

Every server also exposes **RCON on a unique loopback port** (`RCON_PORT` in its
config, managed range 26565-26664; e.g. `vanilla` uses `26567`), reachable only
from the host, using the `RCON_PASSWORD` from `.env`.

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

## Makefile

One entry point for the whole monorepo (Go TUI, web panel, bash scripts):

```bash
make check      # lint (goimports+vet+staticcheck) + go tests + fast bats
make build      # mc-tui for the host -> bin/mc-tui
make run        # build + launch the dashboard
make release    # full cross-compile matrix (linux/darwin) -> dist/
make cover-html # go test coverage as HTML
make vuln       # govulncheck against the dependency graph
make outdated   # newer Go module/tool/JS versions
make test-bats  # full bats suite (slow: starts real servers)
make help       # every target with a description
```

Cross builds accept `OS=`/`ARCH=` (`make build OS=linux ARCH=arm64`); lint
tools are pinned in `apps/tui/go.mod`'s `tool` block and run with `go tool`.

## Terminal UI (TUI)

Prefer a dashboard over memorizing commands? `mc-tui` wraps those same scripts
in a full-screen terminal interface (Go source lives in `apps/tui`, part of the
pnpm workspace):

```bash
./scripts/tui.sh # builds on first run (needs Go 1.22+), then launches
pnpm tui         # same thing via package.json
```

Workspace package scripts (build/test/lint run inside `apps/tui`):

```bash
pnpm --filter @minecraft-servers/tui build # compile to bin/mc-tui
pnpm --filter @minecraft-servers/tui test  # go test ./...
pnpm --filter @minecraft-servers/tui lint  # gofmt + go vet
```

A live table shows every configured server with its state, health, mc-router
route, memory, MC version, players and uptime, refreshing every 5 seconds. The
selection's detail pane adds RCON port, latest backup and online players.

| Key                     | Action                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| `↑`/`↓`, `k`/`j`, click | select server                                                      |
| `enter`                 | start a stopped server · follow logs of a running one              |
| `s`                     | start selected server                                              |
| `x` / `r`               | stop / restart selected server (confirms; warns if players online) |
| `b`                     | back up selected server                                            |
| `l`                     | follow container logs (`esc` to go back)                           |
| `c`                     | open an RCON console (`enter` sends, `↑↓` history)                 |
| `p`                     | refresh online player count (auto-polled every 30s)                |
| `S` / `X`               | start all stopped / stop all running (confirm, ~RAM)               |
| `/`                     | filter servers by name (shows a `n/total` counter)                 |
| `o`                     | inspect the output of the last script action                       |
| `?`                     | full keyboard reference                                            |
| `q`                     | quit (asks first while script actions are running)                 |

The table adapts to the terminal width (columns hide progressively), running
actions show a live spinner with elapsed time in the status line, and the
detail pane's left border echoes the server state color.

Destructive actions ask for confirmation, and `S` warns with the approximate
total RAM of the servers it would start. Headless use (for scripts or CI):
`./bin/mc-tui --dump table` (or `--dump json`).

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
| [Web Panel](apps/web/README.md)                        | Browser dashboard + admin panel (Astro/React) |
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

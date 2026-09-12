# Minecraft Multi-Server System

Run multiple Minecraft servers — each with a different modpack — on a single
machine with Docker. One shared `docker-compose.yml` template, one small
`.env` file per server, and a set of scripts to start, stop, back up, and
monitor everything. Manage it from the terminal (CLI or TUI) or from a
browser (web panel).

## Features

- 🚀 **Multi-server**: 34 pre-configured modpacks, ready to start (add as many as you want)
- 🧩 **One template, many servers**: a single `docker-compose.yml` instantiated per server — no compose edits to add servers
- 🌐 **One entry point**: [mc-router](docs/ROUTER.md) fronts every server and routes by hostname — a single port for all of them, no per-server ports
- 🖥️ **Three ways to manage**: bash scripts, a [terminal dashboard](docs/TUI.md), and a [web panel](apps/web/README.md) with live logs and RCON console
- ☸️ **Kubernetes**: the same stack as Helm charts — the [web panel](docs/KUBERNETES.md) starts/stops servers as `mc-<server>` releases, mc-router discovers them in-cluster
- 💾 **Backups**: atomic backups with SHA256 verification and rolling retention
- 🏥 **Monitoring**: Docker health checks plus scripts for health reports and auto-restart
- 🎮 **CurseForge & Modrinth**: modpacks auto-download on first start (CurseForge needs an API key)

## Requirements

- **Docker Engine** 20.10+ and **Docker Compose** v2+ ([install guide](https://docs.docker.com/compose/install/))
- **Linux** (Ubuntu 20.04+, Debian 11+, or compatible) with Bash 4.0+
- **RAM**: add up the memory of the servers you want running simultaneously ([per-modpack memory table](docs/MODPACKS.md#catalog))
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

## Managing Your Servers

Pick whichever interface you like — they all drive the same scripts.

**CLI** (the reference; every command):

```bash
./scripts/list-servers.sh                  # status of all servers
./scripts/start-server.sh <name>           # start one
./scripts/stop-server.sh <name>            # stop one
./scripts/restart-server.sh <name>         # restart one
./scripts/backup.sh <name>                 # back up a world
./scripts/health-check.sh --all            # health report
./scripts/add-modpack.sh <name>            # add a new server
```

**Web panel** (browser dashboard + admin): status of every server, start/stop,
backups, live logs and an RCON console.

```bash
pnpm run panel:start # builds and starts it on http://localhost:3777
```

The first boot generates an admin password (printed once by
`docker compose logs panel`); set your own in `apps/web/.env` beforehand if
you prefer. Full guide: [apps/web/README.md](apps/web/README.md).

**Terminal UI** (full-screen dashboard): same actions with keyboard shortcuts.

```bash
pnpm tui
```

Keys and details: [docs/TUI.md](docs/TUI.md).

## Connecting Players

All servers sit behind **mc-router**: players connect once to `MC_ROUTER_PORT`
(default `25565`) and the hostname picks the server — `<server>.<MC_ROUTER_DOMAIN>`.
There are no published game ports and no direct `IP:port` access.

No domain of your own? Use **[nip.io](https://nip.io)** — set
`MC_ROUTER_DOMAIN=192.168.1.10.nip.io` (your host's IP) in `.env` and everyone
connects to `vanilla.192.168.1.10.nip.io` with zero DNS/hosts setup. Details:
[docs/ROUTER.md](docs/ROUTER.md).

## Modpacks

34 servers come pre-configured — from `vanilla` (light, no API key) to
RLCraft, All The Mods 10/11, DawnCraft, Cobblemon… Start any with
`./scripts/start-server.sh <name>`.

The full catalog with versions and memory per server:
[docs/MODPACKS.md](docs/MODPACKS.md). Per-modpack guides live in
[docs/modpacks/](docs/modpacks/), and any other modpack can be added with
`./scripts/add-modpack.sh` ([guide](docs/ADDING_MODPACKS.md)).

## Where Is My Data?

```
servers/<name>/data/     worlds, server.properties, logs
servers/<name>/mods/     extra mods you add manually
backups/<name>/          backup archives (last 3 kept)
config/modpacks/<name>.env   server configuration
```

## Documentation

| Doc                                                    | Contents                                          |
| ------------------------------------------------------ | ------------------------------------------------- |
| [Quick Start](docs/QUICKSTART.md)                      | Detailed setup, first steps, daily operations     |
| [Modpack Catalog](docs/MODPACKS.md)                    | The 34 pre-configured servers: versions, RAM      |
| [Web Panel](apps/web/README.md)                        | Browser dashboard + admin panel (Astro/React)     |
| [Terminal UI](docs/TUI.md)                             | Keyboard-driven dashboard (mc-tui)                |
| [Router](docs/ROUTER.md)                               | The single entry point: domains, nip.io, API      |
| [Kubernetes](docs/KUBERNETES.md)                       | Helm charts: the panel starts servers as releases |
| [Architecture](docs/ARCHITECTURE.md)                   | How the template system works internally          |
| [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) | Full configuration reference per server           |
| [Adding Modpacks](docs/ADDING_MODPACKS.md)             | Add custom CurseForge/Modrinth/Forge servers      |
| [Backup & Restore](docs/BACKUP_RESTORE.md)             | Backup strategy, restore, disaster recovery       |
| [Monitoring](docs/MONITORING.md)                       | Health checks and the auto-restart daemon         |
| [Troubleshooting](docs/TROUBLESHOOTING.md)             | Common problems and fixes                         |
| [CI/CD](docs/CI_CD.md)                                 | GitHub Actions workflows and testing              |
| [Modpack Guides](docs/modpacks/)                       | One page per modpack with tuning tips             |

## Contributing

Contributions welcome — new modpacks, script improvements, docs, tests. See [CONTRIBUTING.md](CONTRIBUTING.md) (development setup, Makefile targets, testing). CI details in [docs/CI_CD.md](docs/CI_CD.md).

## Support

- 🐛 [Issues](https://github.com/d0whc3r/minecraft-servers/issues)
- 💬 [Discussions](https://github.com/d0whc3r/minecraft-servers/discussions)
- 🔒 [Security Policy](SECURITY.md)

## Acknowledgments

- [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server) — the Docker image that powers every server
- The Minecraft modding community, and the CurseForge & Modrinth platforms

## License

[MIT](LICENSE)

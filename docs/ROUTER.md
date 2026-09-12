# mc-router: one port for every server

Every server used to need its own published port (`vanilla` on 25567,
`rlcraft` on 25566, ...) plus a RCON port per server. With [mc-router](https://github.com/itzg/mc-router)
players connect **once** to a single port and the router sends each session to
the right server based on the hostname the Minecraft client uses to connect.

```
client ── vanilla.mc.example.com ─┐
client ── rlcraft.mc.example.com ─┼──> mc-router :25565 ──> per-server containers
client ── atm10.mc.example.com ───┘         (internal minecraft-network)
```

- **No game ports. Ever.** Servers have no per-server game port at all; they
  only live on the internal `minecraft-network` bridge and mc-router reaches
  them over it. There is no direct `IP:port` access.
- **Zero per-server routing config.** The router auto-discovers backends from
  the `mc-router.host` label in `docker-compose.yml`.
- **Protocol-agnostic.** mc-router forwards raw TCP after reading the
  handshake, so it works with every version and modloader in this repo
  (1.7.10 Forge through Paper 26.x).

## Quick start

```bash
./scripts/router.sh start  # one proxy for all servers
./scripts/router.sh status # entry point + route table
```

Starting any server with `./scripts/start-server.sh <name>` auto-starts the
router — it is the only path players have, so it always runs.

Players connect to `<server-name>.<MC_ROUTER_DOMAIN>` — e.g. with the defaults,
`vanilla.mc.local`, `rlcraft.mc.local`, ...

## Making the hostnames resolve

The router keys on the hostname, so clients must be able to resolve
`<server>.<MC_ROUTER_DOMAIN>`:

- **Recommended when you have no domain: [nip.io](https://nip.io).** A free
  wildcard DNS that maps `<anything>.<ip>.nip.io` to `<ip>`. Set your host's
  LAN/public IP once in `.env`:

  ```bash
  MC_ROUTER_DOMAIN=192.168.1.10.nip.io
  ```

  and every player — LAN or internet — connects to
  `vanilla.192.168.1.10.nip.io`, `rlcraft.192.168.1.10.nip.io`, ... with **zero
  DNS or hosts-file setup**. (Dash form `192-168-1-10.nip.io` also works if a
  client dislikes dots.) Recreate the servers after changing the domain so the
  routes are re-stamped.

- **Own domain:** create a wildcard DNS record
  `*.mc.example.com → your server IP` and set `MC_ROUTER_DOMAIN=mc.example.com`.
- **Fully offline LAN (no internet at all):** add one line per server to each
  player's `hosts` file (`/etc/hosts`,
  `C:\Windows\System32\drivers\etc\hosts`):
  `192.168.1.10 vanilla.mc.local rlcraft.mc.local ...`

## Configuration (`MC_ROUTER_*` in `.env`)

| Variable               | Default    | Purpose                                                                                    |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `MC_ROUTER_DOMAIN`     | `mc.local` | Suffix appended to every server name (placeholder — prefer your IP + `.nip.io`, see above) |
| `MC_ROUTER_PORT`       | `25565`    | Public port of the router itself                                                           |
| `MC_ROUTER_API_PORT`   | `8080`     | Routes API, loopback-only, used by `router.sh routes`                                      |
| `MC_ROUTER_DOCKER_GID` | `999`      | Group ID with access to the Docker socket                                                  |
| `MC_ROUTER_VERSION`    | `latest`   | Image tag for `itzg/mc-router`                                                             |

Per-server, in `config/modpacks/<name>.env`:

- `RCON_PORT` — the **only** per-server port: the loopback-only admin console
  (managed range 26565-26664, must be unique per server).
- `MC_ROUTER_DEFAULT=true` — unknown hostnames are sent to this server
  (only one server should set it).

### How the `.env` pieces fit together

```
.env (shared)                     config/modpacks/<name>.env (per server)
─────────────────────────────     ─────────────────────────────────────────
MC_ROUTER_DOMAIN=mc.local   ─┐    SERVER_NAME=vanilla
MC_ROUTER_PORT=25565         ├──> RCON_PORT=26567   (loopback-only, unique)
MC_ROUTER_API_PORT=8080      │    MC_ROUTER_DEFAULT=   (optional)
                             │
     docker-compose.yml labels:  mc-router.host = vanilla.mc.local
     published ports:            127.0.0.1:26567 (RCON only)
```

- The route label is stamped when the container is **created**. After changing
  `MC_ROUTER_DOMAIN` or `SERVER_NAME`, recreate the server
  (`./scripts/stop-server.sh <name> && ./scripts/start-server.sh <name>`) so
  the new route shows up.
- Everything else (`MC_ROUTER_PORT`, `MC_ROUTER_API_PORT`, `MC_ROUTER_DOCKER_GID`)
  is read by the router's own compose file — restart it with
  `./scripts/router.sh restart` after changing those.

### Common tasks

| I want to...                     | Do this                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Play on LAN without a domain     | `MC_ROUTER_DOMAIN=<lan-ip>.nip.io` in `.env` (e.g. `192.168.1.10.nip.io`); recreate servers |
| Use a real domain                | `MC_ROUTER_DOMAIN=mc.example.com` in `.env` + wildcard DNS; recreate the servers            |
| Send unknown hostnames somewhere | `MC_ROUTER_DEFAULT=true` in one server's `config/modpacks/<name>.env`                       |
| See who routes where             | `./scripts/router.sh status` (labels) or `./scripts/router.sh routes` (live API)            |
| Check everything is reachable    | `./scripts/health-check.sh --all` (warns when the router entry point is down)               |

## RCON

RCON is administration traffic and stays **bound to `127.0.0.1`**: each server
has its unique `RCON_PORT` from the managed range 26565-26664, and nothing
outside the host can reach it. From the server host:

```bash
mcrcon -H 127.0.0.1 -P 26567 -p "$RCON_PASSWORD" list
```

For remote admin, SSH-tunnel the port (`ssh -L 26567:127.0.0.1:26567 host`).

## Advanced: what else mc-router supports

The sections above use a small, opinionated subset of mc-router. Everything it
ships with (see the [upstream README](https://github.com/itzg/mc-router)):

- **Scanner protection (already active).** mc-router applies a connection rate
  limit (`-connection-rate-limit`, default 1/s) and drops connections that
  don't ask for a mapped hostname — internet port-scanners probing 25565 get
  rejected without touching your servers.
- **Live route management via REST API** (needs `Accept: application/json`):
  `GET /routes`, `POST /routes` (`{"serverAddress": "...", "backend": "..."}`),
  `POST /defaultRoute`, `DELETE /routes/{serverAddress}`. Handy to add/remove
  a route on the fly without recreating a container:
  `./scripts/router.sh routes` already uses this API.
- **Multiple hostnames per server**: the official `mc-router.host` label
  accepts a comma/newline-separated list, and `mc-router.port` overrides the
  backend port (we always use the container's internal 25565, so we don't set
  it). If you ever need two names for one server, edit the label in
  `docker-compose.yml`.
- **`mc-router.network`**: picks the backend network when a container is
  attached to several; not needed here since servers live on the single
  `minecraft-network`.
- **Webhooks & metrics**: connect/disconnect webhooks and Prometheus/InfluxDB
  metrics endpoints for dashboards.
- **Docker auto-scaling**: with the `mc-router.auto-scale-up`/`-down` labels
  (and a _writable_ Docker socket) mc-router can start a stopped server when a
  player connects and stop it again when the last one leaves. That maps
  perfectly onto this repo — register all 34 modpacks and only pay RAM for the
  ones someone is actually playing. It would need compose changes (writable
  socket, labels per server), so it's a future option, not enabled here.

## Troubleshooting

- **Router can't read the Docker socket** (`permission denied` while trying to
  connect to the Docker daemon socket, crash-looping in
  `./scripts/router.sh logs`): the image runs non-root, so grant it the group
  that owns the socket _as seen from inside the container_. Beware: with
  **Docker Desktop** (context `desktop-linux`, check `docker context ls`) the
  containers run in the Desktop VM, so the mounted socket belongs to the **root
  group (GID 0)** even if `/var/run/docker.sock` on your host shows a different
  group (e.g. `999`/`docker`) — set `MC_ROUTER_DOCKER_GID=0`. On a native Linux
  daemon, use the socket's group instead
  (`stat -c '%g' /var/run/docker.sock` → usually 999). After changing it,
  `./scripts/router.sh restart` must recreate the container for the new
  `group_add` to apply. Alternative: run the container as `user: root`.
- **"Unknown hostname" on connect:** the client connected to a hostname with no
  matching label — check `./scripts/router.sh status` and what the client typed.
  Point `MC_ROUTER_DEFAULT=true` at one server to stop rejecting strays.
- **Router port busy:** something else owns `MC_ROUTER_PORT` — change
  `MC_ROUTER_PORT` in `.env` and restart the router.
- **Route not appearing:** labels apply when the container is created. Run
  `./scripts/stop-server.sh <name> && ./scripts/start-server.sh <name>` to
  recreate it, then check `docker inspect <container> --format '{{index .Config.Labels "mc-router.host"}}'`.

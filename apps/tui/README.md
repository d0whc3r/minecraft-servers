# mc-tui — terminal UI

A terminal dashboard (Go + Bubble Tea) for managing this repository's
Minecraft servers: start, stop, restart, back up, follow live logs, and open
an RCON console. Every operation is delegated to a runtime backend — the
repo's `scripts/` management scripts over docker natively, helm/kubectl
inside the panel container — no logic is duplicated twice. User guide
(launch, key reference): [docs/TUI.md](../../docs/TUI.md). This page covers
architecture and development.

Built around the **mc-router** philosophy: there are no per-server game
ports. The `ADDR` column shows each server's route
(`<server>.<MC_ROUTER_DOMAIN>`) — taken from the container's `mc-router.host`
label when the container exists, or derived from the `.env` for servers that
have not been created yet. Players always connect through `MC_ROUTER_PORT`;
RCON stays on loopback and the TUI console reaches it via `docker exec`.

Usage: `./scripts/tui.sh` or `pnpm tui` (from the repository root).

## Architecture (layers)

Dependencies always point downwards; no lower layer knows about the layers
above it.

```
main.go                    entrypoint: flags, repo-root detection, program bootstrap
internal/
├── domain/                pure business concepts — zero dependencies
│   ├── server.go            Server (config + state), Merge, ParseHealth, MemoryGB
│   ├── action.go            Action (start/stop/…): script, timeout and verb for each
│   └── players.go           ParsePlayers: interprets `rcon-cli list` output
├── config/                adapter: reads config/modpacks/*.env
├── docker/                adapter: the docker CLI
│   ├── states.go            States(): `docker ps -a` → state per server
│   ├── logs.go              FollowLogs(): `docker logs --follow` → LogLine channel
│   ├── rcon.go              Rcon()/Players(): `docker exec … rcon-cli`
│   └── parse.go             container names and router label parsing
├── kube/                  adapter: the kubernetes runtime (MCPANEL_RUNTIME=kubernetes)
│   ├── states.go            States(): `kubectl get deployments` → state per server
│   ├── runner.go            Run(): start/stop/restart as helm upgrade / rollout restart
│   ├── values.go            chart values from the env files (port of the panel's builder)
│   ├── job.go               backups: the same one-off Jobs the panel runs
│   ├── logs.go              FollowLogs(): `kubectl logs --follow`
│   ├── rcon.go              Rcon()/Players(): `kubectl exec … rcon-cli`
│   └── env.go               server catalog + .env merge (panel dir wins)
├── scripts/               adapter: runs the management scripts (bash)
├── backups/               adapter: reads backups/<server>/*.tar.gz
├── app/                   service: orchestrates adapters (the UI's only door)
│   └── service.go           Snapshot, RunAction, FollowLogs, Rcon, Players, LatestBackup
└── ui/                    presentation layer (Bubble Tea)
    ├── model.go             Model/Update: state, messages, async plumbing
    ├── keys.go              keyboard and mouse handling per view
    ├── actions.go           tea messages and commands (app.Service wrappers)
    ├── view.go              main view: header, responsive table, detail pane
    ├── view_streams.go      logs view and RCON console
    ├── view_modals.go       modals: confirmation, help, script output
    ├── theme.go             palette, lipgloss styles and state glyphs
    └── text.go              text helpers (fit/truncate, formatDuration)
```

House rules:

- `domain` imports nothing from the repo nor terminal libraries; it is pure
  and its logic is tested without docker.
- `ui` only talks to `app` (plus `domain` types); never to docker/kube/scripts
  directly.
- Tests live next to their package and are table-driven where it fits.

## Runtimes

`main.go` picks the `app` facade from the environment, using the same switch
as the web panel:

- **docker** (default): state, logs and RCON come from the docker CLI, and
  actions run the repo's bash scripts. The classic native/checkout use.
- **kubernetes** (`MCPANEL_RUNTIME=kubernetes`): the panel-container mode.
  Servers are Helm releases (`mc-<server>`): start/stop flip
  `replicaCount` via `helm upgrade` (values built from the same `.env`
  sources the panel reads), restart is a rollout restart, logs/RCON use
  `kubectl`, backups run the panel's one-off Jobs. Credentials come from the
  pod's ServiceAccount — nothing to configure. start-all/stop-all scale
  every *existing* release; never-deployed packs are left to the panel so a
  bulk start can't silently create twenty releases.

This is what powers sshing into the kubernetes panel
([docs/KUBERNETES.md](../../docs/KUBERNETES.md), "Shell + mc-tui over ssh"):
the panel image bundles the binary and both UIs manage the same releases and
read the same env sources.

## Workspace scripts

```bash
pnpm --filter @minecraft-servers/tui build # compile to bin/mc-tui
pnpm --filter @minecraft-servers/tui test  # go test ./...
pnpm --filter @minecraft-servers/tui lint  # gofmt + go vet
```

The root `Makefile` wraps the same targets plus release builds, coverage,
vulnerability scanning and the bash test suite — see `make help`.

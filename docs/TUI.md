# Terminal UI (mc-tui)

A full-screen terminal dashboard for managing every server in this repo:
start, stop, restart, back up, follow live logs, and open an RCON console —
without memorizing commands. It wraps the same `scripts/*.sh` the CLI uses,
so behavior is identical either way.

## Launch

```bash
./scripts/tui.sh # builds on first run (needs Go 1.22+), then launches
pnpm tui         # same thing via package.json
```

A live table shows every configured server with its state, health, mc-router
route, memory, MC version, players and uptime, refreshing every 5 seconds.
The selection's detail pane adds RCON port, latest backup and online players.

## Keys

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

## Behavior

- The table adapts to the terminal width (columns hide progressively).
- Running actions show a live spinner with elapsed time in the status line;
  the detail pane's left border echoes the server state color.
- Destructive actions ask for confirmation, and start-all (`S`) warns with
  the approximate total RAM of the servers it would start.
- Built around **mc-router**: there are no per-server game ports. The `ADDR`
  column shows each server's route (`<server>.<MC_ROUTER_DOMAIN>`) — that is
  the address players connect to. RCON stays on loopback; the built-in
  console reaches it via `docker exec`.

## Headless use

For scripts or CI:

```bash
./bin/mc-tui --dump table # plain-text table of every server
./bin/mc-tui --dump json  # same data as JSON
```

## Build & development

Source lives in `apps/tui` (Go + Bubble Tea). Architecture, layering rules
and tests: [apps/tui/README.md](../apps/tui/README.md).

```bash
make build                                 # host binary -> bin/mc-tui
pnpm --filter @minecraft-servers/tui build # compile to bin/mc-tui
pnpm --filter @minecraft-servers/tui test  # go test ./...
pnpm --filter @minecraft-servers/tui lint  # gofmt + go vet
```

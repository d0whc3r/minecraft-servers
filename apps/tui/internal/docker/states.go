// Package docker wraps the docker CLI: container states, log following and
// RCON access through the container's own rcon-cli.
package docker

import (
	"context"
	"os/exec"
	"strings"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

const statesTimeout = 15 * time.Second

// ContainerName maps a server name to its docker container name (mc-<server>).
func ContainerName(server string) string {
	return "mc-" + server
}

// States queries docker once and returns runtime state keyed by server name.
// Containers outside this project's naming scheme (e.g. leftovers from an old
// compose project that merely contain "mc-") are ignored.
func States() (map[string]domain.ContainerState, error) {
	ctx, cancel := context.WithTimeout(context.Background(), statesTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "docker", "ps", "-a",
		"--filter", "name=mc-",
		"--format", "{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Label \"mc-router.host\"}}",
	).Output()
	if err != nil {
		return nil, wrapCmdErr("docker ps", err)
	}
	return parseStates(out), nil
}

// parseStates parses `docker ps --format` output: one tab-separated record of
// name, state, status and mc-router host label per line.
func parseStates(out []byte) map[string]domain.ContainerState {
	states := make(map[string]domain.ContainerState)
	// Lines are split raw: TrimSpace on the whole output would eat the
	// trailing tab of the last line when its router label is empty, and the
	// field count would drop that container silently.
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSuffix(line, "\r") // tolerate CRLF output
		if strings.TrimSpace(line) == "" {
			continue
		}
		// The router label is last: SplitN keeps any stray tab inside it out
		// of the state fields.
		fields := strings.SplitN(line, "\t", 4)
		if len(fields) < 4 {
			continue
		}
		server, ok := serverFromContainer(fields[0])
		if !ok {
			continue
		}
		states[server] = domain.ContainerState{
			State:  fields[1],
			Health: domain.ParseHealth(fields[2]),
			Status: fields[2],
			Route:  strings.TrimSpace(fields[3]),
		}
	}
	return states
}

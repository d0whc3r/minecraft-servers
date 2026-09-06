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

	states := make(map[string]domain.ContainerState)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Split(line, "\t")
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
	return states, nil
}

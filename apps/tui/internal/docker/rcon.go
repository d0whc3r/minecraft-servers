package docker

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

const rconTimeout = 20 * time.Second

// Rcon sends one command through `docker exec + rcon-cli`. The itzg image
// configures rcon-cli from the container environment, so no credentials are
// needed here.
func Rcon(ctx context.Context, server, command string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, rconTimeout)
	defer cancel()

	args := append([]string{"exec", ContainerName(server), "rcon-cli"}, strings.Fields(command)...)
	out, err := exec.CommandContext(ctx, "docker", args...).CombinedOutput()
	return tail(string(out)), err
}

// Players fetches the online player list (`rcon-cli list`).
func Players(ctx context.Context, server string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, rconTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "docker", "exec",
		ContainerName(server), "rcon-cli", "list",
	).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// tail caps captured output so a runaway server reply cannot flood the UI.
func tail(s string) string {
	const maxCaptured = 16 * 1024
	s = strings.TrimSpace(s)
	if len(s) > maxCaptured {
		return "…(truncated)\n" + s[len(s)-maxCaptured:]
	}
	return s
}

// RCON through kubectl exec: the server pods ship rcon-cli (itzg image),
// already configured from their RCON_PASSWORD env — so the k8s runtime uses
// the same trick as the docker runtime's `docker exec`, just with kubectl.
package kube

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

const rconTimeout = 20 * time.Second

// Rcon sends one command through `kubectl exec + rcon-cli` on the server's
// minecraft container.
func Rcon(ctx context.Context, server, command string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, rconTimeout)
	defer cancel()

	args := append([]string{"exec", "--namespace", Namespace(),
		"deployment/" + ReleaseName(server),
		"--container", "minecraft",
		"--", "rcon-cli"}, strings.Fields(command)...)
	out, err := exec.CommandContext(ctx, "kubectl", args...).CombinedOutput()
	return tail(string(out)), err
}

// Players fetches the online player list (`rcon-cli list`).
func Players(ctx context.Context, server string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, rconTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "kubectl", "exec",
		"--namespace", Namespace(),
		"deployment/"+ReleaseName(server),
		"--container", "minecraft",
		"--", "rcon-cli", "list",
	).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

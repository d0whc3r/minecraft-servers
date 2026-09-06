// Package kube is the TUI's kubernetes runtime: the operations the docker
// runtime performs through the repo's bash scripts + docker CLI, expressed as
// helm/kubectl against the panel's namespace. The unit of management is the
// Helm release (mc-<server>) of charts/minecraft-server — exactly the surface
// the web panel drives (see apps/web/src/lib/k8s.ts), driven with the pod's
// own ServiceAccount. Enabled with MCPANEL_RUNTIME=kubernetes, the same
// switch the panel uses.
package kube

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"time"
)

const (
	// partOfLabel selects every server deployment; identical to the panel's
	// PART_OF_LABEL and to the chart's labels.
	partOfLabel = "app.kubernetes.io/part-of=minecraft-servers"

	// cliTimeout caps one kubectl/helm invocation (mirrors the panel's
	// KUBECTL_TIMEOUT_MS).
	cliTimeout = 40 * time.Second
)

// Namespace returns the namespace the mc-<server> releases live in: the
// panel's MCPANEL_K8S_NAMESPACE, defaulting like k8s-install.sh does.
func Namespace() string {
	if ns := os.Getenv("MCPANEL_K8S_NAMESPACE"); ns != "" {
		return ns
	}
	return "minecraft"
}

// ReleaseName maps a server name to its Helm release / Deployment name
// (mc-<server>), matching the panel and charts/minecraft-server.
func ReleaseName(server string) string {
	return "mc-" + server
}

// kubectl runs one kubectl invocation and returns its combined output.
func kubectl(ctx context.Context, args ...string) (string, error) {
	return cli(ctx, "kubectl", args)
}

// helm runs one helm invocation and returns its combined output.
func helm(ctx context.Context, args ...string) (string, error) {
	return cli(ctx, "helm", args)
}

func cli(ctx context.Context, bin string, args []string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cliTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, args...).CombinedOutput()
	return string(out), err
}

// tail caps captured output so a runaway command cannot flood the UI (same
// contract as scripts.Run in the docker runtime).
func tail(s string) string {
	const maxCaptured = 16 * 1024
	s = strings.TrimSpace(s)
	if len(s) > maxCaptured {
		return "…(truncated)\n" + s[len(s)-maxCaptured:]
	}
	return s
}

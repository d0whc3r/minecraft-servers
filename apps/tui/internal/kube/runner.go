// Management actions, mapped to the same helm/kubectl operations the web
// panel runs (see the action table in docs/KUBERNETES.md):
//
//	start   helm upgrade --install (new release, values built from the env
//	        files) or --reuse-values --set replicaCount=1 (stopped release)
//	stop    existing release scaled to 0 (data + route stay in place)
//	restart kubectl rollout restart, or a start when stopped
//	backup  one-off alpine Job running scripts/k8s-jobs/backup-create.sh
package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// Run executes a management action against the cluster. It is scripts.Run's
// k8s counterpart: same signature, same output contract (combined, tail-
// truncated output; non-nil error on failure).
func Run(ctx context.Context, root string, action domain.Action, server string) (string, error) {
	if !action.Valid() {
		return "", fmt.Errorf("unknown action %q: no k8s mapping", action)
	}
	if server == "" {
		return runAll(ctx, root, action)
	}
	switch action {
	case domain.ActionStart:
		return start(ctx, root, server)
	case domain.ActionStop:
		return stop(ctx, root, server)
	case domain.ActionRestart:
		return restart(ctx, root, server)
	case domain.ActionBackup:
		return backup(ctx, root, server, action.Timeout())
	default:
		return "", fmt.Errorf("action %q does not apply to a single server", action)
	}
}

// start brings a server up: an existing (stopped) release only flips
// replicaCount back to 1, reusing its rendered values; a never-deployed
// server gets its release created from the env files, values built exactly
// like the panel builds them.
func start(ctx context.Context, root, server string) (string, error) {
	if _, ok, err := deployment(ctx, server); err != nil {
		return "", err
	} else if ok {
		return scale(ctx, root, server, 1)
	}
	return deploy(ctx, root, server, 1)
}

// stop scales an existing release to 0. Stopping an undeployed server is a
// no-op, matching the panel.
func stop(ctx context.Context, root, server string) (string, error) {
	if _, ok, err := deployment(ctx, server); err != nil {
		return "", err
	} else if !ok {
		return "Server is not deployed", nil
	}
	return scale(ctx, root, server, 0)
}

// restart rolls a running deployment; a stopped (or missing) one is started.
func restart(ctx context.Context, root, server string) (string, error) {
	dep, ok, err := deployment(ctx, server)
	if err != nil {
		return "", err
	}
	if !ok || dep.desired() == 0 {
		return start(ctx, root, server)
	}
	out, err := kubectl(ctx, "rollout", "restart",
		"deployment/"+ReleaseName(server), "--namespace", Namespace())
	return tail(out), err
}

// scale flips replicaCount on an existing release, reusing its rendered
// values (nothing else changes: env, route and resources stay as they are).
func scale(ctx context.Context, root, server string, replicas int) (string, error) {
	out, err := helm(ctx, "upgrade", ReleaseName(server), chartPath(root),
		"--namespace", Namespace(),
		"--reuse-values",
		"--history-max", "5",
		"--set", fmt.Sprintf("replicaCount=%d", replicas))
	return tail(out), err
}

// deploy creates (or fully re-renders) a release from the env files: the
// values builder is a port of the panel's, so both UIs deploy identically.
func deploy(ctx context.Context, root, server string, replicas int) (string, error) {
	env, err := MergedEnv(root, server)
	if err != nil {
		return "", err
	}
	connect := env["SERVER_NAME"]
	if connect == "" {
		connect = server
	}
	values := BuildServerValues(env, connect+"."+RouterDomain(root), replicas)

	file, err := writeValuesFile(server, values)
	if err != nil {
		return "", err
	}
	defer os.Remove(file)

	out, err := helm(ctx, "upgrade", "--install", ReleaseName(server), chartPath(root),
		"--namespace", Namespace(),
		"--values", file,
		"--history-max", "5",
		"--set", fmt.Sprintf("replicaCount=%d", replicas))
	return tail(out), err
}

func writeValuesFile(server string, values chartValues) (string, error) {
	data, err := json.Marshal(values)
	if err != nil {
		return "", err
	}
	file := filepath.Join(os.TempDir(), fmt.Sprintf("mctui-values-%s-%d.json", server, time.Now().UnixNano()))
	if err := os.WriteFile(file, data, 0o600); err != nil {
		return "", err
	}
	return file, nil
}

// scaleAll is start-all/stop-all: bring every existing release up or down.
// Never-deployed servers are left to the panel on start-all — creating 20+
// releases (each reserving GBs of memory and, on first boot, downloading a
// whole modpack) must not be one keystroke away; stop-all stops everything.
func runAll(ctx context.Context, root string, action domain.Action) (string, error) {
	names, err := ServerNames(root)
	if err != nil {
		return "", err
	}
	replicas := 0
	if action == domain.ActionStartAll {
		replicas = 1
	}
	var b strings.Builder
	for _, name := range names {
		dep, ok, err := deployment(ctx, name)
		if err != nil {
			return b.String(), err
		}
		if replicas == 1 && !ok {
			fmt.Fprintf(&b, "%s: not deployed (start it once from the panel)\n", name)
			continue
		}
		if !ok || dep.desired() == replicas {
			continue // nothing to do
		}
		if _, err := scale(ctx, root, name, replicas); err != nil {
			fmt.Fprintf(&b, "%s: FAILED: %v\n", name, err)
			continue
		}
		verb := "stopped"
		if replicas == 1 {
			verb = "started"
		}
		fmt.Fprintf(&b, "%s: %s\n", name, verb)
	}
	return tail(b.String()), nil
}

// deployment fetches one server's Deployment; ok is false when it is not
// deployed (no release yet).
func deployment(ctx context.Context, server string) (deploymentItem, bool, error) {
	out, err := kubectl(ctx, "get", "deployment", ReleaseName(server),
		"--namespace", Namespace(), "--output", "json")
	if err != nil {
		// kubectl exits non-zero on NotFound; any failure counts as absent
		// (the dashboard then offers "start", like the panel does).
		return deploymentItem{}, false, nil
	}
	var item deploymentItem
	if err := json.Unmarshal([]byte(out), &item); err != nil {
		return deploymentItem{}, false, fmt.Errorf("cannot parse kubectl output: %w", err)
	}
	return item, true, nil
}

// chartPath is where the charts live in both layouts the TUI supports: the
// repo checkout and the panel image (/repo).
func chartPath(root string) string {
	return filepath.Join(root, "charts", "minecraft-server")
}

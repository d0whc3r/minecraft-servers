// Backups through one-off Jobs: a Go port of the panel's runJob
// (apps/web/src/lib/k8s.ts), running the same baked-in scripts
// (/repo/scripts/k8s-jobs) against the server's data/backups claims.
package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/backups"
)

// jobImage runs the one-off backup Jobs (alpine only, for tar/sha256sum).
func jobImage() string {
	if image := os.Getenv("MCPANEL_K8S_JOB_IMAGE"); image != "" {
		return image
	}
	return "alpine:3.20"
}

// backup creates a timestamped archive of the server's world in its backups
// claim, waiting for the Job to finish (same flow as the panel's action).
func backup(ctx context.Context, root, server string, timeout time.Duration) (string, error) {
	stamp := time.Now().UTC().Format("20060102T150405Z")
	file := fmt.Sprintf("%s-%s.tar.gz", server, stamp)
	name := fmt.Sprintf("mc-%s-backup-%x", server, time.Now().UnixNano())
	out, err := runJob(ctx, root, name, server, "backup-create", timeout, []string{file})
	if err != nil {
		return out, err
	}
	return tail(out + "\nBackup written to the server's backups volume: " + file), nil
}

// runJob applies the Job manifest and blocks until it finishes, returning
// the job's logs.
func runJob(ctx context.Context, root, name, server, scriptName string, timeout time.Duration, args []string) (string, error) {
	script, err := os.ReadFile(filepath.Join(root, "scripts", "k8s-jobs", scriptName+".sh"))
	if err != nil {
		return "", fmt.Errorf("job script not available: %w", err)
	}

	job := map[string]any{
		"apiVersion": "batch/v1",
		"kind":       "Job",
		"metadata": map[string]any{
			"name":      name,
			"namespace": Namespace(),
			"labels": map[string]string{
				"app.kubernetes.io/part-of":    "minecraft-servers",
				"app.kubernetes.io/managed-by": "mc-tui",
			},
		},
		"spec": map[string]any{
			"backoffLimit":            0,
			"activeDeadlineSeconds":   int(timeout.Seconds()) + 60,
			"ttlSecondsAfterFinished": 600,
			"template": map[string]any{
				"metadata": map[string]any{
					"labels": map[string]string{"app.kubernetes.io/part-of": "minecraft-servers"},
				},
				"spec": map[string]any{
					// argv tail: "job" is $0; the args arrive as positional
					// parameters of the script, never interpolated into it.
					"restartPolicy": "Never",
					"containers": []any{map[string]any{
						"name":    "job",
						"image":   jobImage(),
						"command": append([]string{"/bin/sh", "-ec", string(script), "job"}, args...),
						"volumeMounts": []any{
							map[string]any{"name": "data", "mountPath": "/data"},
							map[string]any{"name": "backups", "mountPath": "/backups"},
						},
					}},
					"volumes": []any{
						map[string]any{"name": "data",
							"persistentVolumeClaim": map[string]string{"claimName": ReleaseName(server) + "-data"}},
						map[string]any{"name": "backups",
							"persistentVolumeClaim": map[string]string{"claimName": ReleaseName(server) + "-backups"}},
					},
				},
			},
		},
	}

	// A leftover with the same name must not block the new one.
	if _, err := kubectl(ctx, "delete", "job", name, "--namespace", Namespace(), "--ignore-not-found"); err != nil {
		return "", fmt.Errorf("kubectl delete job: %w", err)
	}

	manifest := filepath.Join(os.TempDir(), fmt.Sprintf("mctui-job-%s.json", name))
	data, err := json.Marshal(job)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(manifest, data, 0o600); err != nil {
		return "", err
	}
	defer os.Remove(manifest)

	if _, err := kubectl(ctx, "apply", "--namespace", Namespace(), "--filename", manifest); err != nil {
		return "", fmt.Errorf("kubectl apply failed: %w", err)
	}
	return waitForJob(ctx, name, timeout)
}

// waitForJob polls the Job object until it succeeds (returning its logs) or
// fails; the context deadline plus grace bounds the wait, like the panel.
func waitForJob(ctx context.Context, name string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout + 90*time.Second)
	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(2500 * time.Millisecond):
		}
		out, err := kubectl(ctx, "get", "job", name, "--namespace", Namespace(), "--output", "json")
		if err == nil {
			var job struct {
				Status struct {
					Succeeded int `json:"succeeded"`
					Failed    int `json:"failed"`
				} `json:"status"`
			}
			if json.Unmarshal([]byte(out), &job) == nil {
				if job.Status.Succeeded >= 1 {
					return jobLogs(ctx, name), nil
				}
				if job.Status.Failed >= 1 {
					return jobLogs(ctx, name), fmt.Errorf("backup job failed:\n%s", jobLogs(ctx, name))
				}
			}
		}
		if time.Now().After(deadline) {
			return "", fmt.Errorf("job %s did not finish within the time limit", name)
		}
	}
}

func jobLogs(ctx context.Context, name string) string {
	out, err := kubectl(ctx, "logs", "job/"+name, "--namespace", Namespace())
	if err != nil {
		return "(no job output)"
	}
	if tail(out) == "" {
		return "(no job output)"
	}
	return tail(out)
}

// LatestBackup reports the newest archive in the server's backups claim, the
// remote counterpart of backups.Latest. When the server is stopped there is
// no pod to exec into and ok is false — the detail pane then just hides the
// backup line, same as a server without local backups.
func LatestBackup(ctx context.Context, server string) (backups.Backup, bool) {
	ctx, cancel := context.WithTimeout(ctx, cliTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "kubectl", "exec",
		"--namespace", Namespace(),
		"deployment/"+ReleaseName(server),
		"--container", "minecraft",
		"--", "/bin/sh", "-c",
		`f=$(ls -1t /backups/*.tar.gz 2>/dev/null | head -1); [ -n "$f" ] && stat -c '%Y %n' "$f"`,
	).CombinedOutput()
	if err != nil {
		return backups.Backup{}, false
	}
	fields := strings.Fields(strings.TrimSpace(string(out)))
	if len(fields) != 2 {
		return backups.Backup{}, false
	}
	seconds, err := strconv.ParseInt(fields[0], 10, 64)
	if err != nil {
		return backups.Backup{}, false
	}
	return backups.Backup{
		Name:    filepath.Base(fields[1]),
		ModTime: time.Unix(seconds, 0),
	}, true
}

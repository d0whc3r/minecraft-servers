package app

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestSnapshotErrorWithoutConfig checks the error path: a root without
// config/modpacks must surface the loader error, not an empty list.
func TestSnapshotErrorWithoutConfig(t *testing.T) {
	svc := New(t.TempDir())
	if _, err := svc.Snapshot(); err == nil {
		t.Fatal("Snapshot should fail when config/modpacks is missing")
	}
}

// TestSnapshotIntegration runs against the real repository configs and the
// real docker daemon when available: config is the source of truth, so the
// snapshot must contain every configured server, and any that docker reports
// must carry a valid state. Skips when docker is unavailable.
func TestSnapshotIntegration(t *testing.T) {
	root := "../../.."
	if _, err := os.Stat(filepath.Join(root, "config", "modpacks")); err != nil {
		t.Skipf("repository root not found from %s", root)
	}
	if err := exec.Command("docker", "info").Run(); err != nil {
		t.Skipf("docker daemon unavailable: %v", err)
	}

	servers, err := New(root).Snapshot()
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if len(servers) < 15 {
		t.Errorf("got %d servers, want the full configured set (15+)", len(servers))
	}

	seen := map[string]bool{}
	for _, s := range servers {
		if seen[s.Name] {
			t.Errorf("duplicate server %q", s.Name)
		}
		seen[s.Name] = true
		if s.RconEnable && s.RconPort == "" {
			t.Errorf("%s enables RCON without a port", s.Name)
		}
		// mc-router philosophy: every route must be the server's hostname
		// under the configured domain (<server>.<MC_ROUTER_DOMAIN>).
		if s.Route != "" && !strings.HasPrefix(s.Route, s.Name+".") {
			t.Errorf("%s route = %q, want %s.<MC_ROUTER_DOMAIN>", s.Name, s.Route, s.Name)
		}
	}
	for _, required := range []string{"vanilla", "rlcraft"} {
		if !seen[required] {
			t.Errorf("required server %q missing from snapshot", required)
		}
	}
}

// TestLatestBackupFromFixture proves the service resolves backups through the
// backups adapter using a synthetic repository.
func TestLatestBackupFromFixture(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "backups", "vanilla")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "vanilla-20260906.tar.gz"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	backup, ok := New(root).LatestBackup("vanilla")
	if !ok || backup.Name != "vanilla-20260906.tar.gz" {
		t.Errorf("LatestBackup = %+v ok=%v, want the fixture archive", backup, ok)
	}

	if _, ok := New(root).LatestBackup("no-such-server"); ok {
		t.Error("server without backups must report ok=false")
	}
}

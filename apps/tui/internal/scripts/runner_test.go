package scripts

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// TestRunContract builds a fake repository whose scripts report their
// environment, proving the runner's real contract: the script runs with the
// repo root as working directory, receives the server name as $1, its output
// reaches the caller, and a non-zero exit becomes an error.
func TestRunContract(t *testing.T) {
	root := t.TempDir()
	scriptsDir := filepath.Join(root, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o700); err != nil {
		t.Fatal(err)
	}

	writeScript := func(name, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(scriptsDir, name), []byte("#!/usr/bin/env bash\n"+body), 0o700); err != nil {
			t.Fatal(err)
		}
	}

	writeScript("backup.sh", `echo "cwd=$(pwd) server=$1"`)
	writeScript("start-server.sh", `echo "boom" >&2; exit 3`)

	// Happy path: working directory and argument passing.
	out, err := Run(context.Background(), root, domain.ActionBackup, "vanilla")
	if err != nil {
		t.Fatalf("Run backup: %v", err)
	}
	if !strings.Contains(out, "server=vanilla") {
		t.Errorf("script did not receive the server name: %q", out)
	}
	if !strings.Contains(out, "cwd="+root) {
		t.Errorf("script must run with the repo root as cwd, got %q", out)
	}

	// Failure path: non-zero exit + stderr surface as an error.
	_, err = Run(context.Background(), root, domain.ActionStart, "vanilla")
	if err == nil {
		t.Fatal("failing script must return an error")
	}
	if !strings.Contains(err.Error(), "exit status 3") {
		t.Errorf("error should carry the exit status, got %v", err)
	}
}

// TestRunHonorsContextCancellation proves the timeout ceiling is real: a
// script that outlives its context is killed, not waited on.
func TestRunHonorsContextCancellation(t *testing.T) {
	root := t.TempDir()
	scriptsDir := filepath.Join(root, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(scriptsDir, "backup.sh"),
		[]byte("#!/usr/bin/env bash\nsleep 60"), 0o700); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := Run(ctx, root, domain.ActionBackup, "vanilla")
	if err == nil {
		t.Fatal("killed script must return an error")
	}
	if elapsed := time.Since(start); elapsed > 10*time.Second {
		t.Errorf("Run blocked for %v; context cancellation should kill the script", elapsed)
	}
}

// TestRunRejectsUnknownAction guards the command construction: an action
// without a script must be rejected before exec, never run as a bare "bash".
func TestRunRejectsUnknownAction(t *testing.T) {
	_, err := Run(context.Background(), t.TempDir(), domain.Action("nonsense"), "x")
	if err == nil || !strings.Contains(err.Error(), "unknown action") {
		t.Errorf("err = %v, want unknown-action rejection", err)
	}
}

func TestTail(t *testing.T) {
	small := "ok\n"
	if got := tail(small); got != "ok" {
		t.Errorf("tail should trim: got %q", got)
	}
	big := strings.Repeat("x", 16*1024+100)
	got := tail(big)
	if !strings.HasPrefix(got, "…(truncated)") {
		t.Error("oversized output should be marked as truncated")
	}
	if len(got) > 16*1024+20 {
		t.Errorf("truncated output too long: %d", len(got))
	}
}

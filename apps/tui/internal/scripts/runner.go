// Package scripts delegates the management operations to the repository's
// own bash scripts, so the TUI never duplicates start/stop/backup logic.
package scripts

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// killGrace is how long Wait may hang around after the context kills the
// script before its pipes are force-closed. Without it, a script that leaves
// children running (tar, sleep, …) inherits the output pipes and blocks the
// caller until those children exit.
const killGrace = 5 * time.Second

// Run executes the script for an action on a server ("" for global actions
// such as start-all) with the repo root as working directory. It returns the
// combined, tail-truncated output.
func Run(ctx context.Context, root string, action domain.Action, server string) (string, error) {
	if !action.Valid() {
		return "", fmt.Errorf("unknown action %q: no script mapped", action)
	}
	// The scripts live under <root>/scripts; with Dir=root the relative path
	// must include the scripts/ segment or bash will not find the file.
	cmd := exec.CommandContext(ctx, "bash", filepath.Join("scripts", action.Script()), server)
	cmd.Dir = root
	cmd.WaitDelay = killGrace
	out, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return tail(string(out)), ctx.Err()
	}
	if errors.Is(err, exec.ErrWaitDelay) {
		// Pipes were force-closed after the grace period; the run is over.
		err = nil
	}
	return tail(string(out)), err
}

// tail caps captured output so a runaway script cannot flood the UI.
func tail(s string) string {
	const maxCaptured = 16 * 1024
	s = strings.TrimSpace(s)
	if len(s) > maxCaptured {
		return "…(truncated)\n" + s[len(s)-maxCaptured:]
	}
	return s
}

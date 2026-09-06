package domain

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// knownActions is the complete set of operations the UI can trigger. Adding
// an action here forces TestActionScriptsExistInRepo to prove its script is
// real before it ships.
var knownActions = []Action{ActionStart, ActionStop, ActionRestart, ActionBackup, ActionStartAll, ActionStopAll}

// TestActionScriptsExistInRepo proves that every action maps to a script that
// actually exists in the repository. This is the contract between the TUI and
// the bash tooling: if a script is renamed or deleted, the test fails — the
// TUI would otherwise fail at runtime, with a server in hand.
func TestActionScriptsExistInRepo(t *testing.T) {
	scriptsDir := filepath.Join("..", "..", "..", "scripts")
	if _, err := os.Stat(scriptsDir); err != nil {
		t.Skipf("repository scripts dir not found from %s: %v", cwd(), err)
	}

	for _, action := range knownActions {
		script := action.Script()
		if script == "" {
			t.Errorf("%s has no script mapped", action)
			continue
		}
		if _, err := os.Stat(filepath.Join(scriptsDir, script)); err != nil {
			t.Errorf("%s -> %s does not exist in the repository", action, script)
		}
		if action.Timeout() <= 0 {
			t.Errorf("%s timeout = %v, want positive", action, action.Timeout())
		}
	}
}

// TestUnknownActionIsRejected checks the guard rails for a non-existent
// action: no script, invalid, and a positive (non-zero) fallback timeout so
// callers can never build an unbounded context from it.
func TestUnknownActionIsRejected(t *testing.T) {
	unknown := Action("nonsense")
	if unknown.Script() != "" {
		t.Errorf("unknown action script = %q, want empty", unknown.Script())
	}
	if unknown.Valid() {
		t.Error("unknown action must not be valid")
	}
	if unknown.Timeout() <= 0 {
		t.Error("timeout fallback must still be positive")
	}
}

// TestActionVerbs pins the human-readable phrasing used in toasts: the server
// name is appended for per-server actions and omitted for global ones.
func TestActionVerbs(t *testing.T) {
	tests := []struct {
		action Action
		server string
		want   string
	}{
		{ActionStart, "vanilla", "start vanilla"},
		{ActionStartAll, "", "start-all"},
		{ActionBackup, "rlcraft", "backup rlcraft"},
	}
	for _, tt := range tests {
		t.Run(string(tt.action), func(t *testing.T) {
			if got := tt.action.Verb(tt.server); got != tt.want {
				t.Errorf("Verb(%q, %q) = %q, want %q", tt.action, tt.server, got, tt.want)
			}
		})
	}
}

// TestGlobalActionTimeoutsCoverLongJobs checks the policy that bulk and
// backup operations get more headroom than a single start: starting every
// modpack (sequential downloads) must not time out before the individual
// starts could.
func TestGlobalActionTimeoutsCoverLongJobs(t *testing.T) {
	if ActionStartAll.Timeout() < ActionStart.Timeout()*2 {
		t.Errorf("start-all timeout %v should allow for multiple sequential starts (start = %v)",
			ActionStartAll.Timeout(), ActionStart.Timeout())
	}
	if ActionBackup.Timeout() < TimeoutBackup {
		t.Errorf("backup timeout = %v, want the 30-minute ceiling", ActionBackup.Timeout())
	}
	if TimeoutStart != 15*time.Minute {
		t.Errorf("TimeoutStart = %v, want 15m (first-start modpack downloads are slow)", TimeoutStart)
	}
}

func cwd() string {
	dir, _ := os.Getwd()
	return dir
}

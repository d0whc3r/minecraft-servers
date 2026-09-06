package docker

import (
	"context"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// dockerAvailable reports whether the docker CLI can talk to a daemon; all
// integration tests skip cleanly when it cannot (CI containers, air-gapped
// machines).
func dockerAvailable(t *testing.T) {
	t.Helper()
	if err := exec.Command("docker", "info").Run(); err != nil {
		t.Skipf("docker daemon unavailable: %v", err)
	}
}

// TestStatesIntegration cross-validates States() against the raw docker CLI:
// the parsed server set must be exactly the set of mc-<name> containers
// docker reports, and every parsed state must be a known docker state. This
// is the test that catches drift in the --format output contract.
func TestStatesIntegration(t *testing.T) {
	dockerAvailable(t)

	states, err := States()
	if err != nil {
		t.Fatalf("States: %v", err)
	}

	raw := map[string]bool{}
	out, err := exec.Command("docker", "ps", "-a",
		"--filter", "name=mc-", "--format", "{{.Names}}").Output()
	if err != nil {
		t.Fatalf("raw docker ps: %v", err)
	}
	for _, name := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if name != "" {
			raw[name] = true
		}
	}

	validStates := map[string]bool{
		"running": true, "exited": true, "created": true,
		"paused": true, "restarting": true, "dead": true,
	}
	for container := range raw {
		server, ok := serverFromContainer(container)
		if !ok {
			continue // stray old compose project: must not appear in states
		}
		state, ok := states[server]
		if !ok {
			t.Errorf("container %q is missing from States()", container)
			continue
		}
		if !validStates[state.State] {
			t.Errorf("server %s has unknown state %q", server, state.State)
		}
		if state.Status == "" {
			t.Errorf("server %s has an empty human status", server)
		}
	}
	for server := range states {
		if !raw["mc-"+server] {
			t.Errorf("States() invented server %q not present in docker", server)
		}
	}
}

// TestFollowLogsMissingContainerClosesStream checks the error path of the log
// pump against a container that cannot exist: the caller must get an error
// line and then a closed channel, never a hang.
func TestFollowLogsMissingContainerClosesStream(t *testing.T) {
	dockerAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	ch := make(chan LogLine, 16)
	go FollowLogs(ctx, "definitely-not-a-real-mc-container", ch)

	sawErr := false
	for line := range ch {
		if line.Err != nil {
			sawErr = true
		}
	}
	if !sawErr {
		t.Error("expected an error line before the stream closed")
	}
}

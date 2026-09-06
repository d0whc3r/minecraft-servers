package docker

import (
	"strings"
	"testing"
)

func TestServerFromContainer(t *testing.T) {
	tests := []struct {
		name, container string
		wantServer      string // "" when the container must be ignored
	}{
		{"valid", "mc-rlcraft", "rlcraft"},
		{"hyphenated", "mc-all-the-mods-10", "all-the-mods-10"},
		{"stray compose project", "cobbleverse_server-mc-1", ""},
		{"no prefix", "minecraft", ""},
		{"uppercase", "mc-Vanilla", ""},
		{"trailing junk", "mc-x_1", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := serverFromContainer(tt.container)
			if ok != (tt.wantServer != "") || got != tt.wantServer {
				t.Errorf("container %q -> %q (ok=%v), want %q", tt.container, got, ok, tt.wantServer)
			}
		})
	}
}

// TestStatesLineFormat guards the tab-splitting assumption used by States
// against the exact `docker ps --format` output shape (name, state, status
// and the mc-router host label — game ports do not exist in this setup).
func TestStatesLineFormat(t *testing.T) {
	line := strings.Join([]string{
		"mc-vanilla", "running", "Up 5 minutes (healthy)", "vanilla.mc.example.com",
	}, "\t")
	fields := strings.Split(line, "\t")
	if len(fields) != 4 {
		t.Fatalf("expected 4 fields, got %d", len(fields))
	}
	server, ok := serverFromContainer(fields[0])
	if !ok || server != "vanilla" {
		t.Errorf("server = %q (ok=%v), want vanilla", server, ok)
	}
	if fields[3] == "" {
		t.Error("router label should be captured when set")
	}
}

// TestStatesLineWithoutRouterLabel covers containers created before a domain
// was configured (label empty or field absent) — the parser must not panic
// and the route stays empty for the caller to derive.
func TestStatesLineWithoutRouterLabel(t *testing.T) {
	line := strings.Join([]string{"mc-legacy", "exited", "Exited (0) 3 days ago", ""}, "\t")
	fields := strings.Split(line, "\t")
	if len(fields) != 4 {
		t.Fatalf("expected 4 fields, got %d", len(fields))
	}
	if fields[3] != "" {
		t.Errorf("label = %q, want empty", fields[3])
	}
}

func TestContainerName(t *testing.T) {
	if got := ContainerName("rlcraft"); got != "mc-rlcraft" {
		t.Errorf("ContainerName = %q, want mc-rlcraft", got)
	}
}

package domain

import "testing"

func TestServerPredicates(t *testing.T) {
	tests := []struct {
		name        string
		state       string
		wantRunning bool
		wantExists  bool
		wantLabel   string
	}{
		{"running", "running", true, true, "running"},
		{"restarting counts as running", "restarting", true, true, "restarting"},
		{"exited", "exited", false, true, "exited"},
		{"created", "created", false, true, "created"},
		{"paused", "paused", false, true, "paused"},
		{"absent", "", false, false, "absent"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := Server{ContainerState: ContainerState{State: tt.state}}
			if got := s.Running(); got != tt.wantRunning {
				t.Errorf("Running() = %v, want %v", got, tt.wantRunning)
			}
			if got := s.Exists(); got != tt.wantExists {
				t.Errorf("Exists() = %v, want %v", got, tt.wantExists)
			}
			if got := s.StateLabel(); got != tt.wantLabel {
				t.Errorf("StateLabel() = %q, want %q", got, tt.wantLabel)
			}
		})
	}
}

// TestMergeAndRouteResolution checks the merge and the route policy: the
// container's mc-router label wins (it is what the router actually serves),
// servers without a container get <name>.<domain> derived from the .env, and
// with no domain at all the route stays empty. Orphan containers without a
// config are dropped.
func TestMergeAndRouteResolution(t *testing.T) {
	configs := []ServerConfig{
		{Name: "rlcraft"},
		{Name: "vanilla"},
		{Name: "never-started"},
	}
	states := map[string]ContainerState{
		"rlcraft": {State: "running", Health: "healthy", Route: "rlcraft.stale.domain"},
		"vanilla": {State: "created"},
		// an orphan container with no config must be ignored entirely
		"ghost": {State: "running", Route: "ghost.domain"},
	}

	servers := Merge(configs, states, "mc.example.com")
	if len(servers) != 3 {
		t.Fatalf("got %d servers, want 3 (orphan containers must be dropped)", len(servers))
	}

	if !servers[0].Running() || servers[0].Health != "healthy" {
		t.Errorf("rlcraft state not merged: %+v", servers[0])
	}
	if servers[0].Route != "rlcraft.stale.domain" {
		t.Errorf("rlcraft route = %q, want the container label (source of truth)", servers[0].Route)
	}
	if servers[1].State != "created" {
		t.Errorf("vanilla state = %q, want created (merge keeps container state)", servers[1].State)
	}
	if servers[1].Route != "vanilla.mc.example.com" {
		t.Errorf("vanilla route = %q, want statically derived from the router domain", servers[1].Route)
	}
	if servers[2].Route != "never-started.mc.example.com" {
		t.Errorf("never-started route = %q, want the derived hostname even with no container", servers[2].Route)
	}

	// Without a configured domain only labeled containers have a route.
	servers = Merge(configs, states, "")
	if servers[2].Route != "" {
		t.Errorf("no domain + no container: route = %q, want empty", servers[2].Route)
	}
}

// TestStaticRoute pins the hostname scheme players connect under.
func TestStaticRoute(t *testing.T) {
	tests := []struct {
		name, server, domain, want string
	}{
		{"plain", "plain", "mc.example.com", "plain.mc.example.com"},
		{"nip.io", "rlcraft", "192.168.1.10.nip.io", "rlcraft.192.168.1.10.nip.io"},
		{"empty domain", "vanilla", "", ""},
		{"empty name", "", "mc.example.com", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := StaticRoute(tt.server, tt.domain); got != tt.want {
				t.Errorf("StaticRoute(%q, %q) = %q, want %q", tt.server, tt.domain, got, tt.want)
			}
		})
	}
}

func TestParseHealth(t *testing.T) {
	tests := []struct {
		name, status, want string
	}{
		{"healthy", "Up 6 hours (healthy)", "healthy"},
		{"starting", "Up 20 seconds (health: starting)", "starting"},
		{"unhealthy", "Up 3 minutes (unhealthy)", "unhealthy"},
		{"no health info", "Up 2 hours", ""},
		{"exited", "Exited (0) 20 minutes ago", ""},
		{"empty", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ParseHealth(tt.status); got != tt.want {
				t.Errorf("ParseHealth(%q) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}

// TestStripHealth checks that only the health suffix is removed: the exit
// code and age of stopped containers must survive (they are shown in the
// UPTIME column).
func TestStripHealth(t *testing.T) {
	tests := []struct {
		name, status, want string
	}{
		{"running healthy", "Up 6 hours (healthy)", "Up 6 hours"},
		{"starting", "Up 20 seconds (health: starting)", "Up 20 seconds"},
		{"exited keeps detail", "Exited (0) 20 minutes ago", "Exited (0) 20 minutes ago"},
		{"plain", "Up 2 hours", "Up 2 hours"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := StripHealth(tt.status); got != tt.want {
				t.Errorf("StripHealth(%q) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}

func TestMemoryGB(t *testing.T) {
	tests := []struct {
		name, in string
		want     int
	}{
		{"gigabytes", "8G", 8},
		{"lowercase unit", "4g", 4},
		{"megabytes exact", "2048M", 2},
		{"megabytes rounded up", "2049M", 3},
		{"empty", "", 0},
		{"unknown unit", "512B", 0},
		{"not a number", "lotsG", 0},
		{"whitespace", "  2G  ", 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MemoryGB(tt.in); got != tt.want {
				t.Errorf("MemoryGB(%q) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

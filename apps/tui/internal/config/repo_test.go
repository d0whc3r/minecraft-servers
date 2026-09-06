package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestLoadRealRepoConfigs validates the loader against the repository's real
// configuration (the same files production runs on). It pins the invariants
// the TUI relies on — unique names, sorted output, MC version present — so a
// formatting change in the real .env files is caught here, not at runtime.
// Skips when the repository root is not reachable (standalone module).
func TestLoadRealRepoConfigs(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	if _, err := os.Stat(filepath.Join(root, "config", "modpacks")); err != nil {
		t.Skipf("repository root not found from %s: %v", root, err)
	}

	configs, err := Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(configs) < 15 {
		t.Fatalf("got %d configs, want the full configured set (15+)", len(configs))
	}

	seen := map[string]bool{}
	for i, cfg := range configs {
		if seen[cfg.Name] {
			t.Errorf("duplicate config name %q", cfg.Name)
		}
		seen[cfg.Name] = true
		if i > 0 && configs[i-1].Name >= cfg.Name {
			t.Errorf("configs not sorted: %q before %q", configs[i-1].Name, cfg.Name)
		}
		if cfg.Version == "" {
			t.Errorf("%s has no VERSION (the VER column would be empty)", cfg.Name)
		}
	}

	for _, required := range []string{"vanilla", "rlcraft"} {
		if !seen[required] {
			t.Errorf("required server %q missing from config/modpacks", required)
		}
	}
}

// TestRouterDomainFromRealEnv checks the repository's real .env (when
// present): the wildcard domain players connect under must be discovered,
// since absent servers get their route derived from it.
func TestRouterDomainFromRealEnv(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	if _, err := os.Stat(filepath.Join(root, ".env")); err != nil {
		t.Skipf("repository root not found from %s", root)
	}

	domain := RouterDomain(root)
	if domain == "" {
		t.Fatal("MC_ROUTER_DOMAIN missing from the repository .env")
	}
	if strings.Contains(domain, `"`) {
		t.Errorf("domain = %q, quotes should have been stripped", domain)
	}
}

// TestRouterDomainFromFixture pins the .env parsing behaviour for the router
// domain: quoted values, and an empty result without an .env.
func TestRouterDomainFromFixture(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env"),
		[]byte("# comment\nMC_ROUTER_DOMAIN=\"mc.example.com\"\nOTHER=x\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := RouterDomain(root); got != "mc.example.com" {
		t.Errorf("RouterDomain = %q, want mc.example.com", got)
	}

	if got := RouterDomain(t.TempDir()); got != "" {
		t.Errorf("missing .env should yield empty domain, got %q", got)
	}
}

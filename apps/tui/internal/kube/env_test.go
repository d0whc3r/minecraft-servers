package kube

import (
	"os"
	"path/filepath"
	"testing"
)

// writeEnvFile drops one KEY=VALUE file (comments included, parser ignores
// them).
func writeEnvFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

// TestServerNamesAndMerge proves the TUI reads the same env sources as the
// panel: shared .env overlaid by the per-server file, panel-created servers
// overriding the baked-in catalog, MC_ROUTER_DOMAIN as the route suffix.
func TestServerNamesAndMerge(t *testing.T) {
	root := t.TempDir()
	writeEnvFile(t, filepath.Join(root, ".env"),
		"# shared settings\nMC_ROUTER_DOMAIN=test.local\nCF_API_KEY=shared-key\n")
	writeEnvFile(t, filepath.Join(root, "config", "modpacks", "vanilla.env"),
		"# the catalog entry\nTYPE=PAPER\nVERSION=1.21\n")
	writeEnvFile(t, filepath.Join(root, "config", "modpacks", "dawncraft.env"),
		"TYPE=AUTO_CURSEFORGE\n")
	// A server created from the panel lives under the data dir.
	t.Setenv("MCPANEL_DATA_DIR", filepath.Join(root, "data"))
	writeEnvFile(t, filepath.Join(root, "data", "servers", "mypack.env"),
		"TYPE=PAPER\n")

	names, err := ServerNames(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(names) != 3 || names[0] != "dawncraft" || names[1] != "mypack" || names[2] != "vanilla" {
		t.Errorf("ServerNames = %v, want catalog + panel-created sorted", names)
	}

	// Panel dir wins over the catalog for the same name.
	writeEnvFile(t, filepath.Join(root, "data", "servers", "vanilla.env"),
		"TYPE=PAPER\nVERSION=1.21.9\n")
	env, err := MergedEnv(root, "vanilla")
	if err != nil {
		t.Fatal(err)
	}
	if env["VERSION"] != "1.21.9" {
		t.Errorf("panel-created override ignored: VERSION = %q", env["VERSION"])
	}
	if env["CF_API_KEY"] != "shared-key" {
		t.Errorf("shared .env must merge in: CF_API_KEY = %q", env["CF_API_KEY"])
	}

	cfg, err := ServerConfig(root, "vanilla")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Name != "vanilla" || cfg.Type != "PAPER" || cfg.Version != "1.21.9" {
		t.Errorf("ServerConfig = %+v", cfg)
	}

	if got := RouterDomain(root); got != "test.local" {
		t.Errorf("RouterDomain = %q, want test.local", got)
	}
}

// TestRouterDomainFallback mirrors the panel's default domain.
func TestRouterDomainFallback(t *testing.T) {
	root := t.TempDir()
	if got := RouterDomain(root); got != "mc.local" {
		t.Errorf("RouterDomain without .env = %q, want mc.local", got)
	}
}

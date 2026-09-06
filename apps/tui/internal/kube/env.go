// Server discovery and env merging, mirroring the panel's registry
// (apps/web/src/lib/servers.ts): the shared .env overlaid by each server's
// env file, and panel-created servers (under the data dir) overriding the
// baked-in catalog. This is what makes the TUI see the same configuration
// source the panel and the cluster see.
package kube

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/config"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// panelServersDir mirrors servers.ts panelServersDir(): servers created from
// the panel live under the data dir (a PVC in kubernetes) and win over the
// read-only catalog.
func panelServersDir(root string) string {
	if data := os.Getenv("MCPANEL_DATA_DIR"); data != "" {
		return filepath.Join(data, "servers")
	}
	return filepath.Join(root, "apps", "web", "data", "servers")
}

func catalogDir(root string) string {
	return filepath.Join(root, "config", "modpacks")
}

// ServerNames lists every configured server: the baked-in catalog plus
// panel-created servers, deduplicated (panel dir wins), sorted by name.
func ServerNames(root string) ([]string, error) {
	names, err := envBaseNames(catalogDir(root))
	if err != nil {
		return nil, err
	}
	// The panel dir is optional (nothing created from the panel yet).
	custom, _ := envBaseNames(panelServersDir(root))
	names = append(names, custom...)
	slices.Sort(names)
	return slices.Compact(names), nil
}

func envBaseNames(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("cannot read config dir %s: %w", dir, err)
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".env") {
			continue
		}
		if name := strings.TrimSuffix(entry.Name(), ".env"); name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}

// MergedEnv builds one server's effective environment: the shared .env
// overlaid by the per-server file, the same merge order the panel applies
// before rendering chart values. A panel-created copy of the config wins over
// the baked-in catalog entry (servers.ts serverEnvPath).
func MergedEnv(root, server string) (map[string]string, error) {
	shared, err := config.ParseEnvFile(filepath.Join(root, ".env"))
	if err != nil {
		// No shared .env: the catalog file alone still defines the server.
		shared = map[string]string{}
	}
	path := filepath.Join(panelServersDir(root), server+".env")
	if _, err := os.Stat(path); err != nil {
		path = filepath.Join(catalogDir(root), server+".env")
	}
	serverEnv, err := config.ParseEnvFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read config for %s: %w", server, err)
	}
	for key, value := range serverEnv {
		shared[key] = value
	}
	return shared, nil
}

// ServerConfig builds the dashboard row for one server from its merged env.
func ServerConfig(root, server string) (domain.ServerConfig, error) {
	env, err := MergedEnv(root, server)
	if err != nil {
		return domain.ServerConfig{}, err
	}
	return domain.ServerConfig{
		Name:       server,
		Type:       env["TYPE"],
		Version:    env["VERSION"],
		Memory:     env["MEMORY"],
		RconPort:   env["RCON_PORT"],
		RconEnable: strings.EqualFold(env["ENABLE_RCON"], "true"),
	}, nil
}

// Catalog loads every server's config, sorted by name (config.Load's k8s
// counterpart, including panel-created servers).
func Catalog(root string) ([]domain.ServerConfig, error) {
	names, err := ServerNames(root)
	if err != nil {
		return nil, err
	}
	configs := make([]domain.ServerConfig, 0, len(names))
	for _, name := range names {
		cfg, err := ServerConfig(root, name)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}

// RouterDomain reads MC_ROUTER_DOMAIN from the shared .env — the wildcard
// domain the player routes live under — falling back to the panel's default.
func RouterDomain(root string) string {
	kv, err := config.ParseEnvFile(filepath.Join(root, ".env"))
	if err != nil || kv["MC_ROUTER_DOMAIN"] == "" {
		return "mc.local"
	}
	return kv["MC_ROUTER_DOMAIN"]
}

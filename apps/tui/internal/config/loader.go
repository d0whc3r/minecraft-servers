// Package config reads the per-server definitions from config/modpacks/*.env.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// Load reads every config/modpacks/<name>.env under root, sorted by name.
func Load(root string) ([]domain.ServerConfig, error) {
	dir := filepath.Join(root, "config", "modpacks")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("cannot read config dir %s: %w", dir, err)
	}

	var configs []domain.ServerConfig
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".env") {
			continue
		}
		name := strings.TrimSuffix(entry.Name(), ".env")
		if name == "" { // a literal ".env" is not a server
			continue
		}
		kv, err := parseEnvFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, err
		}
		configs = append(configs, domain.ServerConfig{
			Name:       name,
			Type:       kv["TYPE"],
			Version:    kv["VERSION"],
			Memory:     kv["MEMORY"],
			RconPort:   kv["RCON_PORT"],
			RconEnable: strings.EqualFold(kv["ENABLE_RCON"], "true"),
		})
	}
	slices.SortFunc(configs, func(a, b domain.ServerConfig) int {
		return strings.Compare(a.Name, b.Name)
	})
	return configs, nil
}

// parseEnvFile extracts KEY=VALUE pairs, trimming surrounding spaces and a
// single layer of quotes. Lines starting with # and lines without = are
// ignored; everything after the first = is the value (MOTDs may contain #).
func parseEnvFile(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read config %s: %w", path, err)
	}
	kv := make(map[string]string)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		kv[strings.TrimSpace(key)] = trimQuotes(strings.TrimSpace(value))
	}
	return kv, nil
}

func trimQuotes(s string) string {
	for _, q := range []string{`"`, `'`} {
		if len(s) >= 2 && strings.HasPrefix(s, q) && strings.HasSuffix(s, q) {
			return s[1 : len(s)-1]
		}
	}
	return s
}

// RouterDomain reads MC_ROUTER_DOMAIN from the repository's .env — the
// wildcard domain players' hostnames live under. Returns "" when unset or
// when there is no .env (the dashboard then shows routes only for containers
// that carry the mc-router label).
func RouterDomain(root string) string {
	kv, err := parseEnvFile(filepath.Join(root, ".env"))
	if err != nil {
		return ""
	}
	return kv["MC_ROUTER_DOMAIN"]
}

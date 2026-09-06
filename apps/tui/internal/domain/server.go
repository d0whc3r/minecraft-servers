// Package domain holds the core concepts of the server manager — servers,
// their configuration and runtime state, and the management actions — free of
// dependencies on docker, the filesystem or the terminal UI.
package domain

import (
	"regexp"
	"strconv"
	"strings"
)

// ServerConfig is the static definition parsed from config/modpacks/<name>.env.
type ServerConfig struct {
	Name       string // directory/file name, e.g. "all-the-mods-10"
	Type       string // TYPE, e.g. PAPER, AUTO_CURSEFORGE
	Version    string // Minecraft VERSION
	Memory     string // MEMORY, e.g. 8G
	RconPort   string // RCON_PORT (loopback-only host port)
	RconEnable bool   // ENABLE_RCON=true
}

// ContainerState is the runtime state of a server's container, if any.
type ContainerState struct {
	State  string // running, exited, created, paused, restarting
	Health string // healthy, unhealthy, starting ("" when no healthcheck info)
	Status string // raw human status, e.g. "Up 6 hours (healthy)"
	Route  string // mc-router.host label stamped on the container ("" if none)
}

// Server is one row of the dashboard: config enriched with runtime state.
// Route is the player-facing address — <name>.<MC_ROUTER_DOMAIN> — taken from
// the container's mc-router label when the container exists, or derived
// statically from the domain when it does not. Game ports do not exist in
// this architecture: players only reach servers through mc-router.
type Server struct {
	ServerConfig
	ContainerState
	Route string
}

// Running reports whether the server counts as up.
func (s Server) Running() bool {
	return s.State == "running" || s.State == "restarting"
}

// Exists reports whether a container exists at all.
func (s Server) Exists() bool {
	return s.State != ""
}

// StateLabel is the display name for the container state.
func (s Server) StateLabel() string {
	if s.State == "" {
		return "absent"
	}
	return s.State
}

// MatchesStatePrefix reports whether the display state label (running,
// exited, …, "absent" for a server with no container) starts with prefix.
func (s Server) MatchesStatePrefix(prefix string) bool {
	return strings.HasPrefix(s.StateLabel(), prefix)
}

// Merge overlays container states onto the config rows and resolves each
// server's route. Config files are the source of truth for what exists; the
// container's mc-router label is the source of truth for where it is routed.
// A server without a container gets its route derived from the configured
// router domain so the dashboard can always show where players would connect.
func Merge(configs []ServerConfig, states map[string]ContainerState, routerDomain string) []Server {
	out := make([]Server, 0, len(configs))
	for _, cfg := range configs {
		state := states[cfg.Name]
		route := state.Route
		if route == "" && routerDomain != "" {
			route = StaticRoute(cfg.Name, routerDomain)
		}
		out = append(out, Server{
			ServerConfig:   cfg,
			ContainerState: state,
			Route:          route,
		})
	}
	return out
}

// StaticRoute derives the mc-router hostname for a server name.
func StaticRoute(name, routerDomain string) string {
	if name == "" || routerDomain == "" {
		return ""
	}
	return name + "." + routerDomain
}

var healthRe = regexp.MustCompile(`\((?:health: )?(healthy|unhealthy|starting)\)`)

// ParseHealth extracts the health substring from a docker status string.
func ParseHealth(status string) string {
	if m := healthRe.FindStringSubmatch(status); m != nil {
		return m[1]
	}
	return ""
}

// StripHealth removes a trailing "(healthy)"-style suffix but keeps the rest
// of the status (exit code and age for stopped containers).
func StripHealth(status string) string {
	if loc := healthRe.FindStringIndex(status); loc != nil {
		return strings.TrimSpace(status[:loc[0]])
	}
	return status
}

// MemoryGB parses values like "8G", "512M", "2g" into whole GB (rounded up).
func MemoryGB(mem string) int {
	mem = strings.TrimSpace(strings.ToUpper(mem))
	if mem == "" {
		return 0
	}
	num, unit := mem[:len(mem)-1], mem[len(mem)-1:]
	value, err := strconv.Atoi(num)
	if err != nil {
		return 0
	}
	switch unit {
	case "G":
		return value
	case "M":
		if value%1024 == 0 {
			return value / 1024
		}
		return value/1024 + 1
	default:
		return 0
	}
}

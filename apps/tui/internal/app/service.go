// Package app wires the infrastructure adapters into the handful of
// operations the UI needs. It is the only layer the UI talks to.
package app

import (
	"context"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/backups"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/config"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/scripts"
)

// Service is the application facade over the repository root.
type Service struct {
	Root string
}

// New builds a service bound to the repository at root.
func New(root string) Service {
	return Service{Root: root}
}

// Snapshot returns every configured server with its current container state
// and player-facing route merged in.
func (s Service) Snapshot() ([]domain.Server, error) {
	configs, err := config.Load(s.Root)
	if err != nil {
		return nil, err
	}
	states, err := docker.States()
	if err != nil {
		return nil, err
	}
	return domain.Merge(configs, states, config.RouterDomain(s.Root)), nil
}

// RunAction executes a management script for an action on a server ("" for
// global actions) with the action's own timeout.
func (s Service) RunAction(action domain.Action, server string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), action.Timeout())
	defer cancel()
	return scripts.Run(ctx, s.Root, action, server)
}

// FollowLogs streams `docker logs --follow` lines into ch until ctx is
// cancelled; ch is closed when the stream ends.
func (s Service) FollowLogs(ctx context.Context, server string, ch chan<- docker.LogLine) {
	docker.FollowLogs(ctx, server, ch)
}

// Rcon sends one command to a server's RCON console.
func (s Service) Rcon(ctx context.Context, server, command string) (string, error) {
	return docker.Rcon(ctx, server, command)
}

// Players fetches the raw `rcon-cli list` output.
func (s Service) Players(ctx context.Context, server string) (string, error) {
	return docker.Players(ctx, server)
}

// LatestBackup returns the newest backup for a server; ok is false when the
// server has none yet.
func (s Service) LatestBackup(server string) (backups.Backup, bool) {
	b, err := backups.Latest(s.Root, server)
	if err != nil || b == nil {
		return backups.Backup{}, false
	}
	return *b, true
}

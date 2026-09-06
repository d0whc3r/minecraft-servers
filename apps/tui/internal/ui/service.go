package ui

import (
	"context"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/app"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/backups"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// Service is everything the UI needs from the application layer. Declaring
// the interface here (where it is consumed) keeps the UI testable with a
// fake: no docker, no scripts, no filesystem.
type Service interface {
	Snapshot() ([]domain.Server, error)
	RunAction(action domain.Action, server string) (string, error)
	FollowLogs(ctx context.Context, server string, ch chan<- docker.LogLine)
	Rcon(ctx context.Context, server, command string) (string, error)
	Players(ctx context.Context, server string) (string, error)
	LatestBackup(server string) (backups.Backup, bool)
}

// The concrete application services must keep satisfying the interface:
// the docker/scripts one and the kubernetes one (MCPANEL_RUNTIME).
var _ Service = app.Service{}
var _ Service = app.KubeService{}

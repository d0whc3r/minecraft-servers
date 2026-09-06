// The kubernetes-runtime facade: the same handful of operations the UI knows,
// backed by helm/kubectl (internal/kube) instead of the repo's bash scripts
// and the docker CLI (internal/scripts + internal/docker). Selected by
// MCPANEL_RUNTIME=kubernetes — the switch the panel itself uses — so inside
// the panel container both UIs act on the same releases, the same
// /repo/.env + config/modpacks sources, and the same RBAC.
package app

import (
	"context"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/backups"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/kube"
)

// KubeService is the application facade for the kubernetes runtime.
type KubeService struct {
	Root string
}

// NewKube builds a kubernetes-runtime service bound to the repo layout at
// root (inside the panel container that is /repo).
func NewKube(root string) KubeService {
	return KubeService{Root: root}
}

// Snapshot returns every configured server (catalog + panel-created) with
// its deployment state and player-facing route merged in.
func (s KubeService) Snapshot() ([]domain.Server, error) {
	configs, err := kube.Catalog(s.Root)
	if err != nil {
		return nil, err
	}
	states, err := kube.States()
	if err != nil {
		return nil, err
	}
	return domain.Merge(configs, states, kube.RouterDomain(s.Root)), nil
}

// RunAction executes a management action as helm/kubectl with the action's
// own timeout ceiling.
func (s KubeService) RunAction(action domain.Action, server string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), action.Timeout())
	defer cancel()
	return kube.Run(ctx, s.Root, action, server)
}

// FollowLogs streams `kubectl logs --follow` lines into ch until ctx is
// cancelled; ch is closed when the stream ends.
func (s KubeService) FollowLogs(ctx context.Context, server string, ch chan<- docker.LogLine) {
	kube.FollowLogs(ctx, server, ch)
}

// Rcon sends one command to a server's RCON console (kubectl exec rcon-cli).
func (s KubeService) Rcon(ctx context.Context, server, command string) (string, error) {
	return kube.Rcon(ctx, server, command)
}

// Players fetches the raw `rcon-cli list` output.
func (s KubeService) Players(ctx context.Context, server string) (string, error) {
	return kube.Players(ctx, server)
}

// LatestBackup reports the newest archive in the server's backups claim.
func (s KubeService) LatestBackup(server string) (backups.Backup, bool) {
	return kube.LatestBackup(context.Background(), server)
}

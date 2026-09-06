package ui

import (
	"context"
	"strings"
	"sync"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/backups"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// fakeService records every call the UI makes, so tests can assert on the
// *effects* of key presses instead of implementation details. Nothing here
// touches docker, bash or the filesystem.
type fakeService struct {
	mu sync.Mutex

	servers     []domain.Server
	snapshotErr error

	// RunAction recording
	ranActions []domain.Action
	ranServers []string
	runErr     map[string]error // "action/server" -> error to return
	runOutput  string

	playersOut string // raw rcon list output
	rconOut    string
	rconErr    error

	hasBackup bool
}

func newFakeService(servers []domain.Server, runErr map[string]error) *fakeService {
	return &fakeService{servers: servers, runErr: runErr, playersOut: "There are 0 of a max of 20 players online:"}
}

func (f *fakeService) Snapshot() ([]domain.Server, error) {
	return f.servers, f.snapshotErr
}

func (f *fakeService) RunAction(action domain.Action, server string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ranActions = append(f.ranActions, action)
	f.ranServers = append(f.ranServers, server)
	if f.runErr != nil {
		if err, ok := f.runErr[string(action)+"/"+server]; ok {
			return "boom", err
		}
	}
	return f.runOutput, nil
}

func (f *fakeService) FollowLogs(ctx context.Context, server string, ch chan<- docker.LogLine) {
	<-ctx.Done()
	close(ch)
}

func (f *fakeService) Rcon(ctx context.Context, server, command string) (string, error) {
	return f.rconOut, f.rconErr
}

func (f *fakeService) Players(ctx context.Context, server string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.playersOut = strings.TrimSpace(f.playersOut)
	return f.playersOut, nil
}

func (f *fakeService) LatestBackup(server string) (backups.Backup, bool) {
	if !f.hasBackup {
		return backups.Backup{}, false
	}
	return backups.Backup{Name: server + "-20260906-030000.tar.gz"}, true
}

// ranWith reports whether action/server was executed via RunAction.
func (f *fakeService) ranWith(action domain.Action, server string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i, a := range f.ranActions {
		if a == action && f.ranServers[i] == server {
			return true
		}
	}
	return false
}

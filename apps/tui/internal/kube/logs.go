// Log streaming: `kubectl logs --follow` for the server's minecraft
// container, the k8s counterpart of docker.FollowLogs.
package kube

import (
	"bufio"
	"context"
	"errors"
	"io"
	"os/exec"
	"sync"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
)

// FollowLogs attaches `kubectl logs --tail 400 --follow` to the server
// deployment and pushes each line into ch until ctx is cancelled or kubectl
// detaches; ch is closed when the pump ends.
func FollowLogs(ctx context.Context, server string, ch chan<- docker.LogLine) {
	defer close(ch)

	cmd := exec.CommandContext(ctx, "kubectl", "logs",
		"deployment/"+ReleaseName(server),
		"--container", "minecraft",
		"--namespace", Namespace(),
		"--tail", "400",
		"--follow")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		ch <- docker.LogLine{Err: err}
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		ch <- docker.LogLine{Err: err}
		return
	}
	if err := cmd.Start(); err != nil {
		ch <- docker.LogLine{Err: err}
		return
	}

	var wg sync.WaitGroup
	pump := func(r io.Reader) {
		defer wg.Done()
		sc := bufio.NewScanner(r)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			select {
			case ch <- docker.LogLine{Text: sc.Text()}:
			case <-ctx.Done():
				return
			}
		}
	}
	wg.Add(2)
	go pump(stdout)
	go pump(stderr)
	wg.Wait()

	if waitErr := cmd.Wait(); ctx.Err() == nil && waitErr != nil && !errors.Is(waitErr, context.Canceled) {
		ch <- docker.LogLine{Err: waitErr}
	}
}

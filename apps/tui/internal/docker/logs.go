package docker

import (
	"bufio"
	"context"
	"errors"
	"io"
	"os/exec"
	"sync"
)

// LogLine is one line of `docker logs --follow` output; Err carries pump
// failures (the stream stays open afterwards when possible).
type LogLine struct {
	Text string
	Err  error
}

// FollowLogs attaches `docker logs --tail 400 --follow` for a server and
// pushes each line into ch until ctx is cancelled or docker detaches; ch is
// closed when the pump ends.
func FollowLogs(ctx context.Context, server string, ch chan<- LogLine) {
	defer close(ch)

	cmd := exec.CommandContext(ctx, "docker", "logs", "--tail", "400", "--follow", ContainerName(server))
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		ch <- LogLine{Err: err}
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		ch <- LogLine{Err: err}
		return
	}
	if err := cmd.Start(); err != nil {
		ch <- LogLine{Err: err}
		return
	}

	var wg sync.WaitGroup
	pump := func(r io.Reader) {
		defer wg.Done()
		sc := bufio.NewScanner(r)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			select {
			case ch <- LogLine{Text: sc.Text()}:
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
		ch <- LogLine{Err: waitErr}
	}
}

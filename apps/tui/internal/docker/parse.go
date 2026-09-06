package docker

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

var containerNameRe = regexp.MustCompile(`^mc-([a-z0-9-]+)$`)

// serverFromContainer extracts the server name from a container name; ok is
// false for containers outside this project's mc-<server> scheme.
func serverFromContainer(container string) (string, bool) {
	m := containerNameRe.FindStringSubmatch(container)
	if m == nil {
		return "", false
	}
	return m[1], true
}

func wrapCmdErr(what string, err error) error {
	if exitErr, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("%s failed: %v: %s", what, exitErr, strings.TrimSpace(string(exitErr.Stderr)))
	}
	return fmt.Errorf("%s: %w", what, err)
}

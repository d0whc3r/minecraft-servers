// Command mc-tui is a terminal UI for managing the Minecraft servers in this
// repository: start, stop, restart, back up, follow logs, and open an RCON
// console — wrapping the management scripts instead of duplicating them.
//
// Layout: main.go only bootstraps; the layers live under internal/
// (domain ← config/docker/scripts/backups ← app ← ui).
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/app"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/ui"
)

func main() {
	rootFlag := flag.String("root", "", "project root (default: auto-detect)")
	dump := flag.String("dump", "", "print server state as `table|json` and exit (no TTY)")
	flag.Parse()

	root, err := findRoot(*rootFlag)
	if err != nil {
		fatal(err)
	}

	svc := app.New(root)

	if *dump != "" {
		runDump(svc, *dump)
		return
	}

	if _, err := os.Stdout.Stat(); err != nil {
		fatal(errors.Join(errors.New("no stdout available"), err))
	}

	p := tea.NewProgram(ui.New(svc), tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		fatal(fmt.Errorf("tui: %w", err))
	}
}

func runDump(svc app.Service, format string) {
	servers, err := svc.Snapshot()
	if err != nil {
		fatal(err)
	}
	if format == "json" {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(servers); err != nil {
			fatal(err)
		}
		return
	}
	if format != "table" {
		fatal(errors.New("unknown --dump format: " + format + " (use table|json)"))
	}
	for _, s := range servers {
		state := s.StateLabel()
		if s.Health != "" {
			state += "/" + s.Health
		}
		fmt.Printf("%-28s %-20s %-32s %-6s %-7s %s\n",
			s.Name, state, orDash(s.Route), orDash(s.Memory), orDash(s.Version), orDash(s.Status))
	}
}

func orDash(s string) string {
	if s == "" {
		return "—"
	}
	return s
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

// findRoot locates the repository root: -root flag, then the working
// directory, then walking up from the executable's directory (so the built
// binary works from anywhere). The marker is scripts/common.sh, which every
// management script requires.
func findRoot(flagRoot string) (string, error) {
	if flagRoot != "" {
		abs, err := filepath.Abs(flagRoot)
		if err != nil {
			return "", err
		}
		if !isProjectRoot(abs) {
			return "", fmt.Errorf("not a minecraft-servers project root: %s", abs)
		}
		return abs, nil
	}
	if wd, err := os.Getwd(); err == nil && isProjectRoot(wd) {
		return wd, nil
	}
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for range 6 {
			if isProjectRoot(dir) {
				return dir, nil
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	return "", errors.New("project root not found (run from the repository or pass -root)")
}

func isProjectRoot(dir string) bool {
	st, err := os.Stat(filepath.Join(dir, "scripts", "common.sh"))
	return err == nil && !st.IsDir()
}

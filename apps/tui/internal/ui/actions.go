package ui

import (
	"context"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/docker"
	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// dockerLogLine aliases the adapter type so the model can hold a channel of
// log lines without importing docker anywhere else.
type dockerLogLine = docker.LogLine

// Messages --------------------------------------------------------------------

type actionDoneMsg struct {
	action domain.Action
	server string // "" for global actions
	err    error
	output string
}

type serversMsg struct {
	servers []domain.Server
	err     error
}

type tickMsg struct{}

type rconDoneMsg struct {
	server  string
	command string
	output  string
	err     error
}

type playersMsg struct {
	server string
	output string
	err    error
}

type logLineMsg struct{ line dockerLogLine }
type logStartedMsg struct{ server string }
type logClosedMsg struct{}

// Commands --------------------------------------------------------------------

func refreshCmd(svc Service) tea.Cmd {
	return func() tea.Msg {
		servers, err := svc.Snapshot()
		return serversMsg{servers: servers, err: err}
	}
}

func tickCmd() tea.Cmd {
	return tea.Tick(5*time.Second, func(time.Time) tea.Msg { return tickMsg{} })
}

// runActionCmd runs a management script asynchronously and reports the result
// through actionDoneMsg.
func runActionCmd(svc Service, action domain.Action, server string) tea.Cmd {
	return func() tea.Msg {
		output, err := svc.RunAction(action, server)
		return actionDoneMsg{action: action, server: server, err: err, output: output}
	}
}

func rconCmd(svc Service, server, command string) tea.Cmd {
	return func() tea.Msg {
		output, err := svc.Rcon(context.Background(), server, command)
		return rconDoneMsg{server: server, command: command, output: output, err: err}
	}
}

func playersCmd(svc Service, server string) tea.Cmd {
	return func() tea.Msg {
		output, err := svc.Players(context.Background(), server)
		return playersMsg{server: server, output: output, err: err}
	}
}

// waitLogLineCmd blocks until the next log line (or channel close) is ready;
// the model re-arms it after every logLineMsg it processes.
func waitLogLineCmd(ch chan dockerLogLine) tea.Cmd {
	return func() tea.Msg {
		line, ok := <-ch
		if !ok {
			return logClosedMsg{}
		}
		return logLineMsg{line: line}
	}
}

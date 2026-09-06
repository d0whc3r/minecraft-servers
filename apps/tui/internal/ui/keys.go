package ui

import (
	"fmt"
	"strings"
	"time"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// Keys -----------------------------------------------------------------------

func (m Model) handleKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	if msg.String() == "ctrl+c" {
		return m.confirmQuitOr()
	}

	if m.confirm != nil {
		return m.handleConfirmKey(msg)
	}

	switch m.mode {
	case viewLogs:
		return m.handleLogsKey(msg)
	case viewConsole:
		return m.handleConsoleKey(msg)
	case viewHelp:
		m.mode = viewTable
		return m, nil
	case viewOutput:
		m.mode = viewTable
		return m, nil
	}
	return m.handleTableKey(msg)
}

// confirmQuitOr asks for confirmation when script actions are still running;
// otherwise it quits immediately.
func (m Model) confirmQuitOr() (tea.Model, tea.Cmd) {
	n := m.busyCount()
	if n == 0 {
		m.detachLogs()
		return m, tea.Quit
	}
	m.confirm = &confirmAction{
		question: fmt.Sprintf("%d script action(s) still running. Quit anyway?", n),
		impact:   "Actions already launched keep running outside the TUI.",
		quit:     true,
	}
	return m, nil
}

func (m Model) handleConfirmKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "y", "Y", "enter":
		c := *m.confirm
		m.confirm = nil
		if c.quit {
			m.detachLogs()
			return m, tea.Quit
		}
		return m, m.startAction(c.action, c.server)
	default: // n, esc, anything else cancels
		m.confirm = nil
		return m, nil
	}
}

func (m Model) handleTableKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	if m.filterOpen {
		return m.handleFilterKey(msg)
	}

	srv, ok := m.selected()

	switch msg.String() {
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
		m.ensureVisible()
	case "down", "j":
		m.cursor++
		m.clampCursor()
		m.ensureVisible()
	case "g", "home":
		m.cursor = 0
		m.ensureVisible()
	case "G", "end":
		// max guards the empty-filter case: -1 would panic the render loop.
		m.cursor = max(len(m.visible())-1, 0)
		m.ensureVisible()
	case "enter":
		// Contextual primary action: start a stopped server, follow the logs
		// of a running one.
		if !ok {
			break
		}
		if srv.Running() {
			return m, m.attachLogs(srv.Name)
		}
		if m.isBusy(srv.Name) {
			break
		}
		return m, m.startAction(domain.ActionStart, srv.Name)
	case "s":
		if !ok || m.isBusy(srv.Name) {
			break
		}
		if srv.Running() {
			m.setToast(srv.Name+" is already running", false)
			break
		}
		return m, m.startAction(domain.ActionStart, srv.Name)
	case "x":
		if !ok || !srv.Exists() || m.isBusy(srv.Name) {
			break
		}
		c := &confirmAction{action: domain.ActionStop, server: srv.Name,
			question: "Stop " + srv.Name + "?"}
		if n := m.playerCount(srv.Name); n > 0 {
			c.impact = fmt.Sprintf("⚠ %d player(s) online will be disconnected", n)
		}
		m.confirm = c
	case "r":
		if !ok || !srv.Running() || m.isBusy(srv.Name) {
			break
		}
		c := &confirmAction{action: domain.ActionRestart, server: srv.Name,
			question: "Restart " + srv.Name + "?"}
		if n := m.playerCount(srv.Name); n > 0 {
			c.impact = fmt.Sprintf("⚠ %d player(s) online will be kicked", n)
		}
		m.confirm = c
	case "b":
		if !ok || m.isBusy(srv.Name) {
			break
		}
		return m, m.startAction(domain.ActionBackup, srv.Name)
	case "l":
		if !ok || !srv.Running() {
			m.setToast("logs require a running server", true)
			break
		}
		return m, m.attachLogs(srv.Name)
	case "c":
		if !ok || !srv.Running() || !srv.RconEnable {
			m.setToast("RCON console requires a running server with RCON enabled", true)
			break
		}
		m.openConsole(srv.Name)
	case "p":
		if !ok || !srv.Running() || !srv.RconEnable {
			break
		}
		m.playersAt[srv.Name] = time.Now()
		return m, playersCmd(m.svc, srv.Name)
	case "S":
		m.confirm = &confirmAction{action: domain.ActionStartAll,
			question: m.startAllQuestion()}
	case "X":
		if m.countRunning() == 0 {
			m.setToast("no servers running", false)
			break
		}
		m.confirm = &confirmAction{action: domain.ActionStopAll,
			question: fmt.Sprintf("Stop all %d running servers?", m.countRunning())}
	case "/":
		m.filterOpen = true
		m.filter.Focus()
		return m, textinput.Blink
	case "f":
		m.cycleStateFilter()
	case "R":
		return m, refreshCmd(m.svc)
	case "o":
		if m.lastOut != "" {
			m.mode = viewOutput
		}
	case "?":
		m.mode = viewHelp
	case "q":
		return m.confirmQuitOr()
	case "esc":
		if strings.TrimSpace(m.filter.Value()) != "" {
			m.filter.SetValue("")
			m.clampCursor()
		}
	}
	return m, nil
}

func (m Model) handleFilterKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "enter":
		m.filterOpen = false
		m.filter.Blur()
	case "esc":
		m.filter.SetValue("")
		m.filterOpen = false
		m.filter.Blur()
		m.clampCursor()
	case "tab":
		m.completeStateToken(1)
	case "shift+tab":
		m.completeStateToken(-1)
	default:
		var cmd tea.Cmd
		m.filter, cmd = m.filter.Update(msg)
		m.clampCursor()
		return m, cmd
	}
	m.clampCursor()
	return m, nil
}

func (m Model) handleLogsKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc", "q":
		m.detachLogs()
		return m, nil
	case "f", "F":
		m.logFollow = !m.logFollow
		if m.logFollow {
			m.logVP.GotoBottom()
		}
		return m, nil
	case "g", "home":
		m.logVP.GotoTop()
		m.logFollow = false
		return m, nil
	case "G", "end":
		m.logVP.GotoBottom()
		m.logFollow = true
		return m, nil
	}
	var cmd tea.Cmd
	m.logVP, cmd = m.logVP.Update(msg)
	// Any scroll that leaves the bottom pauses follow; landing on it resumes.
	m.logFollow = m.logVP.AtBottom()
	return m, cmd
}

func (m Model) handleConsoleKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+l":
		m.conLines = nil
		return m, nil
	case "esc":
		if !m.conBusy {
			m.mode = viewTable
		}
		return m, nil
	case "up":
		if m.conPastIx > 0 {
			m.conPastIx--
			m.conInput.SetValue(m.conPast[m.conPastIx])
		}
		return m, nil
	case "down":
		if m.conPastIx < len(m.conPast)-1 {
			m.conPastIx++
			m.conInput.SetValue(m.conPast[m.conPastIx])
		} else {
			m.conPastIx = len(m.conPast)
			m.conInput.SetValue("")
		}
		return m, nil
	case "enter":
		command := strings.TrimSpace(m.conInput.Value())
		if command == "" || m.conBusy {
			return m, nil
		}
		m.conPast = append(m.conPast, command)
		m.conPastIx = len(m.conPast)
		m.appendCon(conEntry{input: command})
		m.conInput.SetValue("")
		m.conBusy = true
		return m, rconCmd(m.svc, m.conServer, command)
	}
	var cmd tea.Cmd
	m.conInput, cmd = m.conInput.Update(msg)
	return m, cmd
}

// Mouse: left click selects the row under the pointer, or toggles a state
// chip of the filter bar (table view only).
func (m Model) handleMouse(msg tea.MouseClickMsg) (tea.Model, tea.Cmd) {
	if m.mode != viewTable || m.confirm != nil || m.filterOpen {
		return m, nil
	}
	if msg.Button != tea.MouseLeft {
		return m, nil
	}
	if label, ok := m.filterChipAt(msg.X, msg.Y); ok {
		if strings.TrimSpace(m.filter.Value()) == "state:"+label {
			m.filter.SetValue("") // clicking the active chip clears it
		} else {
			m.filter.SetValue("state:" + label)
		}
		m.clampCursor()
		return m, nil
	}
	row := msg.Y - m.tableTop()
	if row < 0 || row >= len(m.visible()) {
		return m, nil
	}
	m.cursor = row
	m.ensureVisible()
	return m, nil
}

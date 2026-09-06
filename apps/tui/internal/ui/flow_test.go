package ui

import (
	"errors"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// TestPressingXRunsFullStopFlow walks the real interaction loop: x raises a
// confirm, y executes the stop, the completion message clears the busy state
// and produces a success toast. This is the end-to-end contract of the most
// destructive per-server key.
func TestPressingXRunsFullStopFlow(t *testing.T) {
	fake := newFakeService(sampleServers(), nil)
	m := resized(sampleModelWith(fake), 120, 30)

	// x on the selected running server raises a confirmation…
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("x")})
	m = next.(Model)
	if m.confirm == nil || m.confirm.action != domain.ActionStop {
		t.Fatalf("x should raise a stop confirmation, got %+v", m.confirm)
	}

	// …y executes it and marks the server busy…
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("y")})
	m = next.(Model)
	if !m.isBusy("rlcraft") {
		t.Fatal("stop should be running (busy) after confirm")
	}
	if fake.ranWith(domain.ActionStop, "rlcraft") {
		t.Fatal("script must not have finished yet: completion message not processed")
	}

	// …and the completion message clears the busy state with a success toast.
	next, _ = m.Update(actionDoneMsg{action: domain.ActionStop, server: "rlcraft"})
	m = next.(Model)
	if m.isBusy("rlcraft") {
		t.Error("busy flag must clear when the action completes")
	}
	if !strings.HasPrefix(m.toast, "✓ stop rlcraft") {
		t.Errorf("toast = %q, want success toast", m.toast)
	}
}

// TestFailedActionShowsErrorToastAndKeepsOutput checks that a failing script
// surfaces its output through the `o` popup and marks the toast as an error.
func TestFailedActionShowsErrorToastAndKeepsOutput(t *testing.T) {
	fake := newFakeService(sampleServers(), map[string]error{
		"start/vanilla": errors.New("exit status 1"),
	})
	m := resized(sampleModelWith(fake), 120, 30)
	m.cursor = 1 // vanilla (stopped)

	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("s")})
	m = next.(Model)
	if _, busy := m.busy["vanilla"]; !busy {
		t.Fatal("start should be busy")
	}

	// Drive the completion through the model with the failing result.
	next, _ = m.Update(actionDoneMsg{action: domain.ActionStart, server: "vanilla",
		err: errors.New("exit status 1"), output: "port conflict"})
	m = next.(Model)

	if !m.toastErr || !strings.HasPrefix(m.toast, "✗ start vanilla") {
		t.Errorf("toast = %q (err=%v), want error toast", m.toast, m.toastErr)
	}
	if m.lastOut != "port conflict" {
		t.Errorf("lastOut = %q, want captured script output", m.lastOut)
	}

	// `o` must now open the output popup showing the failure.
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("o")})
	m = next.(Model)
	if m.mode != viewOutput {
		t.Fatal("o should open the output popup after a failure")
	}
	if out := m.View(); !strings.Contains(out, "port conflict") {
		t.Error("output popup must show the captured script output")
	}
}

// TestLogStreamLifecycle covers attach → lines → error line → close, and the
// ring-buffer cap.
func TestLogStreamLifecycle(t *testing.T) {
	fake := newFakeService(sampleServers(), nil)
	m := resized(sampleModelWith(fake), 120, 30)
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("l")})
	m = next.(Model)

	if m.mode != viewLogs || m.logCh == nil {
		t.Fatal("l should attach the log stream")
	}

	for i := 0; i < 3; i++ {
		next, _ = m.Update(logLineMsg{line: dockerLine("line " + string(rune('a'+i)))})
		m = next.(Model)
	}
	if len(m.logLines) != 3 {
		t.Fatalf("logLines = %d, want 3", len(m.logLines))
	}

	// An error line marks the view but the stream stays open.
	next, _ = m.Update(logLineMsg{line: dockerLineErr(errors.New("boom"))})
	m = next.(Model)
	if !strings.Contains(m.logErr, "boom") {
		t.Errorf("logErr = %q, want the pump error", m.logErr)
	}

	// Ring buffer: oldest lines are dropped beyond the cap.
	for i := 0; i < maxLogLines+10; i++ {
		next, _ = m.Update(logLineMsg{line: dockerLine("x")})
		m = next.(Model)
	}
	if len(m.logLines) != maxLogLines {
		t.Errorf("logLines = %d, want capped at %d", len(m.logLines), maxLogLines)
	}

	// Cancelling the context (what esc/detach does) ends the pump: the fake
	// closes the channel and the model records the "stream ended" notice.
	m.logCancel()
	next, _ = m.Update(waitLogLineCmd(m.logCh)())
	m = next.(Model)
	if !strings.Contains(m.logErr, "log stream ended") {
		t.Errorf("logErr = %q, want close notice", m.logErr)
	}
	m.detachLogs()
}

// TestLogLineIgnoredWhenDetached guards the race where a log line arrives
// after the user left the logs view.
func TestLogLineIgnoredWhenDetached(t *testing.T) {
	m := resized(sampleModel(), 120, 30)
	m.mode = viewTable
	m.logCh = nil
	next, _ := m.Update(logLineMsg{line: dockerLine("late line")})
	m = next.(Model)
	if len(m.logLines) != 0 {
		t.Errorf("detached model must ignore log lines, got %d", len(m.logLines))
	}
}

// TestPlayerPollingThrottle pins the polling policy: only every 6th tick,
// only running+RCON servers, at most once per TTL.
func TestPlayerPollingThrottle(t *testing.T) {
	fake := newFakeService(sampleServers(), nil)
	m := resized(sampleModelWith(fake), 120, 30) // cursor on rlcraft: running + rcon

	// Ticks 1..5 must not poll.
	for i := 1; i <= 5; i++ {
		m.ticks = i
		if cmd := m.maybeFetchPlayers(); cmd != nil {
			t.Fatalf("tick %d must not poll", i)
		}
	}

	// Tick 6 polls; the returned command yields a playersMsg when run.
	m.ticks = 6
	cmd := m.maybeFetchPlayers()
	if cmd == nil {
		t.Fatal("tick 6 must poll the selected running server")
	}
	msg := cmd()
	pm, ok := msg.(playersMsg)
	if !ok || pm.server != "rlcraft" {
		t.Fatalf("poll msg = %+v, want playersMsg for rlcraft", msg)
	}
	next, _ := m.Update(pm)
	m = next.(Model)
	if m.players["rlcraft"] != fake.playersOut {
		t.Errorf("players cache not updated: %q", m.players["rlcraft"])
	}

	// The TTL prevents another poll right away, even on tick multiples.
	m.ticks = 12
	if cmd := m.maybeFetchPlayers(); cmd != nil {
		t.Error("poll must be throttled by the TTL")
	}
}

// TestPlayerPollingSkipsStoppedOrNoRconServers checks the eligibility rules.
func TestPlayerPollingSkipsStoppedOrNoRconServers(t *testing.T) {
	servers := sampleServers()
	fake := newFakeService(servers, nil)
	m := resized(sampleModelWith(fake), 120, 30)

	m.cursor = 1 // vanilla: exited
	m.ticks = 6
	if cmd := m.maybeFetchPlayers(); cmd != nil {
		t.Error("stopped servers must not be polled")
	}

	m.cursor = 2 // all-the-mods-10: absent
	m.ticks = 12
	if cmd := m.maybeFetchPlayers(); cmd != nil {
		t.Error("absent servers must not be polled")
	}
}

// TestSlashStateFilterFlow walks the real input path: / opens the prompt, the
// typed state query narrows the rendered table, enter keeps it active with the
// prompt closed and esc clears it.
func TestSlashStateFilterFlow(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("/")})
	m = next.(Model)
	if !m.filterOpen {
		t.Fatal("/ must open the filter prompt")
	}

	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("st:run")})
	m = next.(Model)
	if got := len(m.visible()); got != 1 || m.visible()[0].Name != "rlcraft" {
		t.Fatalf("typed query narrowed rows to %v, want [rlcraft]", names(m.visible()))
	}

	out := m.View()
	if !strings.Contains(out, "rlcraft") || strings.Contains(out, "vanilla") {
		t.Error("rendered table must only contain the running server")
	}
	if !strings.Contains(out, "/st:run") {
		t.Error("status line must show the active query")
	}

	// enter closes the prompt but keeps the query…
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = next.(Model)
	if m.filterOpen || len(m.visible()) != 1 {
		t.Fatalf("enter must close the prompt keeping %d rows", len(m.visible()))
	}

	// …and esc in the table view clears it.
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	m = next.(Model)
	if m.filter.Value() != "" || len(m.visible()) != 3 {
		t.Errorf("esc must clear the filter, got %q", m.filter.Value())
	}
}

func dockerLine(text string) dockerLogLine { return dockerLogLine{Text: text} }
func dockerLineErr(err error) dockerLogLine {
	return dockerLogLine{Err: err}
}

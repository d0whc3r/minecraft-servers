package ui

import (
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// TestEnterIsContextual checks the primary action: enter on a stopped server
// starts it, on a running one follows its logs.
func TestEnterIsContextual(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	// cursor on vanilla (exited) -> enter starts it
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown}) // cursor 0 -> 1
	m = next.(Model)
	if m.servers[m.cursor].Name != "vanilla" {
		t.Fatalf("cursor on %q, want vanilla", m.servers[m.cursor].Name)
	}
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = next.(Model)
	if ba, ok := m.busy["vanilla"]; !ok || ba.action != domain.ActionStart {
		t.Errorf("enter on stopped server should start it, busy=%+v", m.busy)
	}

	// cursor back on rlcraft (running) -> enter attaches logs
	m.cursor = 0
	m.mode = viewTable
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = next.(Model)
	if m.mode != viewLogs || m.logServer != "rlcraft" {
		t.Errorf("enter on running server should open logs, mode=%v server=%q", m.mode, m.logServer)
	}
	m.detachLogs()
}

// TestQuitGuardWhileBusy makes sure q waits for confirmation with actions running.
func TestQuitGuardWhileBusy(t *testing.T) {
	m := resized(sampleModel(), 120, 30)
	m.busy["vanilla"] = busyAction{action: domain.ActionStart, started: time.Now()}

	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m = next.(Model)
	if m.confirm == nil || !m.confirm.quit {
		t.Fatal("q with running actions must raise the quit guard")
	}

	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("n")})
	m = next.(Model)
	if m.confirm != nil {
		t.Error("n must cancel the quit guard")
	}
}

// TestStatusLineShowsBusyWithElapsed checks the ephemeral status feedback.
func TestStatusLineShowsBusyWithElapsed(t *testing.T) {
	m := resized(sampleModel(), 120, 30)
	m.busy["vanilla"] = busyAction{action: domain.ActionStart, started: time.Now().Add(-3 * time.Second)}
	status := m.statusView()
	if !strings.Contains(status, "start vanilla") || !strings.Contains(status, "3s") {
		t.Errorf("status line should show action + elapsed, got %q", status)
	}
}

// TestMouseClickSelectsRow maps a click on screen row Y to the table cursor.
func TestMouseClickSelectsRow(t *testing.T) {
	m := resized(sampleModel(), 120, 30)
	if m.tableTop() != 3 {
		t.Fatalf("tableTop = %d, want 3", m.tableTop())
	}
	next, _ := m.Update(tea.MouseMsg{
		Action: tea.MouseActionPress, Button: tea.MouseButtonLeft, X: 5, Y: 4,
	})
	m = next.(Model)
	if m.cursor != 1 {
		t.Errorf("click on Y=4 should select row 1, cursor=%d", m.cursor)
	}
}

// TestStartAllQuestionIncludesRAM verifies the destructive-action confirmation
// mentions the aggregate RAM footprint.
func TestStartAllQuestionIncludesRAM(t *testing.T) {
	m := sampleModel()
	q := m.startAllQuestion()
	if !strings.Contains(q, "2 stopped servers") || !strings.Contains(q, "~10G RAM") {
		t.Errorf("start-all question = %q, want counts and ~10G RAM", q)
	}
}

// TestFilterNarrowsRows checks the visible() filter used by the `/` key.
func TestFilterNarrowsRows(t *testing.T) {
	m := sampleModel()
	if got := len(m.visible()); got != 3 {
		t.Fatalf("unfiltered rows = %d, want 3", got)
	}
	m.filter.SetValue("van")
	if got := len(m.visible()); got != 1 || m.visible()[0].Name != "vanilla" {
		t.Errorf("filter 'van' -> %+v, want [vanilla]", m.visible())
	}
	m.filter.SetValue("no-match-xyz")
	if len(m.visible()) != 0 || m.cursor != 0 {
		t.Errorf("empty result should keep cursor clamped, cursor=%d", m.cursor)
	}
}

// TestStateTokenFilter checks the state:<prefix> grammar: aliases, prefix
// matching, negation, name+state tokens and case-insensitivity.
func TestStateTokenFilter(t *testing.T) {
	m := sampleModel()

	cases := []struct {
		query string
		want  []string
	}{
		{"state:run", []string{"rlcraft"}},
		{"st:run", []string{"rlcraft"}},
		{"is:run", []string{"rlcraft"}},
		{"STATE:RUN", []string{"rlcraft"}},            // token grammar is case-insensitive
		{"state:exited vanilla", []string{"vanilla"}}, // combined tokens AND together
		{"state:!run", []string{"vanilla", "all-the-mods-10"}},
		{"state:abs", []string{"all-the-mods-10"}},
		{"state:", []string{"rlcraft", "vanilla", "all-the-mods-10"}}, // bare prefix matches all
		{"state:zzz", nil},
		{"state:run vanilla", nil}, // no server is both running and named vanilla
	}
	for _, tc := range cases {
		m.filter.SetValue(tc.query)
		got := m.visible()
		if len(got) != len(tc.want) {
			t.Errorf("filter %q -> %v, want %v", tc.query, names(got), tc.want)
			continue
		}
		for i, want := range tc.want {
			if got[i].Name != want {
				t.Errorf("filter %q -> %v, want %v", tc.query, names(got), tc.want)
			}
		}
	}
}

func names(servers []domain.Server) []string {
	out := make([]string, len(servers))
	for i, s := range servers {
		out[i] = s.Name
	}
	return out
}

// TestFKeyCyclesStateFilter walks the quick filter cycle: all → running →
// not running → all, keeping the cursor clamped as rows shrink.
func TestFKeyCyclesStateFilter(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("f")})
	m = next.(Model)
	if got := m.filter.Value(); got != "state:running" {
		t.Fatalf("first f = %q, want state:running", got)
	}
	if len(m.visible()) != 1 || m.visible()[0].Name != "rlcraft" {
		t.Errorf("running filter -> %v, want [rlcraft]", names(m.visible()))
	}

	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("f")})
	m = next.(Model)
	if got := m.filter.Value(); got != "state:!running" {
		t.Fatalf("second f = %q, want state:!running", got)
	}
	if len(m.visible()) != 2 {
		t.Errorf("not-running filter -> %v, want the two stopped rows", names(m.visible()))
	}

	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("f")})
	m = next.(Model)
	if got := m.filter.Value(); got != "" {
		t.Fatalf("third f = %q, want empty", got)
	}
	if len(m.visible()) != 3 {
		t.Error("cleared filter must show every server again")
	}
}

// TestTabCompletesStateToken walks the completion cycle from the prompt:
// empty completes from the top of the vocabulary, full tokens cycle through
// it, aliases and negation are preserved, and name tokens are never touched.
func TestTabCompletesStateToken(t *testing.T) {
	m := sampleModel()
	m.filterOpen = true // completion lives in the open prompt's keymap

	steps := []struct{ key, want string }{
		{"tab", "state:running"},
		{"tab", "state:restarting"},
		{"tab", "state:paused"},
		{"tab", "state:created"},
		{"tab", "state:exited"},
		{"tab", "state:dead"},
		{"tab", "state:absent"},
		{"tab", "state:running"}, // wraps
		{"shift+tab", "state:absent"},
	}
	for _, s := range steps {
		keyType := tea.KeyTab
		if s.key == "shift+tab" {
			keyType = tea.KeyShiftTab
		}
		next, _ := m.Update(tea.KeyMsg{Type: keyType})
		m = next.(Model)
		if got := m.filter.Value(); got != s.want {
			t.Fatalf("%s from prompt -> %q, want %q", s.key, got, s.want)
		}
	}

	// Alias and negation survive completion; the prefix picks the subset.
	m.filter.SetValue("st:!r")
	next, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = next.(Model)
	if got := m.filter.Value(); got != "st:!running" {
		t.Fatalf("tab with negated alias -> %q, want st:!running", got)
	}

	// Prefix completion: single candidate finishes, unknown prefix falls back
	// to the whole vocabulary.
	m.filter.SetValue("state:ex")
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = next.(Model)
	if got := m.filter.Value(); got != "state:exited" {
		t.Fatalf("tab on prefix -> %q, want state:exited", got)
	}
	m.filter.SetValue("state:zz")
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = next.(Model)
	if got := m.filter.Value(); got != "state:running" {
		t.Fatalf("tab on unknown prefix -> %q, want the first vocabulary entry", got)
	}

	// A plain name token is left alone; a trailing space starts a new token.
	m.filter.SetValue("van")
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = next.(Model)
	if got := m.filter.Value(); got != "van" {
		t.Fatalf("tab on a name token must not touch it, got %q", got)
	}
	m.filter.SetValue("van ")
	next, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	m = next.(Model)
	if got := m.filter.Value(); got != "van state:running" {
		t.Fatalf("tab after a space -> %q, want a fresh state token", got)
	}
	if len(m.visible()) != 0 {
		t.Error("'van state:running' combines both tokens, no server matches")
	}
}

// TestFilterBarPrompt pins where the prompt renders: inside the permanent
// filter bar (focused with cursor while open, dimmed query while merely
// active) — never in the status line.
func TestFilterBarPrompt(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	bar, _ := m.filterBar()
	if !strings.Contains(bar, "filter: / name") {
		t.Errorf("idle bar must teach the grammar, got %q", bar)
	}

	m.filter.SetValue("state:run")
	bar, _ = m.filterBar()
	if !strings.Contains(bar, "/state:run") || !strings.Contains(bar, "esc clears") {
		t.Errorf("active bar must show the query and how to clear it, got %q", bar)
	}

	m.filterOpen = true
	m.filter.Focus()
	defer m.filter.Blur()
	bar, _ = m.filterBar()
	if !strings.Contains(bar, "state:run") {
		t.Errorf("open bar must render the input, got %q", bar)
	}
	if strings.Contains(m.statusView(), "state:run") {
		t.Error("the prompt belongs to the filter bar, not the status line")
	}
}

// TestFilterChipClickTogglesState clicks a census chip on the bar row and
// checks it filters, clicking again clears, and table row clicks still select.
func TestFilterChipClickTogglesState(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	y := m.filterBarRow()
	next, _ := m.Update(tea.MouseMsg{
		Action: tea.MouseActionPress, Button: tea.MouseButtonLeft, X: 1, Y: y,
	})
	m = next.(Model)
	if got := m.filter.Value(); got != "state:running" {
		t.Fatalf("chip click set %q, want state:running", got)
	}
	if len(m.visible()) != 1 || m.visible()[0].Name != "rlcraft" {
		t.Errorf("chip filter -> %v, want [rlcraft]", names(m.visible()))
	}

	// The active chip renders reversed for feedback.
	_, chips := m.filterBar()
	if len(chips) == 0 {
		t.Fatal("census must list the states present in the fleet")
	}
	wantActive := lipgloss.NewStyle().Foreground(StateColor("running", "")).
		Reverse(true).Render("[● running 1]")
	if chips[0].text != wantActive {
		t.Errorf("active chip = %q, want reversed %q", chips[0].text, wantActive)
	}

	// Clicking the same chip again clears the filter.
	next, _ = m.Update(tea.MouseMsg{
		Action: tea.MouseActionPress, Button: tea.MouseButtonLeft, X: 1, Y: y,
	})
	m = next.(Model)
	if m.filter.Value() != "" || len(m.visible()) != 3 {
		t.Errorf("second chip click must clear, got %q", m.filter.Value())
	}

	// Row clicks are unaffected: Y=4 is the second table row.
	next, _ = m.Update(tea.MouseMsg{
		Action: tea.MouseActionPress, Button: tea.MouseButtonLeft, X: 5, Y: 4,
	})
	m = next.(Model)
	if m.cursor != 1 {
		t.Errorf("row click should select row 1, cursor=%d", m.cursor)
	}
}

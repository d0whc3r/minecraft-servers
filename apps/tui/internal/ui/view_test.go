package ui

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// plain strips ANSI escapes: unlike lipgloss v1, styles always emit codes, so
// offset-sensitive assertions must measure what the terminal actually shows.
func plain(s string) string { return ansi.Strip(s) }

func sampleServers() []domain.Server {
	return []domain.Server{
		{
			ServerConfig: domain.ServerConfig{Name: "rlcraft", Type: "AUTO_CURSEFORGE", Version: "1.12.2",
				Memory: "6G", RconPort: "26566", RconEnable: true},
			ContainerState: domain.ContainerState{State: "running", Health: "healthy",
				Status: "Up 6 hours (healthy)", Route: "rlcraft.mc.lan"},
			Route: "rlcraft.mc.lan",
		},
		{
			ServerConfig: domain.ServerConfig{Name: "vanilla", Type: "PAPER", Version: "26.2",
				Memory: "2G"},
			ContainerState: domain.ContainerState{State: "exited", Status: "Exited (0) 20 minutes ago"},
			Route:          "vanilla.mc.lan",
		},
		{
			ServerConfig: domain.ServerConfig{Name: "all-the-mods-10", Type: "AUTO_CURSEFORGE", Version: "1.21.1",
				Memory: "8G", RconPort: "26578", RconEnable: true},
			ContainerState: domain.ContainerState{},
			Route:          "all-the-mods-10.mc.lan",
		},
	}
}

func sampleModel() Model {
	return sampleModelWith(newFakeService(sampleServers(), nil))
}

func sampleModelWith(svc Service) Model {
	m := New(svc)
	m.loaded = true
	m.refreshedAt = time.Now()
	m.servers = sampleServers()
	m.players["rlcraft"] = "There are 0/15 players online:"
	return m
}

func resized(m Model, w, h int) Model {
	next, _ := m.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return next.(Model)
}

// runeOffset returns the position of sub in s counted in runes, not bytes
// (the cursor lead › and other glyphs are multibyte but one cell wide).
func runeOffset(s, sub string) int {
	i := strings.Index(s, sub)
	if i < 0 {
		return -1
	}
	return utf8.RuneCountInString(s[:i])
}

// TestTableViewRendersAlignedColumns renders the main screen with realistic
// data and asserts the columns line up between header and rows.
func TestTableViewRendersAlignedColumns(t *testing.T) {
	m := resized(sampleModel(), 120, 30)
	out := plain(m.render())
	t.Log("\n" + out)

	lines := strings.Split(out, "\n")
	// 0: header · 1: rule · 2: column head · 3+: rows
	if len(lines) < 6 {
		t.Fatalf("table view too short: %d lines", len(lines))
	}
	if !strings.Contains(lines[1], "───") {
		t.Errorf("line 1 should be a section rule, got %q", lines[1])
	}

	head := lines[2]
	for _, want := range []string{"NAME", "STATE", "HEALTH", "ADDR", "VER", "MEM", "PLAYERS", "UPTIME"} {
		if runeOffset(head, want) < 0 {
			t.Errorf("table header missing %q at width 120:\n%s", want, head)
		}
	}

	if !strings.Contains(lines[0], "1/3 up") || !strings.Contains(lines[0], "~6G ram") {
		t.Errorf("header stats wrong: %s", lines[0])
	}

	row := lines[3]
	if !strings.HasPrefix(row, "› ") {
		t.Errorf("selected row must start with cursor lead, got %q", string([]rune(row)[:2]))
	}

	// Cell windows are computed from the model's own column layout: the
	// header has no cursor lead, the row has a 2-rune one, and each cell is
	// followed by a 1-rune separator. Values sit at the cell start (left
	// aligned) or at width-minus-value-length (right aligned).
	cols := m.tableColumns()
	type check struct {
		title, value string
	}
	checks := []check{
		{"STATE", "● running"},
		{"HEALTH", "healthy"},
		{"ADDR", "rlcraft.mc.lan"},
		{"VER", "1.12.2"},
		{"MEM", "6G"},
		{"PLAYERS", "0/15"},
		{"UPTIME", "Up 6 hours"},
	}

	headStart := m.nameWidth() + 2 + 1 // name cell + separator
	rowStart := headStart + 2          // plus the cursor lead
	ci := 0
	for _, c := range cols {
		w := c.width
		if w == 0 {
			w = m.uptimeWidth(cols)
		}
		if ci < len(checks) {
			want := checks[ci]
			titleOff := 0
			valueOff := 0
			if c.right {
				titleOff = w - utf8.RuneCountInString(c.title)
				valueOff = w - utf8.RuneCountInString(want.value)
			}
			gotHead := runeOffset(head, want.title)
			gotRow := runeOffset(row, want.value)
			if gotHead != headStart+titleOff {
				t.Errorf("%s header at rune %d, want %d", want.title, gotHead, headStart+titleOff)
			}
			if gotRow != rowStart+valueOff {
				t.Errorf("%s value at rune %d, want %d", want.value, gotRow, rowStart+valueOff)
			}
			ci++
		}
		headStart += w + 1
		rowStart += w + 1
	}

	// Uptime keeps the exit code and age for stopped containers.
	vanilla := lines[4]
	if !strings.Contains(vanilla, "Exited (0) 20 minutes ago") {
		t.Errorf("stopped container lost its status detail: %q", vanilla)
	}

	// Detail pane for the selection.
	detailIdx := -1
	for i, line := range lines {
		if strings.Contains(line, "type AUTO_CURSEFORGE") {
			detailIdx = i
			break
		}
	}
	if detailIdx < 0 {
		t.Error("detail pane not rendered at height 30")
	}
}

// TestNarrowTerminalHidesColumns checks the responsive column priority.
func TestNarrowTerminalHidesColumns(t *testing.T) {
	m := resized(sampleModel(), 76, 24)
	head := strings.Split(m.render(), "\n")[2]
	if runeOffset(head, "HEALTH") >= 0 {
		t.Error("HEALTH should be hidden below width 80")
	}
	if runeOffset(head, "ADDR") < 0 {
		t.Error("ADDR is core and must stay visible")
	}

	m = resized(sampleModel(), 100, 24)
	head = strings.Split(m.render(), "\n")[2]
	if runeOffset(head, "VER") < 0 || runeOffset(head, "PLAYERS") >= 0 {
		t.Errorf("column priority wrong at width 100: %s", head)
	}
}

// TestSubViewsRender guards the modal and log views against panics.
func TestSubViewsRender(t *testing.T) {
	tiny := resized(sampleModel(), 40, 12)
	tiny.detailView() // must not panic below the detail-pane threshold

	m := sampleModel()
	m.width, m.height = 100, 24
	m.logVP = viewport.New(viewport.WithWidth(98), viewport.WithHeight(20))
	m.mode = viewLogs
	m.logStartedAt = time.Now()
	if out := m.render(); !strings.Contains(out, "logs ·") {
		t.Errorf("logs view missing title: %q", out[:min(80, len(out))])
	}

	m.confirm = &confirmAction{action: domain.ActionStop, server: "vanilla",
		question: "Stop vanilla?", impact: "⚠ 3 player(s) online will be disconnected"}
	m.mode = viewTable
	out := m.render()
	if !strings.Contains(out, "Stop vanilla?") || !strings.Contains(out, "3 player(s)") {
		t.Error("confirm modal must show question and impact line")
	}

	// The quit guard can be raised from any mode (ctrl+c in the logs view):
	// hiding the prompt there would strand the keyboard invisibly.
	m.mode = viewLogs
	m.confirm = &confirmAction{quit: true, question: "1 script action(s) still running. Quit anyway?"}
	if out := m.render(); !strings.Contains(out, "Quit") || !strings.Contains(out, "still running") {
		t.Error("confirm modal must stay visible over the logs view")
	}

	m.confirm = nil
	m.mode = viewHelp
	if out := m.render(); !strings.Contains(out, "keyboard reference") {
		t.Error("help view missing title")
	}
	if out := m.render(); !strings.Contains(out, "Filtering") || !strings.Contains(out, "state:!run") {
		t.Error("help view missing the filtering section")
	}
}

// frameLines counts rendered lines without the trailing newline's empty tail.
func frameLines(view string) int {
	return len(strings.Split(strings.TrimSuffix(view, "\n"), "\n"))
}

// TestFilterBarAlwaysVisible checks that the filter UI is part of the
// permanent frame: the state census and the grammar show without pressing
// anything, the prompt joins the bar while typing, and the frame height never
// changes between states.
func TestFilterBarAlwaysVisible(t *testing.T) {
	m := resized(sampleModel(), 120, 30)

	idle, chips := m.filterBar()
	if len(chips) != 3 {
		t.Fatalf("census must list the 3 states present in the fleet, got %d", len(chips))
	}
	for _, want := range []string{"[● running 1]", "[○ exited 1]", "[· absent 1]"} {
		found := false
		for _, c := range chips {
			found = found || strings.Contains(c.text, want)
		}
		if !found {
			t.Errorf("census missing chip %q in %v", want, chips)
		}
	}
	if !strings.Contains(idle, "state:<pfx>") || !strings.Contains(idle, "!negate") {
		t.Errorf("idle bar must teach the grammar, got %q", idle)
	}
	if strings.Contains(m.render(), "restarting 1") {
		t.Error("states absent from the fleet must stay out of the census")
	}

	// The bar renders in every state, so the frame never shifts; it never
	// exceeds the terminal either.
	idleFrame := frameLines(m.render())
	m.filterOpen = true
	m.filter.Focus()
	defer m.filter.Blur()

	open := m.render()
	openFrame := frameLines(open)
	if !strings.Contains(open, "tab completes") {
		t.Error("empty open prompt must show the placeholder teaching the grammar")
	}
	if !strings.Contains(open, "[● running 1]") {
		t.Error("census must stay visible while the prompt is open")
	}
	if idleFrame != openFrame || idleFrame > m.height {
		t.Fatalf("frame height changed with the prompt: idle=%d open=%d max=%d",
			idleFrame, openFrame, m.height)
	}

	// A typed prefix dims non-matching chips but keeps them listed.
	m.filter.SetValue("state:run")
	dim := styleHeaderDim.Render("[○ exited 1]")
	if open := m.render(); !strings.Contains(open, dim) {
		t.Error("chips excluded by the typed prefix must render dim, not vanish")
	}

	// Contextual footer while the prompt owns the keyboard.
	footer := m.footerView()
	if !strings.Contains(footer, "apply") || !strings.Contains(footer, "cycle states") {
		t.Errorf("filter footer must show apply/completion hints, got %q", footer)
	}
	if strings.Contains(footer, "backup") {
		t.Error("table hints must yield while the filter prompt is open")
	}
}

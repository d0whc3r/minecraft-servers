package ui

import (
	"fmt"
	"strings"
	"time"

	"charm.land/lipgloss/v2"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// render draws the current screen as a string; View wraps it in a tea.View.
func (m Model) render() string {
	if m.width == 0 {
		return "loading…"
	}
	var body string
	switch m.mode {
	case viewLogs:
		body = m.logsView()
	case viewConsole:
		body = m.consoleView()
	case viewHelp:
		body = m.helpView()
	case viewOutput:
		body = m.outputView()
	default:
		body = m.tableView()
	}
	// The confirm overlay is drawn over any mode: ctrl+c raises the quit
	// guard from logs/console too, and hiding it there strands the keyboard
	// on a prompt the user cannot see.
	if m.confirm != nil {
		return m.confirmModal(body)
	}
	return body
}

// Main table view ---------------------------------------------------------------

// tableView renders the four-section main screen: header, table, detail pane,
// status line and footer hint bar.
func (m Model) tableView() string {
	var b strings.Builder

	cols := m.tableColumns()
	b.WriteString(m.headerView())
	b.WriteString("\n")
	b.WriteString(m.ruleView())
	b.WriteString("\n")
	b.WriteString(m.tableHeadView(cols))
	b.WriteString("\n")

	rows := m.tableRows()
	vis := m.visible()
	rendered := 0
	for i := m.offset; i < m.offset+rows && i < len(vis); i++ {
		b.WriteString(m.rowView(vis[i], cols, i == m.cursor))
		b.WriteString("\n")
		rendered++
	}
	if len(vis) == 0 {
		b.WriteString(m.emptyView())
		b.WriteString("\n")
		rendered++
	}
	// Pad the row region so the frame always fills the screen: status, filter
	// bar and footer stay pinned to their screen rows as the list shrinks.
	for ; rendered < rows; rendered++ {
		b.WriteString("\n")
	}

	if m.height >= 24 {
		b.WriteString("\n")
		b.WriteString(m.detailView())
		b.WriteString("\n")
	}

	b.WriteString(m.ruleView())
	b.WriteString("\n")
	b.WriteString(m.statusView())
	b.WriteString("\n")
	// The filter bar is part of the permanent frame: states census, grammar
	// and (while typing) the prompt itself, all visible without pressing /
	bar, _ := m.filterBar()
	b.WriteString(bar)
	b.WriteString("\n")
	b.WriteString(m.footerView())
	return b.String()
}

// tableTop is the screen row (0-based) of the first data row; the mouse
// handler maps clicks through it.
func (m Model) tableTop() int {
	return 3 // header + rule + column head
}

func (m Model) tableRows() int {
	if m.height == 0 {
		return 10
	}
	// header + rule + column head + rule + status + filter bar + footer
	rows := m.height - 7
	if m.height >= 24 {
		rows -= 3 // blank separator + detail pane (2 lines)
	}
	if rows < 1 {
		rows = 1
	}
	return rows
}

func (m Model) headerView() string {
	right := "docker unavailable"
	switch {
	case !m.loaded:
		right = "loading…"
	case m.loadErr != nil:
		right = "✗ docker: " + errShort(m.loadErr)
	default:
		right = fmt.Sprintf("%d/%d up · ~%dG ram · refreshed %ds ago",
			m.countRunning(), len(m.servers), m.memoryInUse(),
			int(time.Since(m.refreshedAt).Seconds()))
	}
	right = styleHeaderDim.Render(right)

	left := styleAppTitle.Render("⛏ MC Servers")
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

func (m Model) ruleView() string {
	return styleRule.Render(strings.Repeat("─", max(m.width, 1)))
}

// Columns -----------------------------------------------------------------------

// column describes one table column; header and rows render from the same
// definition so alignment holds by construction. Right-aligned numeric cells
// follow the TUI table rules.
type column struct {
	title string
	width int
	right bool
	cell  func(s domain.Server) (text string, style lipgloss.Style)
}

func (m Model) tableColumns() []column {
	// Responsive column priority: core first, extras appear as width allows.
	cols := []column{
		{
			title: "STATE", width: 9,
			cell: func(s domain.Server) (string, lipgloss.Style) {
				v := StateVisualFor(s.State, s.Health)
				st := lipgloss.NewStyle().Foreground(v.Color)
				if s.Running() {
					st = st.Bold(true)
				}
				return v.Icon + " " + s.StateLabel(), st
			},
		},
	}
	if m.width >= 80 {
		cols = append(cols, column{
			title: "HEALTH", width: 9,
			cell: func(s domain.Server) (string, lipgloss.Style) {
				if s.Health == "" {
					return "—", lipgloss.NewStyle().Foreground(colorIdle)
				}
				color := colorOk
				switch s.Health {
				case "unhealthy":
					color = colorErr
				case "starting":
					color = colorWarn
				}
				return s.Health, lipgloss.NewStyle().Foreground(color)
			},
		})
	}
	cols = append(cols, column{
		title: "ADDR", width: 16,
		cell: func(s domain.Server) (string, lipgloss.Style) {
			if s.Route == "" {
				return "—", lipgloss.NewStyle().Foreground(colorIdle)
			}
			return s.Route, lipgloss.NewStyle()
		},
	})
	if m.width >= 96 {
		cols = append(cols, column{
			title: "VER", width: 7,
			cell: func(s domain.Server) (string, lipgloss.Style) {
				return orDash(s.Version), lipgloss.NewStyle()
			},
		})
	}
	if m.width >= 108 {
		cols = append(cols, column{
			title: "MEM", width: 4, right: true,
			cell: func(s domain.Server) (string, lipgloss.Style) {
				return orDash(s.Memory), lipgloss.NewStyle().Foreground(colorIdle)
			},
		})
	}
	if m.width >= 120 {
		cols = append(cols, column{
			title: "PLAYERS", width: 7, right: true,
			cell: func(s domain.Server) (string, lipgloss.Style) {
				counts, ok := domain.ParsePlayers(m.players[s.Name])
				if !ok {
					return "—", lipgloss.NewStyle().Foreground(colorIdle)
				}
				return fmt.Sprintf("%d/%d", counts.Online, counts.Max), lipgloss.NewStyle().Foreground(colorText)
			},
		})
	}
	if m.width >= 80 {
		cols = append(cols, column{
			title: "UPTIME",
			width: 0, // fills the remaining width
			cell: func(s domain.Server) (string, lipgloss.Style) {
				if !s.Exists() {
					return "—", lipgloss.NewStyle().Foreground(colorIdle)
				}
				return domain.StripHealth(s.Status), lipgloss.NewStyle()
			},
		})
	}
	return cols
}

func (m Model) nameWidth() int {
	switch {
	case m.width < 90:
		return 18
	case m.width < 120:
		return 26
	default:
		return 30
	}
}

// uptimeWidth computes the flex width of the last (uptime) column. Consumed
// width: cursor lead (2) + name cell (nameWidth+2) + one separator per cell.
func (m Model) uptimeWidth(cols []column) int {
	w := m.width - (m.nameWidth() + 4) - fixedColumnsWidth(cols, len(cols)) - len(cols)
	if w < 6 {
		w = 6
	}
	return w
}

// fixedColumnsWidth sums the widths of columns[0..upto) excluding flex ones.
func fixedColumnsWidth(cols []column, upto int) int {
	total := 0
	for i := 0; i < upto; i++ {
		if cols[i].width > 0 {
			total += cols[i].width
		}
	}
	return total
}

func (m Model) tableHeadView(cols []column) string {
	cells := make([]string, 0, len(cols)+1)
	cells = append(cells, fitCell("NAME", m.nameWidth()+2, styleTableHead, false))
	for _, c := range cols {
		w := c.width
		if w == 0 { // uptime column takes the rest
			w = m.uptimeWidth(cols)
		}
		cells = append(cells, fitCell(c.title, w, styleTableHead, c.right))
	}
	return strings.Join(cells, " ")
}

func (m Model) rowView(s domain.Server, cols []column, selected bool) string {
	lead := "  "
	if selected {
		lead = "› "
	}
	name := s.Name
	switch {
	case m.globalAct != nil:
		name += " " + m.sp.View() + " " + string(m.globalAct.action)
	default:
		if ba, busy := m.busy[s.Name]; busy {
			name += " " + m.sp.View() + " " + string(ba.action) + " " + formatDuration(time.Since(ba.started))
		}
	}

	cells := make([]string, 0, len(cols)+1)
	cells = append(cells, fitCell(name, m.nameWidth()+2, lipgloss.NewStyle(), false))
	for _, c := range cols {
		w := c.width
		if w == 0 { // uptime column takes the rest
			w = m.uptimeWidth(cols)
		}
		text, style := c.cell(s)
		cells = append(cells, fitCell(text, w, style, c.right))
	}

	row := lead + strings.Join(cells, " ")
	if selected {
		return styleRowSelected.Render(row)
	}
	return row
}

func (m Model) emptyView() string {
	if needle := strings.TrimSpace(m.filter.Value()); needle != "" {
		return styleHeaderDim.Render("  no servers match '" + needle + "' — esc to clear the filter")
	}
	if len(m.servers) == 0 {
		return styleHeaderDim.Render("  no servers configured — create one with scripts/add-modpack.sh")
	}
	return ""
}

// filterChip is one clickable state entry of the filter bar census.
type filterChip struct {
	label string
	text  string // rendered cells, e.g. "[● running 1]"
}

// filterBar renders the always-visible filter line: the state census as
// clickable chips plus the grammar hint, or the live prompt first while it is
// open. Closed, the census sits at fixed left-anchored columns so mouse hits
// stay stable whatever the query is.
func (m Model) filterBar() (string, []filterChip) {
	chips := m.stateChips()
	census := strings.Join(chipTexts(chips), "  ")

	if m.filterOpen {
		return fitCell(m.filter.View()+"   "+census, m.width, lipgloss.NewStyle(), false), chips
	}
	if len(chips) == 0 {
		return fitCell(m.filterHintView(), m.width, lipgloss.NewStyle(), false), chips
	}
	return fitCell(census+"   "+m.filterHintView(), m.width, lipgloss.NewStyle(), false), chips
}

func chipTexts(chips []filterChip) []string {
	texts := make([]string, len(chips))
	for i, c := range chips {
		texts[i] = c.text
	}
	return texts
}

// stateChips builds one bracketed chip per state present in the fleet, in its
// own color. The chip matching the query renders reversed (active); chips
// excluded by the typed state prefix render dim.
func (m Model) stateChips() []filterChip {
	counts := make(map[string]int, len(stateLabels))
	for _, s := range m.servers {
		counts[s.StateLabel()]++
	}
	prefix := ""
	if fields := strings.Fields(m.filter.Value()); len(fields) > 0 {
		if _, p, _, ok := stateToken(strings.ToLower(fields[len(fields)-1])); ok {
			prefix = p
		}
	}
	query := strings.TrimSpace(m.filter.Value())

	var chips []filterChip
	for _, label := range stateLabels {
		n := counts[label]
		if n == 0 {
			continue // an empty entry teaches nothing
		}
		text := fmt.Sprintf("[%s %s %d]", StateVisualFor(label, "").Icon, label, n)
		style := lipgloss.NewStyle().Foreground(StateColor(label, ""))
		switch {
		case query == "state:"+label:
			style = style.Reverse(true) // this chip is the active filter
		case prefix != "" && !strings.HasPrefix(label, prefix):
			style = styleHeaderDim // excluded by the typed prefix
		}
		chips = append(chips, filterChip{label: label, text: style.Render(text)})
	}
	return chips
}

// filterChipAt maps a click to a census chip. Chips are only clickable while
// the prompt is closed (they anchor at column 0 then) on the bar's row.
func (m Model) filterChipAt(x, y int) (string, bool) {
	if m.mode != viewTable || m.confirm != nil || m.filterOpen {
		return "", false
	}
	if y != m.filterBarRow() {
		return "", false
	}
	cur := 0
	for _, c := range m.stateChips() {
		if w := lipgloss.Width(c.text); x >= cur && x < cur+w {
			return c.label, true
		}
		cur += lipgloss.Width(c.text) + 2
	}
	return "", false
}

// filterBarRow is the 0-based screen line the filter bar renders on. The row
// region is padded to fill the screen, so the bar is always second-to-last.
func (m Model) filterBarRow() int {
	return m.height - 2
}

// filterHintView is the bar's right segment: the grammar while idle, the live
// query with its match count while a filter is active.
func (m Model) filterHintView() string {
	query := strings.TrimSpace(m.filter.Value())
	if query == "" {
		return styleHeaderDim.Render("filter: / name · state:<pfx> · !negate · f cycle")
	}
	return styleHeaderDim.Render(fmt.Sprintf("filter /%s → %d/%d · esc clears",
		query, len(m.visible()), len(m.servers)))
}

// Detail pane -------------------------------------------------------------------

// detailView renders a two-line summary with a state-colored left border.
func (m Model) detailView() string {
	s, ok := m.selected()
	if !ok {
		return ""
	}

	pair := func(label, value string) string {
		return styleDetailLabel.Render(label+" ") + styleDetailValue.Render(value)
	}

	line1 := strings.Join([]string{
		pair("type", orDash(s.Type)),
		pair("mc", orDash(s.Version)),
		pair("mem", orDash(s.Memory)),
		pair("rcon", rconLabel(s)),
	}, "   ")

	line2 := strings.Join([]string{
		pair("route", orDash(s.Route)),
		pair("container", containerLabel(s)),
		pair("backup", orDash(m.lastBackupLabel(s.Name))),
		pair("players", playersLabel(s, m.players[s.Name])),
	}, "   ")

	content := lipgloss.NewStyle().Width(m.width - 3).Render(line1 + "\n" + line2)
	return lipgloss.NewStyle().
		Border(lipgloss.NormalBorder(), false, false, false, true).
		BorderForeground(StateColor(s.State, s.Health)).
		PaddingLeft(1).
		Render(content)
}

func containerLabel(s domain.Server) string {
	if !s.Exists() {
		return "not created"
	}
	label := domain.StripHealth(s.Status)
	if s.Health == "starting" {
		label += " · waiting for health"
	}
	return label
}

func playersLabel(s domain.Server, raw string) string {
	if !s.RconEnable {
		return "rcon off"
	}
	if !s.Running() {
		return "—"
	}
	if counts, ok := domain.ParsePlayers(raw); ok {
		return fmt.Sprintf("%d/%d", counts.Online, counts.Max)
	}
	return "press p"
}

func rconLabel(s domain.Server) string {
	if !s.RconEnable {
		return "off"
	}
	port := s.RconPort
	if port == "" {
		port = "?"
	}
	return port
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

// Status & footer -------------------------------------------------------------

// statusView renders the ephemeral line: running actions with elapsed time,
// the latest toast, and the filter counter (fzf-style) on the right.
func (m Model) statusView() string {
	var left []string

	if m.globalAct != nil {
		left = append(left, m.sp.View()+" "+string(m.globalAct.action)+" "+
			formatDuration(time.Since(m.globalAct.started)))
	}
	names := sortBusyNames(m.busy)
	for i, name := range names {
		if i == 2 {
			left = append(left, fmt.Sprintf("+%d more", len(names)-2))
			break
		}
		ba := m.busy[name]
		left = append(left, m.sp.View()+" "+string(ba.action)+" "+name+" "+
			formatDuration(time.Since(ba.started)))
	}

	if m.toast != "" {
		if m.toastErr {
			left = append(left, styleToastErr.Render(m.toast))
		} else {
			left = append(left, styleToastOk.Render(m.toast))
		}
	}

	right := fmt.Sprintf("%d servers", len(m.servers))

	line := strings.Join(left, "  ")
	gap := m.width - lipgloss.Width(line) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return line + strings.Repeat(" ", gap) + styleHeaderDim.Render(right)
}

// hint is one footer shortcut (key chip + dim label).
type hint struct {
	key  string
	text string
}

func renderHints(hints []hint, width int) string {
	parts := make([]string, 0, len(hints))
	for _, h := range hints {
		parts = append(parts, styleChip.Render(h.key)+" "+styleKeyLabel.Render(h.text))
	}
	return fitCell(strings.Join(parts, "  "), width, lipgloss.NewStyle(), false)
}

// footerView renders the context-sensitive hint bar for the current mode.
func (m Model) footerView() string {
	switch m.mode {
	case viewLogs:
		return renderHints([]hint{
			{"esc/q", "back"}, {"f", "follow:" + onOff(m.logFollow)},
			{"↑↓", "scroll"}, {"g/G", "ends"},
		}, m.width)
	case viewConsole:
		return renderHints([]hint{
			{"enter", "send"}, {"↑↓", "history"}, {"ctrl+l", "clear"}, {"esc", "back"},
		}, m.width)
	case viewHelp, viewOutput:
		return renderHints([]hint{{"esc", "close"}}, m.width)
	}

	if m.filterOpen {
		return renderHints([]hint{
			{"enter", "apply"}, {"esc", "clear + close"},
			{"tab / ⇧tab", "cycle states"},
		}, m.width)
	}

	return renderHints([]hint{
		{"↑↓", "select"}, {"enter", "start/logs"}, {"s", "start"},
		{"x", "stop"}, {"r", "restart"}, {"b", "backup"},
		{"l", "logs"}, {"c", "rcon"}, {"S/X", "all"}, {"/", "filter"},
		{"f", "state"}, {"o", "output"}, {"?", "help"}, {"q", "quit"},
	}, m.width)
}

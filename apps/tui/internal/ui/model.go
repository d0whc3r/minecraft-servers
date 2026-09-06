// Package ui is the presentation layer: a Bubble Tea model that renders the
// dashboard and translates keystrokes into app.Service operations.
package ui

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

type viewMode int

const (
	viewTable viewMode = iota
	viewLogs
	viewConsole
	viewHelp
	viewOutput
)

// confirmAction is a pending destructive action awaiting user confirmation.
// quit marks the special "actions still running" exit guard.
type confirmAction struct {
	action   domain.Action
	server   string // "" for global actions
	question string
	impact   string // optional second line: who/what is affected
	quit     bool
}

// busyAction tracks a running script action and when it started, so the UI
// can show "start vanilla… 12s" live.
type busyAction struct {
	action  domain.Action
	started time.Time
}

// event is one line of the activity feed (toasts + history).
type event struct {
	at    time.Time
	text  string
	isErr bool
}

// conEntry is one RCON exchange: the echoed command and its reply.
type conEntry struct {
	input string
	reply string
	isErr bool
}

const (
	maxLogLines  = 3000
	maxLogRune   = 1000
	maxConEntrys = 200
	maxEvents    = 50

	playersTTL   = 30 * time.Second // don't re-poll a server before this
	playersEvery = 6                // …and only check on every Nth refresh tick
)

// Model implements tea.Model for the server dashboard.
type Model struct {
	svc Service

	width  int
	height int

	servers []domain.Server
	loadErr error
	loaded  bool
	cursor  int
	offset  int // first visible table row

	mode viewMode

	filter     textinput.Model
	filterOpen bool

	sp        spinner.Model
	busy      map[string]busyAction // server name -> running action
	globalAct *busyAction           // nil, or start-all / stop-all
	toast     string
	toastErr  bool
	events    []event // newest last, capped
	lastOut   string
	lastLabel string
	lastIsErr bool

	confirm *confirmAction

	// logs view
	logVP        viewport.Model
	logLines     []string
	logServer    string
	logCancel    context.CancelFunc
	logCh        chan dockerLogLine
	logFollow    bool
	logErr       string
	logStartedAt time.Time

	// console view
	conServer string
	conInput  textinput.Model
	conLines  []conEntry
	conPast   []string
	conPastIx int
	conBusy   bool

	// players (RCON "list"), keyed by server with fetch timestamps
	players   map[string]string
	playersAt map[string]time.Time
	ticks     int

	refreshedAt time.Time
}

// New builds the dashboard model for a repository service.
func New(svc Service) Model {
	filter := textinput.New()
	filter.Placeholder = "<name> · state:<pfx> · !negate · tab completes"
	filter.Prompt = "/"
	filter.CharLimit = 100

	conInput := textinput.New()
	conInput.Placeholder = "rcon command (try: list, help)"
	conInput.Prompt = "❯ "
	conInput.CharLimit = 200

	sp := spinner.New(spinner.WithSpinner(spinner.MiniDot))

	return Model{
		svc:       svc,
		sp:        sp,
		busy:      make(map[string]busyAction),
		filter:    filter,
		conInput:  conInput,
		players:   make(map[string]string),
		playersAt: make(map[string]time.Time),
	}
}

// Init implements tea.Model.
func (m Model) Init() tea.Cmd {
	return tea.Batch(m.sp.Tick, refreshCmd(m.svc), tickCmd())
}

// Update implements tea.Model.
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.logVP.Width = msg.Width - 2
		m.logVP.Height = msg.Height - 4
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.sp, cmd = m.sp.Update(msg)
		return m, cmd

	case tickMsg:
		m.ticks++
		cmds := []tea.Cmd{refreshCmd(m.svc), tickCmd()}
		if cmd := m.maybeFetchPlayers(); cmd != nil {
			cmds = append(cmds, cmd)
		}
		return m, tea.Batch(cmds...)

	case serversMsg:
		m.loaded = true
		m.loadErr = msg.err
		if msg.err == nil {
			m.servers = msg.servers
			m.refreshedAt = time.Now()
		}
		m.clampCursor()
		return m, nil

	case actionDoneMsg:
		return m.handleActionDone(msg)

	case rconDoneMsg:
		m.conBusy = false
		reply := msg.output
		if msg.err != nil {
			reply = strings.TrimSpace(reply)
			if reply == "" {
				reply = msg.err.Error()
			}
		}
		m.appendCon(conEntry{reply: reply, isErr: msg.err != nil})
		return m, nil

	case playersMsg:
		m.playersAt[msg.server] = time.Now()
		if msg.err != nil {
			m.players[msg.server] = ""
			return m, nil
		}
		m.players[msg.server] = msg.output
		return m, nil

	case logStartedMsg:
		if m.mode == viewLogs && msg.server == m.logServer {
			m.logFollow = true
			m.logStartedAt = time.Now()
			m.syncLogViewport()
		}
		return m, nil

	case logLineMsg:
		if m.mode != viewLogs || m.logCh == nil {
			return m, nil
		}
		if msg.line.Err != nil {
			m.logErr = "error: " + msg.line.Err.Error()
		}
		m.appendLogLine(msg.line.Text)
		m.syncLogViewport()
		return m, waitLogLineCmd(m.logCh)

	case logClosedMsg:
		if m.mode == viewLogs {
			m.logErr = "log stream ended (press esc)"
		}
		return m, nil

	case tea.MouseMsg:
		return m.handleMouse(msg)

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m Model) handleActionDone(msg actionDoneMsg) (tea.Model, tea.Cmd) {
	elapsed := time.Duration(0)
	if msg.server != "" {
		if ba, ok := m.busy[msg.server]; ok {
			elapsed = time.Since(ba.started)
			delete(m.busy, msg.server)
		}
	} else if m.globalAct != nil && m.globalAct.action == msg.action {
		elapsed = time.Since(m.globalAct.started)
		m.globalAct = nil
	}

	verb := msg.action.Verb(msg.server)
	m.lastLabel = verb
	m.lastOut = msg.output
	m.lastIsErr = msg.err != nil

	if msg.err != nil {
		m.setToast("✗ "+verb+" · "+errShort(msg.err), true)
	} else {
		m.setToast("✓ "+verb+" · "+formatDuration(elapsed), false)
	}
	return m, refreshCmd(m.svc)
}

// setToast updates the status-line toast and the activity feed at once.
func (m *Model) setToast(text string, isErr bool) {
	m.toast = text
	m.toastErr = isErr
	m.addEvent(text, isErr)
}

// addEvent appends to the activity feed, dropping the oldest entries.
func (m *Model) addEvent(text string, isErr bool) {
	m.events = append(m.events, event{at: time.Now(), text: text, isErr: isErr})
	if len(m.events) > maxEvents {
		m.events = m.events[len(m.events)-maxEvents:]
	}
}

func errShort(err error) string {
	s := err.Error()
	if i := strings.Index(s, "\n"); i > 0 {
		s = s[:i]
	}
	if len(s) > 120 {
		s = s[:117] + "…"
	}
	return s
}

// maybeFetchPlayers polls the selected running server's player count when the
// cached value is stale, throttled to every playersEvery-th refresh tick.
func (m *Model) maybeFetchPlayers() tea.Cmd {
	if m.ticks%playersEvery != 0 {
		return nil
	}
	s, ok := m.selected()
	if !ok || !s.Running() || !s.RconEnable {
		return nil
	}
	if time.Since(m.playersAt[s.Name]) < playersTTL {
		return nil
	}
	m.playersAt[s.Name] = time.Now() // guard against duplicate in-flight polls
	return playersCmd(m.svc, s.Name)
}

// startAllQuestion builds the confirmation text, including the approximate RAM
// footprint of the servers that would be started.
func (m Model) startAllQuestion() string {
	stopped := 0
	ramGB := 0
	for _, s := range m.servers {
		if !s.Running() {
			stopped++
			ramGB += domain.MemoryGB(s.Memory)
		}
	}
	q := fmt.Sprintf("Start all %d stopped servers?", stopped)
	if ramGB > 0 {
		q += fmt.Sprintf(" (~%dG RAM total)", ramGB)
	}
	return q
}

// memoryInUse sums the configured memory of every running server.
func (m Model) memoryInUse() int {
	total := 0
	for _, s := range m.servers {
		if s.Running() {
			total += domain.MemoryGB(s.Memory)
		}
	}
	return total
}

// playerCount returns the online player count for a server (0 when unknown).
func (m Model) playerCount(server string) int {
	counts, ok := domain.ParsePlayers(m.players[server])
	if !ok {
		return 0
	}
	return counts.Online
}

// Selection & filtering -------------------------------------------------------

// visible applies the filter line to the server rows. The value is a set of
// whitespace-separated tokens that must all match: plain tokens are name
// substrings, and `state:<prefix>` tokens (aliases st:, is:) prefix-match the
// state label — a leading ! negates, e.g. state:!run hides running servers.
func (m Model) visible() []domain.Server {
	query := strings.TrimSpace(m.filter.Value())
	if query == "" {
		return m.servers
	}
	tokens := strings.Fields(strings.ToLower(query))
	out := make([]domain.Server, 0, len(m.servers))
	for _, s := range m.servers {
		if serverMatches(s, tokens) {
			out = append(out, s)
		}
	}
	return out
}

func serverMatches(s domain.Server, tokens []string) bool {
	for _, tok := range tokens {
		if _, prefix, negate, ok := stateToken(tok); ok {
			if s.MatchesStatePrefix(prefix) == negate {
				return false
			}
			continue
		}
		if !strings.Contains(strings.ToLower(s.Name), tok) {
			return false
		}
	}
	return true
}

// stateToken recognizes a state token, returning its alias spelling plus the
// optional ! negation. A bare "state:" (no prefix) matches every server.
func stateToken(tok string) (key, prefix string, negate, ok bool) {
	for _, key := range []string{"state:", "st:", "is:"} {
		rest, found := strings.CutPrefix(tok, key)
		if !found {
			continue
		}
		if negate = strings.HasPrefix(rest, "!"); negate {
			rest = strings.TrimPrefix(rest, "!")
		}
		return key, rest, negate, true
	}
	return "", "", false, false
}

// stateLabels is the state vocabulary in cycle order: what tab completes and
// what the vocabulary line census counts.
var stateLabels = []string{"running", "restarting", "paused", "created", "exited", "dead", "absent"}

// completeStateToken replaces the trailing empty or state token with the next
// state label in cycle order (previous with a negative step), keeping the
// typed alias and ! negation. Plain name tokens are never touched, so
// completion can't corrupt a name query; a trailing space starts a new one.
func (m *Model) completeStateToken(step int) {
	value := m.filter.Value()
	trailingSpace := strings.HasSuffix(value, " ")
	fields := strings.Fields(value)

	var head, tok string
	switch {
	case trailingSpace:
		head = strings.TrimRight(value, " ")
	case len(fields) > 0:
		head, tok = strings.Join(fields[:len(fields)-1], " "), fields[len(fields)-1]
	}

	key, prefix, negate := "state:", "", false
	if tok != "" {
		k, p, n, ok := stateToken(strings.ToLower(tok))
		if !ok {
			return
		}
		key, prefix, negate = k, p, n
	}

	candidates := make([]string, 0, len(stateLabels))
	for _, label := range stateLabels {
		if strings.HasPrefix(label, prefix) {
			candidates = append(candidates, label)
		}
	}
	if len(candidates) == 0 {
		candidates = stateLabels // unknown prefix: offer the full vocabulary
	}
	if len(candidates) == 1 && candidates[0] == prefix {
		candidates = stateLabels // already complete: keep cycling the menu
	}

	cur := -1
	if step < 0 {
		cur = 0 // first shift+tab wraps in from the end
	}
	for i, c := range candidates {
		if c == prefix {
			cur = i
		}
	}
	next := candidates[(cur+step+len(candidates))%len(candidates)]

	completed := head
	if completed != "" {
		completed += " "
	}
	bang := ""
	if negate {
		bang = "!"
	}
	m.filter.SetValue(completed + key + bang + next)
	m.clampCursor()
}

// cycleStateFilter rotates the quick state filter: all → running → everything
// else → all. It drives the shared filter input, so the prompt render, the
// n/n counter and esc-to-clear keep a single source of truth.
func (m *Model) cycleStateFilter() {
	switch strings.TrimSpace(m.filter.Value()) {
	case "state:running":
		m.filter.SetValue("state:!running")
	case "state:!running":
		m.filter.SetValue("")
	default:
		m.filter.SetValue("state:running")
	}
	m.clampCursor()
}

func (m Model) selected() (domain.Server, bool) {
	vis := m.visible()
	if m.cursor < 0 || m.cursor >= len(vis) {
		return domain.Server{}, false
	}
	return vis[m.cursor], true
}

func (m *Model) clampCursor() {
	if n := len(m.visible()); m.cursor >= n {
		m.cursor = n - 1
	}
	if m.cursor < 0 {
		m.cursor = 0
	}
}

func (m *Model) ensureVisible() {
	rows := m.tableRows()
	if rows <= 0 {
		m.offset = 0
		return
	}
	if m.cursor < m.offset {
		m.offset = m.cursor
	}
	if m.cursor >= m.offset+rows {
		m.offset = m.cursor - rows + 1
	}
}

func (m *Model) countRunning() int {
	n := 0
	for _, s := range m.servers {
		if s.Running() {
			n++
		}
	}
	return n
}

// Action plumbing -------------------------------------------------------------

func (m *Model) startAction(action domain.Action, server string) tea.Cmd {
	if server != "" {
		if m.isBusy(server) {
			return nil
		}
		m.busy[server] = busyAction{action: action, started: time.Now()}
	} else {
		if m.globalAct != nil {
			return nil
		}
		m.globalAct = &busyAction{action: action, started: time.Now()}
	}
	return runActionCmd(m.svc, action, server)
}

func (m *Model) isBusy(server string) bool {
	if m.globalAct != nil {
		return true
	}
	_, busy := m.busy[server]
	return busy
}

func (m *Model) busyCount() int {
	n := len(m.busy)
	if m.globalAct != nil {
		n++
	}
	return n
}

// Logs ------------------------------------------------------------------------

func (m *Model) attachLogs(server string) tea.Cmd {
	if m.logCancel != nil {
		m.logCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.logCancel = cancel
	m.logServer = server
	m.logLines = nil
	m.logErr = ""
	m.logFollow = true
	m.logStartedAt = time.Now()
	m.logCh = make(chan dockerLogLine, 256)
	m.mode = viewLogs

	go m.svc.FollowLogs(ctx, server, m.logCh)
	return tea.Batch(waitLogLineCmd(m.logCh), func() tea.Msg { return logStartedMsg{server: server} })
}

func (m *Model) detachLogs() {
	if m.logCancel != nil {
		m.logCancel()
		m.logCancel = nil
	}
	m.logCh = nil
	if m.mode == viewLogs {
		m.mode = viewTable
	}
}

func (m *Model) appendLogLine(line string) {
	if r := []rune(line); len(r) > maxLogRune {
		line = string(r[:maxLogRune]) + "…"
	}
	m.logLines = append(m.logLines, line)
	if len(m.logLines) > maxLogLines {
		m.logLines = m.logLines[len(m.logLines)-maxLogLines:]
	}
}

func (m *Model) syncLogViewport() {
	m.logVP.SetContent(strings.Join(m.logLines, "\n"))
	if m.logFollow {
		m.logVP.GotoBottom()
	}
}

// Console ---------------------------------------------------------------------

func (m *Model) openConsole(server string) {
	m.conServer = server
	m.conLines = nil
	m.conPast = nil
	m.conPastIx = 0
	m.conBusy = false
	m.conInput.SetValue("")
	m.conInput.Focus()
	m.mode = viewConsole
}

func (m *Model) appendCon(entry conEntry) {
	m.conLines = append(m.conLines, entry)
	if len(m.conLines) > maxConEntrys {
		m.conLines = m.conLines[len(m.conLines)-maxConEntrys:]
	}
}

// lastBackupLabel renders the newest backup for the detail pane.
func (m Model) lastBackupLabel(server string) string {
	b, ok := m.svc.LatestBackup(server)
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s · %s ago", b.Name, formatDuration(time.Since(b.ModTime)))
}

// sortBusyNames gives the status line a stable order across refreshes.
func sortBusyNames(busy map[string]busyAction) []string {
	names := make([]string, 0, len(busy))
	for name := range busy {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

package ui

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// Modals -----------------------------------------------------------------------

// confirmModal overlays a centered confirmation box on the table view.
func (m Model) confirmModal(background string) string {
	c := *m.confirm

	title := "Confirm"
	switch {
	case c.quit:
		title = "Quit"
	case c.action == domain.ActionStop:
		title = "Stop server"
	case c.action == domain.ActionRestart:
		title = "Restart server"
	case c.action == domain.ActionStartAll:
		title = "Start all"
	case c.action == domain.ActionStopAll:
		title = "Stop all"
	}

	body := styleModalTitle.Render(title) + "\n\n" + c.question
	if c.impact != "" {
		body += "\n" + styleImpact.Render(c.impact)
	}
	body += "\n\n" + styleChip.Render("y") + " " + styleKeyLabel.Render("confirm") +
		"   " + styleChip.Render("n/esc") + " " + styleKeyLabel.Render("cancel")

	box := styleModalBox.Render(body)
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}

// Help view --------------------------------------------------------------------

func (m Model) helpView() string {
	section := func(title string, rows []string) string {
		head := styleModalTitle.Render(title) + "\n" +
			styleRule.Render(strings.Repeat("─", 34)) + "\n"
		return head + strings.Join(rows, "\n")
	}

	key := func(k, d string) string {
		chip := styleChip.Render(k)
		pad := 10 - lipgloss.Width(chip)
		if pad < 1 {
			pad = 1
		}
		return " " + chip + strings.Repeat(" ", pad) + styleKeyLabel.Render(d)
	}

	colA := section("Navigation", []string{
		key("↑/↓ k/j", "select server"),
		key("g / G", "first / last"),
		key("/ filter", "name · state:run, st:!run, esc clears"),
		key("f", "cycle state: all → up → not up"),
		key("click", "select row · state chips filter"),
		"",
		section("Server actions", []string{
			key("enter", "start · or follow logs"),
			key("s", "start server"),
			key("x", "stop (confirm)"),
			key("r", "restart (confirm)"),
			key("b", "back up now"),
			key("l", "container logs"),
			key("c", "RCON console"),
			key("p", "refresh players"),
		}),
	})

	colB := section("Bulk & info", []string{
		key("S", "start ALL stopped (~RAM shown)"),
		key("X", "stop ALL running"),
		key("o", "last script output"),
		key("R", "refresh now"),
	}) + "\n" + section("Filtering", []string{
		key("/", "open the filter prompt"),
		key("f", "cycle state: all→up→not up"),
		key("text…", "name substring tokens"),
		key("state:<pfx>", "state prefix (st:, is: too)"),
		key("state:!run", "exclude that state"),
		key("space", "tokens AND together"),
		key("tab / ⇧tab", "complete the state"),
	}) + "\n" + section("App", []string{
		key("?", "toggle this help"),
		key("q", "quit (guarded while busy)"),
		key("esc", "back / clear filter"),
		"",
		styleHeaderDim.Render("auto-refresh 5s · players every 30s"),
	})

	body := styleModalTitle.Render("MC Servers — keyboard reference") + "\n\n" +
		lipgloss.JoinHorizontal(lipgloss.Top, colA, "   ", colB)

	box := styleModalBox.Render(body)
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}

// Output popup -----------------------------------------------------------------

func (m Model) outputView() string {
	lines := strings.Split(m.lastOut, "\n")
	maxLines := m.height - 10
	if maxLines < 4 {
		maxLines = 4
	}
	head := ""
	if len(lines) > maxLines {
		head = styleHeaderDim.Render(fmt.Sprintf("… %d earlier lines hidden", len(lines)-maxLines)) + "\n"
		lines = lines[len(lines)-maxLines:]
	}

	status := styleToastOk.Render("✓")
	if m.lastIsErr {
		status = styleToastErr.Render("✗")
	}

	body := styleModalTitle.Render("output · "+m.lastLabel) + "  " + status + "\n\n" + head +
		strings.Join(lines, "\n") + "\n\n" + styleHeaderDim.Render("press any key to close")

	box := styleModalBox.MaxWidth(m.width - 4).Render(body)
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}

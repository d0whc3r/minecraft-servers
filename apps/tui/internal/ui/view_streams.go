package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// Logs view --------------------------------------------------------------------

func (m Model) logsView() string {
	title := styleAppTitle.Render("logs · "+m.logServer) + "  " +
		styleHeaderDim.Render(fmt.Sprintf("%d lines · %s · follow %s",
			len(m.logLines), formatDuration(time.Since(m.logStartedAt)), onOff(m.logFollow)))
	if m.logErr != "" {
		title += "\n" + styleToastErr.Render(m.logErr)
	}
	footer := renderHints([]hint{
		{"esc", "back"}, {"f", "follow:" + onOff(m.logFollow)},
		{"↑↓", "scroll"}, {"g/G", "ends"}, {"q", "quit app"},
	}, m.width)

	return title + "\n" + m.ruleView() + "\n" + m.logVP.View() + "\n" + footer
}

// Console view -----------------------------------------------------------------

func (m Model) consoleView() string {
	title := styleAppTitle.Render("rcon · " + m.conServer)
	if m.conBusy {
		title += "  " + m.sp.View() + " running…"
	}

	rows := m.height - 4
	if rows < 1 {
		rows = 1
	}

	inStyle := lipgloss.NewStyle().Foreground(colorAccent).Bold(true)
	errStyle := lipgloss.NewStyle().Foreground(colorErr)
	outStyle := lipgloss.NewStyle().Foreground(colorText)

	lines := make([]string, 0, len(m.conLines))
	for _, e := range m.conLines {
		if e.input != "" {
			lines = append(lines, inStyle.Render("❯ "+e.input))
		}
		if e.reply != "" {
			reply := e.reply
			if len(reply) > 4000 {
				reply = reply[:4000] + "…"
			}
			style := outStyle
			if e.isErr {
				style = errStyle
			}
			lines = append(lines, style.Render(reply))
		}
	}
	if len(lines) > rows-1 {
		lines = lines[len(lines)-rows+1:]
	}

	input := m.conInput.View()
	if m.conBusy {
		input = styleHeaderDim.Render("waiting for server…")
	}

	body := append(lines, input)
	for len(body) < rows {
		body = append(body, "")
	}
	return title + "\n" + m.ruleView() + "\n" + strings.Join(body, "\n") + "\n" + m.footerView()
}

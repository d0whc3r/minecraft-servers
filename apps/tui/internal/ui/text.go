package ui

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/x/ansi"

	"charm.land/lipgloss/v2"
)

// fitCell truncates s to width w and pads it, left- or right-aligned. Styles
// apply before padding so backgrounds fill the whole cell.
func fitCell(s string, w int, style lipgloss.Style, right bool) string {
	s = ansi.Truncate(s, w, "…")
	styled := style.Render(s)
	if gap := w - lipgloss.Width(styled); gap > 0 {
		if right {
			return strings.Repeat(" ", gap) + styled
		}
		return styled + strings.Repeat(" ", gap)
	}
	return styled
}

func onOff(b bool) string {
	if b {
		return "on"
	}
	return "off"
}

// formatDuration renders durations for toasts and busy indicators.
func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	switch {
	case d < time.Minute:
		return strconv.Itoa(int(d/time.Second)) + "s"
	case d < time.Hour:
		return fmt.Sprintf("%dm%02ds", int(d/time.Minute), int(d/time.Second)%60)
	default:
		return fmt.Sprintf("%dh%02dm", int(d/time.Hour), int(d/time.Minute)%60)
	}
}

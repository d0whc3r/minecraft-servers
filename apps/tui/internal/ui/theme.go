package ui

import "github.com/charmbracelet/lipgloss"

// ANSI-256 palette. Deliberately small: one accent, four semantic colors,
// two grays. Everything else derives from these.
const (
	colorAccent = lipgloss.Color("213") // violet: brand, focus, modals
	colorOk     = lipgloss.Color("78")  // soft green: running / healthy / success
	colorWarn   = lipgloss.Color("214") // orange: starting / restarting
	colorErr    = lipgloss.Color("203") // soft red: unhealthy / failures
	colorIdle   = lipgloss.Color("246") // gray: stopped / absent / muted text
	colorText   = lipgloss.Color("252") // normal foreground
	colorRule   = lipgloss.Color("238") // separators
	colorRowBg  = lipgloss.Color("237") // selected row background
	colorChipFg = lipgloss.Color("16")  // footer key chips
	colorChipBg = lipgloss.Color("243")
)

var (
	styleAppTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorChipFg).
			Background(colorAccent).
			Padding(0, 1)

	styleHeaderDim = lipgloss.NewStyle().Foreground(colorIdle)

	styleRule = lipgloss.NewStyle().Foreground(colorRule)

	styleTableHead = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("250"))

	styleRowSelected = lipgloss.NewStyle().Background(colorRowBg)

	styleKeyLabel = lipgloss.NewStyle().Foreground(colorIdle)

	styleChip = lipgloss.NewStyle().
			Foreground(colorChipFg).
			Background(colorChipBg)

	styleToastOk  = lipgloss.NewStyle().Foreground(colorOk)
	styleToastErr = lipgloss.NewStyle().Foreground(colorErr)

	styleDetailLabel = lipgloss.NewStyle().Foreground(colorIdle)
	styleDetailValue = lipgloss.NewStyle().Foreground(colorText)

	styleModalBox = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorAccent).
			Padding(1, 3)

	styleModalTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorAccent)

	styleImpact = lipgloss.NewStyle().Foreground(colorWarn)
)

// StateVisual is the (glyph, color) pair for a container state; the dots form
// the visual language of the whole app.
type StateVisual struct {
	Icon  string
	Color lipgloss.Color
}

// StateVisualFor maps a container state + health to its glyph and color.
func StateVisualFor(state, health string) StateVisual {
	switch {
	case state == "running" && health == "starting":
		return StateVisual{"◐", colorWarn}
	case state == "running" && health == "unhealthy":
		return StateVisual{"●", colorErr}
	case state == "running":
		return StateVisual{"●", colorOk}
	case state == "restarting":
		return StateVisual{"◐", colorWarn}
	case state == "paused":
		return StateVisual{"▮", colorWarn}
	case state == "created":
		return StateVisual{"○", colorWarn}
	case state == "exited":
		return StateVisual{"○", colorIdle}
	case state == "dead":
		return StateVisual{"✕", colorErr}
	default: // absent: no container at all
		return StateVisual{"·", colorIdle}
	}
}

// StateColor picks the accent color used for state-derived chrome (detail
// border, badges).
func StateColor(state, health string) lipgloss.Color {
	return StateVisualFor(state, health).Color
}

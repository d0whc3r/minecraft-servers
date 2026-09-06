package ui

import (
	"strings"
	"testing"
	"time"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"
)

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name string
		in   time.Duration
		want string
	}{
		{"seconds", 45 * time.Second, "45s"},
		{"just under a minute", 59 * time.Second, "59s"},
		{"one minute", 65 * time.Second, "1m05s"},
		{"long minutes", 754 * time.Second, "12m34s"},
		{"hours", 3720 * time.Second, "1h02m"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := formatDuration(tt.in); got != tt.want {
				t.Errorf("formatDuration(%v) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestFitCell(t *testing.T) {
	plainStyle := lipgloss.NewStyle()
	tests := []struct {
		name, in string
		w        int
		style    lipgloss.Style
		want     string
	}{
		{"fits pads right", "abc", 5, plainStyle, "abc  "},
		{"exact", "abcde", 5, plainStyle, "abcde"},
		{"truncated with ellipsis", "abcdef", 5, plainStyle, "abcd…"},
		{"zero width", "abc", 0, plainStyle, ""},
		// ANSI codes don't count toward the visible width (lipgloss v2 styles
		// always emit them, even in captured output).
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := fitCell(tt.in, tt.w, tt.style, false); got != tt.want {
				t.Errorf("fitCell(%q, %d) = %q, want %q", tt.in, tt.w, got, tt.want)
			}
		})
	}
}

func TestFitCellStyled(t *testing.T) {
	styled := "\x1b[31m[running 1]\x1b[m"

	got := fitCell(styled, 11, lipgloss.NewStyle(), false)
	if ansi.Strip(got) != "[running 1]" || lipgloss.Width(got) > 11 {
		t.Errorf("styled fitting cell = %q, want [running 1] within width 11", got)
	}

	got = fitCell(styled+" and more", 13, lipgloss.NewStyle(), false)
	if plain := ansi.Strip(got); !strings.HasPrefix(plain, "[running 1]") ||
		!strings.HasSuffix(plain, "…") || lipgloss.Width(got) > 13 {
		t.Errorf("styled truncated cell = %q, want [running 1]… within width 13", got)
	}
}

func TestFitCellRightAligns(t *testing.T) {
	got := fitCell("6G", 5, lipgloss.NewStyle(), true)
	if !strings.HasSuffix(got, "6G") || lipgloss.Width(got) != 5 {
		t.Errorf("right-aligned cell = %q, want %q padded to width 5", got, "6G")
	}
}

package ui

import (
	"testing"
	"time"
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

func TestTruncate(t *testing.T) {
	tests := []struct {
		name, in string
		w        int
		want     string
	}{
		{"fits", "abc", 5, "abc"},
		{"exact", "abcde", 5, "abcde"},
		{"truncated", "abcdef", 5, "abcd…"},
		{"one cell", "abc", 1, "a"},
		{"zero width", "abc", 0, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := truncate(tt.in, tt.w); got != tt.want {
				t.Errorf("truncate(%q, %d) = %q, want %q", tt.in, tt.w, got, tt.want)
			}
		})
	}
}

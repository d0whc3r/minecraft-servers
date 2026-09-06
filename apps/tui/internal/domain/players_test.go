package domain

import "testing"

func TestParsePlayers(t *testing.T) {
	tests := []struct {
		name       string
		in         string
		wantOnline int
		wantMax    int
		wantOK     bool
	}{
		{"itzg classic", "There are 0 of a max of 20 players online:", 0, 20, true},
		{"rcon slash form", "There are 0/15 players online:", 0, 15, true},
		{"with players listed", "There are 2 of a max of 20 players online: alice, bob", 2, 20, true},
		{"garbage", "", 0, 0, false},
		{"error text", "Error: server refused", 0, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ParsePlayers(tt.in)
			if ok != tt.wantOK || got.Online != tt.wantOnline || got.Max != tt.wantMax {
				t.Errorf("ParsePlayers(%q) = %+v, %v; want %d/%d, %v",
					tt.in, got, ok, tt.wantOnline, tt.wantMax, tt.wantOK)
			}
		})
	}
}

package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrimQuotes(t *testing.T) {
	tests := []struct {
		name, in, want string
	}{
		{"double quotes", `"8G"`, "8G"},
		{"single quotes", `'paper'`, "paper"},
		{"no quotes", "25566", "25566"},
		{"empty", "", ""},
		{"unbalanced left", `"8G`, `"8G`},
		{"unbalanced right", `8G"`, `8G"`},
		{"quote inside", `a"b`, `a"b`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := trimQuotes(tt.in); got != tt.want {
				t.Errorf("trimQuotes(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseEnvFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sample.env")
	content := `# comment line
TYPE=PAPER
VERSION = 1.21.1

MEMORY="8G"
CF_EXCLUDE_MODS="a,b,#not-a-comment"
broken line without equals
ENABLE_RCON=true
   # indented comment
   RCON_PORT=26566
MOTD=Welcome # to the server
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	got, err := parseEnvFile(path)
	if err != nil {
		t.Fatalf("parseEnvFile: %v", err)
	}

	want := map[string]string{
		"TYPE":            "PAPER",
		"VERSION":         "1.21.1",
		"MEMORY":          "8G",
		"CF_EXCLUDE_MODS": "a,b,#not-a-comment",
		"ENABLE_RCON":     "true",
		"RCON_PORT":       "26566",
		"MOTD":            "Welcome # to the server",
	}
	for key, wantVal := range want {
		if got[key] != wantVal {
			t.Errorf("key %s = %q, want %q", key, got[key], wantVal)
		}
	}
	if n := len(got); n != len(want) {
		t.Errorf("parsed %d keys, want %d (got keys: %v)", n, len(want), got)
	}
}

func TestLoadSortsAndParses(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "config", "modpacks")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("b-server.env", "TYPE=PAPER\nMEMORY=4G\n")
	write("a-server.env", "TYPE=VANILLA\nMEMORY=2G\nENABLE_RCON=TRUE\nRCON_PORT=26565\n")
	write("ignored.txt", "not a config")
	if err := os.Mkdir(filepath.Join(dir, "subdir.env"), 0o700); err != nil {
		t.Fatal(err)
	}

	configs, err := Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(configs) != 2 {
		t.Fatalf("got %d configs, want 2: %+v", len(configs), configs)
	}

	first := configs[0]
	if first.Name != "a-server" {
		t.Errorf("configs not sorted by name: first is %q", first.Name)
	}
	if !first.RconEnable {
		t.Error("ENABLE_RCON=TRUE should be case-insensitively true")
	}
	if configs[1].RconEnable {
		t.Error("missing ENABLE_RCON should default to false")
	}
}

func TestLoadMissingDir(t *testing.T) {
	if _, err := Load(t.TempDir()); err == nil {
		t.Error("missing config dir should return an error")
	}
}

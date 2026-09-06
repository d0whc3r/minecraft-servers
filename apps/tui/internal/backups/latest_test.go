package backups

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLatest(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "backups", "vanilla")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	files := []struct {
		name string
		age  time.Duration
	}{
		{"vanilla-20260905-030000.tar.gz", 24 * time.Hour},
		{"vanilla-20260906-030000.tar.gz", 2 * time.Hour},
		{"vanilla-20260906-030000.tar.gz.sha256", 2 * time.Hour}, // sidecar, excluded
		{"notes.txt", time.Hour},                                 // not an archive
	}
	for _, f := range files {
		path := filepath.Join(dir, f.name)
		if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, now.Add(-f.age), now.Add(-f.age)); err != nil {
			t.Fatal(err)
		}
	}

	got, err := Latest(root, "vanilla")
	if err != nil {
		t.Fatalf("Latest: %v", err)
	}
	if got == nil {
		t.Fatal("Latest = nil, want a backup")
	}
	if got.Name != "vanilla-20260906-030000.tar.gz" {
		t.Errorf("Latest = %q, want the newest archive", got.Name)
	}

	if b, err := Latest(root, "does-not-exist"); err == nil || b != nil {
		t.Errorf("missing backup dir should return nil, err; got %v, %v", b, err)
	}
}

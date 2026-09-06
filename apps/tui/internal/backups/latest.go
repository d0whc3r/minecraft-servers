// Package backups reads the backup archives the repository's backup script
// produces under backups/<server>/.
package backups

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Backup is one archived world backup.
type Backup struct {
	Name    string
	ModTime time.Time
}

// Latest returns the newest .tar.gz archive for a server (checksum sidecars
// excluded), or nil when the server has no backups yet.
func Latest(root, server string) (*Backup, error) {
	entries, err := os.ReadDir(filepath.Join(root, "backups", server))
	if err != nil {
		return nil, err
	}
	var newest *Backup
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if newest == nil || info.ModTime().After(newest.ModTime) {
			newest = &Backup{Name: e.Name(), ModTime: info.ModTime()}
		}
	}
	return newest, nil
}

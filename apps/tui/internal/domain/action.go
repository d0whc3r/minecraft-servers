package domain

import "time"

// Action identifies one management operation, always delegated to the
// repository's management scripts.
type Action string

const (
	ActionStart    Action = "start"
	ActionStop     Action = "stop"
	ActionRestart  Action = "restart"
	ActionBackup   Action = "backup"
	ActionStartAll Action = "start-all"
	ActionStopAll  Action = "stop-all"
)

// Timeouts are generous ceilings: modpack downloads on first start and
// multi-GB backups can take a long time.
const (
	TimeoutStart    = 15 * time.Minute
	TimeoutStop     = 5 * time.Minute
	TimeoutRestart  = 15 * time.Minute
	TimeoutBackup   = 30 * time.Minute
	TimeoutStartAll = 60 * time.Minute
	TimeoutStopAll  = 30 * time.Minute
)

// Script maps an action to the management script that owns it, so the TUI
// never reimplements start/stop/backup logic.
func (a Action) Script() string {
	switch a {
	case ActionStart:
		return "start-server.sh"
	case ActionStop:
		return "stop-server.sh"
	case ActionRestart:
		return "restart-server.sh"
	case ActionBackup:
		return "backup.sh"
	case ActionStartAll:
		return "start-all.sh"
	case ActionStopAll:
		return "stop-all.sh"
	default:
		return ""
	}
}

// Timeout is the ceiling for the action's script run.
func (a Action) Timeout() time.Duration {
	switch a {
	case ActionStart:
		return TimeoutStart
	case ActionStop:
		return TimeoutStop
	case ActionRestart:
		return TimeoutRestart
	case ActionBackup:
		return TimeoutBackup
	case ActionStartAll:
		return TimeoutStartAll
	case ActionStopAll:
		return TimeoutStopAll
	default:
		return TimeoutStart
	}
}

// Verb renders the action for status lines, e.g. "start vanilla".
func (a Action) Verb(server string) string {
	if server == "" {
		return string(a)
	}
	return string(a) + " " + server
}

// Valid reports whether the action is one of the known operations.
func (a Action) Valid() bool {
	return a.Script() != ""
}

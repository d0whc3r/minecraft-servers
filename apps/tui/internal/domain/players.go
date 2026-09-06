package domain

import (
	"regexp"
	"strconv"
)

var playersRe = regexp.MustCompile(`There are (\d+)\s*(?:of a max of|/)\s*(\d+)`)

// PlayerCounts is the result of parsing rcon "list" output.
type PlayerCounts struct {
	Online int
	Max    int
}

// ParsePlayers reads the raw output of `rcon-cli list`. The itzg image
// answers "There are 0 of a max of 20 players online:"; newer servers use
// "There are 0/15 players online:". ok is false for any other text.
func ParsePlayers(raw string) (PlayerCounts, bool) {
	m := playersRe.FindStringSubmatch(raw)
	if m == nil {
		return PlayerCounts{}, false
	}
	online, err := strconv.Atoi(m[1])
	if err != nil {
		return PlayerCounts{}, false
	}
	max, err := strconv.Atoi(m[2])
	if err != nil {
		return PlayerCounts{}, false
	}
	return PlayerCounts{Online: online, Max: max}, true
}

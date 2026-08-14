package httpapi

import "strconv"

// parseLimit reads a list-limit query param, falling back to def when the
// param is missing or out of the 1..100 range.
func parseLimit(raw string, def int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 || n > 100 {
		return def
	}
	return n
}

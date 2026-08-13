// Package migrations embeds the SQL migration files.
package migrations

import "embed"

// FS holds all migration files.
//
//go:embed *.sql
var FS embed.FS

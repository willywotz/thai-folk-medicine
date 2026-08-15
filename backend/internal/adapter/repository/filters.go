package repository

import "github.com/jackc/pgx/v5/pgtype"

// searchFilter converts an optional search term into a nullable text arg for
// the sqlc.narg('search_term') filters shared by list queries.
func searchFilter(searchTerm *string) pgtype.Text {
	if searchTerm == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *searchTerm, Valid: true}
}

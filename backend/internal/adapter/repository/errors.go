package repository

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// isForeignKeyViolation reports whether err is a Postgres FK-violation (23503).
func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

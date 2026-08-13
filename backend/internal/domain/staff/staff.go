// Package staff holds the staff-user entity and repository interface.
// It imports no framework code.
package staff

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no staff user has the given username.
var ErrNotFound = errors.New("staff not found")

// Staff is one staff account that may add and edit records.
type Staff struct {
	ID           int64
	Username     string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// CreateParams holds the fields to create a staff user.
type CreateParams struct {
	Username     string
	Email        string
	PasswordHash string
}

// Repository stores and reads staff users.
type Repository interface {
	GetByUsername(ctx context.Context, username string) (Staff, error)
	Create(ctx context.Context, p CreateParams) (Staff, error)
	Count(ctx context.Context) (int64, error)
}

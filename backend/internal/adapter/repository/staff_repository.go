package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

// Staff stores and reads staff users in Postgres.
type Staff struct {
	q *db.Queries
}

// NewStaff builds the staff repository.
func NewStaff(q *db.Queries) *Staff {
	return &Staff{q: q}
}

func toStaff(row db.StaffUser) staff.Staff {
	return staff.Staff{
		ID:           row.ID,
		Username:     row.Username,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt.Time,
	}
}

// GetByUsername returns one staff user or staff.ErrNotFound.
func (r *Staff) GetByUsername(ctx context.Context, username string) (staff.Staff, error) {
	row, err := r.q.GetStaffByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return staff.Staff{}, staff.ErrNotFound
		}
		return staff.Staff{}, err
	}
	return toStaff(row), nil
}

// Create inserts a staff user.
func (r *Staff) Create(ctx context.Context, p staff.CreateParams) (staff.Staff, error) {
	row, err := r.q.CreateStaff(ctx, db.CreateStaffParams{
		Username:     p.Username,
		Email:        p.Email,
		PasswordHash: p.PasswordHash,
	})
	if err != nil {
		return staff.Staff{}, err
	}
	return toStaff(row), nil
}

// Count returns how many staff users exist.
func (r *Staff) Count(ctx context.Context) (int64, error) {
	return r.q.CountStaff(ctx)
}

package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

// Photo stores and reads photo rows in Postgres.
type Photo struct {
	q *db.Queries
}

// NewPhoto builds the photo repository.
func NewPhoto(q *db.Queries) *Photo {
	return &Photo{q: q}
}

func toPhoto(row db.Photo) photo.Photo {
	return photo.Photo{
		ID:        row.ID,
		OwnerType: row.OwnerType,
		OwnerID:   row.OwnerID,
		ObjectKey: row.ObjectKey,
		Caption:   row.Caption,
		CreatedAt: row.CreatedAt.Time,
	}
}

// Create inserts a photo row.
func (r *Photo) Create(ctx context.Context, p photo.CreateParams) (photo.Photo, error) {
	row, err := r.q.CreatePhoto(ctx, db.CreatePhotoParams{
		OwnerType: p.OwnerType,
		OwnerID:   p.OwnerID,
		ObjectKey: p.ObjectKey,
		Caption:   p.Caption,
	})
	if err != nil {
		return photo.Photo{}, err
	}
	return toPhoto(row), nil
}

// GetByID returns one photo row or photo.ErrNotFound.
func (r *Photo) GetByID(ctx context.Context, id int64) (photo.Photo, error) {
	row, err := r.q.GetPhoto(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return photo.Photo{}, photo.ErrNotFound
		}
		return photo.Photo{}, err
	}
	return toPhoto(row), nil
}

// Delete removes a photo row or returns photo.ErrNotFound.
func (r *Photo) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeletePhoto(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return photo.ErrNotFound
	}
	return nil
}

package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// Herb stores and reads herbs in Postgres.
type Herb struct {
	q *db.Queries
}

// NewHerb builds the herb repository.
func NewHerb(q *db.Queries) *Herb {
	return &Herb{q: q}
}

func toHerb(row db.Herb) herb.Herb {
	return herb.Herb{
		ID:             row.ID,
		NameThai:       row.NameThai,
		NameEnglish:    row.NameEnglish,
		ScientificName: row.ScientificName,
		Properties:     row.Properties,
		Description:    row.Description,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

// Create inserts a herb.
func (r *Herb) Create(ctx context.Context, p herb.CreateParams) (herb.Herb, error) {
	row, err := r.q.CreateHerb(ctx, db.CreateHerbParams{
		NameThai:       p.NameThai,
		NameEnglish:    p.NameEnglish,
		ScientificName: p.ScientificName,
		Properties:     p.Properties,
		Description:    p.Description,
	})
	if err != nil {
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// GetByID returns one herb or herb.ErrNotFound.
func (r *Herb) GetByID(ctx context.Context, id int64) (herb.Herb, error) {
	row, err := r.q.GetHerb(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return herb.Herb{}, herb.ErrNotFound
		}
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// ListPage returns one page of herbs, ordered by Thai name.
func (r *Herb) ListPage(ctx context.Context, p listing.Params) (listing.Page[herb.Herb], error) {
	rows, err := r.q.ListHerbPage(ctx, db.ListHerbPageParams{
		PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[herb.Herb]{}, err
	}
	total, err := r.q.CountHerbPage(ctx)
	if err != nil {
		return listing.Page[herb.Herb]{}, err
	}
	items := make([]herb.Herb, 0, len(rows))
	for _, row := range rows {
		items = append(items, toHerb(row))
	}
	return listing.Page[herb.Herb]{Items: items, Total: int(total)}, nil
}

// Count counts every herb.
func (r *Herb) Count(ctx context.Context) (int, error) {
	count, err := r.q.CountHerbPage(ctx)
	return int(count), err
}

// Update changes a herb or returns herb.ErrNotFound.
func (r *Herb) Update(ctx context.Context, p herb.UpdateParams) (herb.Herb, error) {
	row, err := r.q.UpdateHerb(ctx, db.UpdateHerbParams{
		ID:             p.ID,
		NameThai:       p.NameThai,
		NameEnglish:    p.NameEnglish,
		ScientificName: p.ScientificName,
		Properties:     p.Properties,
		Description:    p.Description,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return herb.Herb{}, herb.ErrNotFound
		}
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// Delete removes a herb, or returns herb.ErrNotFound / herb.ErrReferenced.
func (r *Herb) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteHerb(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return herb.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return herb.ErrNotFound
	}
	return nil
}

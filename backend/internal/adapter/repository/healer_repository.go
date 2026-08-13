package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// Healer stores and reads healers in Postgres.
type Healer struct {
	q *db.Queries
}

// NewHealer builds the healer repository.
func NewHealer(q *db.Queries) *Healer {
	return &Healer{q: q}
}

func toHealer(row db.Healer) healer.Healer {
	return healer.Healer{
		ID:          row.ID,
		DistrictID:  row.DistrictID,
		FullName:    row.FullName,
		SubDistrict: row.SubDistrict,
		Specialty:   row.Specialty,
		Biography:   row.Biography,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
}

// Create inserts a healer.
func (r *Healer) Create(ctx context.Context, p healer.CreateParams) (healer.Healer, error) {
	row, err := r.q.CreateHealer(ctx, db.CreateHealerParams{
		DistrictID:  p.DistrictID,
		FullName:    p.FullName,
		SubDistrict: p.SubDistrict,
		Specialty:   p.Specialty,
		Biography:   p.Biography,
	})
	if err != nil {
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// GetByID returns one healer or healer.ErrNotFound.
func (r *Healer) GetByID(ctx context.Context, id int64) (healer.Healer, error) {
	row, err := r.q.GetHealer(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return healer.Healer{}, healer.ErrNotFound
		}
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// ListByDistrict returns the healers in one district.
func (r *Healer) ListByDistrict(ctx context.Context, districtID int64) ([]healer.Healer, error) {
	rows, err := r.q.ListHealerByDistrict(ctx, districtID)
	if err != nil {
		return nil, err
	}
	result := make([]healer.Healer, 0, len(rows))
	for _, row := range rows {
		result = append(result, toHealer(row))
	}
	return result, nil
}

// Update changes a healer or returns healer.ErrNotFound.
func (r *Healer) Update(ctx context.Context, p healer.UpdateParams) (healer.Healer, error) {
	row, err := r.q.UpdateHealer(ctx, db.UpdateHealerParams{
		ID:          p.ID,
		DistrictID:  p.DistrictID,
		FullName:    p.FullName,
		SubDistrict: p.SubDistrict,
		Specialty:   p.Specialty,
		Biography:   p.Biography,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return healer.Healer{}, healer.ErrNotFound
		}
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// Delete removes a healer, or returns healer.ErrNotFound / healer.ErrReferenced.
func (r *Healer) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteHealer(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return healer.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return healer.ErrNotFound
	}
	return nil
}

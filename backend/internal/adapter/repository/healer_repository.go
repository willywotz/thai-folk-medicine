package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
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

// ListByDistrictPage returns one page of the healers in one district.
func (r *Healer) ListByDistrictPage(ctx context.Context, districtID int64, p listing.Params) (listing.Page[healer.Healer], error) {
	rows, err := r.q.ListHealerByDistrictPage(ctx, db.ListHealerByDistrictPageParams{
		DistrictID: districtID, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[healer.Healer]{}, err
	}
	total, err := r.q.CountHealerByDistrict(ctx, districtID)
	if err != nil {
		return listing.Page[healer.Healer]{}, err
	}
	items := make([]healer.Healer, 0, len(rows))
	for _, row := range rows {
		items = append(items, toHealer(row))
	}
	return listing.Page[healer.Healer]{Items: items, Total: int(total)}, nil
}

// ListPage returns one page of healers, optionally filtered by district.
func (r *Healer) ListPage(ctx context.Context, p listing.Params, districtID *int64) (listing.Page[healer.Healer], error) {
	arg := districtFilter(districtID)
	rows, err := r.q.ListHealer(ctx, db.ListHealerParams{
		DistrictID: arg, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[healer.Healer]{}, err
	}
	total, err := r.q.CountHealer(ctx, arg)
	if err != nil {
		return listing.Page[healer.Healer]{}, err
	}
	items := make([]healer.Healer, 0, len(rows))
	for _, row := range rows {
		items = append(items, toHealer(row))
	}
	return listing.Page[healer.Healer]{Items: items, Total: int(total)}, nil
}

func districtFilter(districtID *int64) pgtype.Int8 {
	if districtID == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *districtID, Valid: true}
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

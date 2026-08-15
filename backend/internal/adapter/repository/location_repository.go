// Package repository implements the domain repository interfaces on Postgres.
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

// Location reads provinces and districts from Postgres.
type Location struct {
	q *db.Queries
}

// NewLocation builds the location repository.
func NewLocation(q *db.Queries) *Location {
	return &Location{q: q}
}

// ListProvince returns every province.
func (r *Location) ListProvince(ctx context.Context) ([]location.Province, error) {
	rows, err := r.q.ListProvince(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]location.Province, 0, len(rows))
	for _, row := range rows {
		result = append(result, location.Province{
			ID:          row.ID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
		})
	}
	return result, nil
}

// ListDistrictByProvince returns the districts of one province.
func (r *Location) ListDistrictByProvince(ctx context.Context, provinceID int64) ([]location.District, error) {
	rows, err := r.q.ListDistrictByProvince(ctx, provinceID)
	if err != nil {
		return nil, err
	}

	result := make([]location.District, 0, len(rows))
	for _, row := range rows {
		result = append(result, location.District{
			ID:          row.ID,
			ProvinceID:  row.ProvinceID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
		})
	}
	return result, nil
}

// GetDistrict returns one district or location.ErrNotFound.
func (r *Location) GetDistrict(ctx context.Context, id int64) (location.District, error) {
	row, err := r.q.GetDistrict(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return location.District{}, location.ErrNotFound
		}
		return location.District{}, err
	}

	return location.District{
		ID:          row.ID,
		ProvinceID:  row.ProvinceID,
		NameThai:    row.NameThai,
		NameEnglish: row.NameEnglish,
	}, nil
}

func toProvince(row db.Province) location.Province {
	return location.Province{ID: row.ID, NameThai: row.NameThai, NameEnglish: row.NameEnglish}
}

// GetProvince returns one province or location.ErrProvinceNotFound.
func (r *Location) GetProvince(ctx context.Context, id int64) (location.Province, error) {
	row, err := r.q.GetProvince(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return location.Province{}, location.ErrProvinceNotFound
		}
		return location.Province{}, err
	}
	return toProvince(row), nil
}

// CreateProvince inserts a province.
func (r *Location) CreateProvince(ctx context.Context, nameThai, nameEnglish string) (location.Province, error) {
	row, err := r.q.CreateProvince(ctx, db.CreateProvinceParams{NameThai: nameThai, NameEnglish: nameEnglish})
	if err != nil {
		return location.Province{}, err
	}
	return toProvince(row), nil
}

// UpdateProvince changes a province or returns location.ErrProvinceNotFound.
func (r *Location) UpdateProvince(ctx context.Context, id int64, nameThai, nameEnglish string) (location.Province, error) {
	row, err := r.q.UpdateProvince(ctx, db.UpdateProvinceParams{ID: id, NameThai: nameThai, NameEnglish: nameEnglish})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return location.Province{}, location.ErrProvinceNotFound
		}
		return location.Province{}, err
	}
	return toProvince(row), nil
}

// DeleteProvince removes a province, or returns location.ErrProvinceNotFound / location.ErrProvinceReferenced.
func (r *Location) DeleteProvince(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteProvince(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return location.ErrProvinceReferenced
		}
		return err
	}
	if rows == 0 {
		return location.ErrProvinceNotFound
	}
	return nil
}

// CountDistrictByProvince counts the districts of one province.
func (r *Location) CountDistrictByProvince(ctx context.Context, provinceID int64) (int, error) {
	count, err := r.q.CountDistrictByProvince(ctx, provinceID)
	return int(count), err
}

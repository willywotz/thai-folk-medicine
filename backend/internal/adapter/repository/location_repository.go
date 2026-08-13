// Package repository implements the domain repository interfaces on Postgres.
package repository

import (
	"context"

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

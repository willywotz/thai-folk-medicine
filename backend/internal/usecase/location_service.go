// Package usecase holds the application services. It depends on the domain
// interfaces only, never on Gin, pgx, or sqlc code.
package usecase

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

// LocationService reads provinces and districts.
type LocationService struct {
	repo location.Repository
}

// NewLocationService builds the location service.
func NewLocationService(repo location.Repository) *LocationService {
	return &LocationService{repo: repo}
}

// ListProvince returns every province.
func (s *LocationService) ListProvince(ctx context.Context) ([]location.Province, error) {
	return s.repo.ListProvince(ctx)
}

// ListDistrictByProvince returns the districts of one province.
func (s *LocationService) ListDistrictByProvince(ctx context.Context, provinceID int64) ([]location.District, error) {
	return s.repo.ListDistrictByProvince(ctx, provinceID)
}

// GetDistrict returns one district or location.ErrNotFound.
func (s *LocationService) GetDistrict(ctx context.Context, id int64) (location.District, error) {
	return s.repo.GetDistrict(ctx, id)
}

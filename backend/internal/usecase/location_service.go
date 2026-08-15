// Package usecase holds the application services. It depends on the domain
// interfaces only, never on Gin, pgx, or sqlc code.
package usecase

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

// LocationService reads and changes provinces and districts, publishing events on write.
type LocationService struct {
	repo      location.Repository
	publisher Publisher
}

// NewLocationService builds the location service.
func NewLocationService(repo location.Repository, publisher Publisher) *LocationService {
	return &LocationService{repo: repo, publisher: publisher}
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

// GetProvince returns one province or location.ErrProvinceNotFound.
func (s *LocationService) GetProvince(ctx context.Context, id int64) (location.Province, error) {
	return s.repo.GetProvince(ctx, id)
}

// CreateProvince stores a province, then publishes ProvinceCreatedEvent.
func (s *LocationService) CreateProvince(ctx context.Context, nameThai, nameEnglish string) (location.Province, error) {
	created, err := s.repo.CreateProvince(ctx, nameThai, nameEnglish)
	if err != nil {
		return location.Province{}, err
	}
	s.publisher.Publish(ctx, location.ProvinceCreatedEvent{
		ProvinceID: created.ID, NameThai: created.NameThai, NameEnglish: created.NameEnglish,
	})
	return created, nil
}

// UpdateProvince changes a province, then publishes ProvinceUpdatedEvent.
func (s *LocationService) UpdateProvince(ctx context.Context, id int64, nameThai, nameEnglish string) (location.Province, error) {
	updated, err := s.repo.UpdateProvince(ctx, id, nameThai, nameEnglish)
	if err != nil {
		return location.Province{}, err
	}
	s.publisher.Publish(ctx, location.ProvinceUpdatedEvent{
		ProvinceID: updated.ID, NameThai: updated.NameThai, NameEnglish: updated.NameEnglish,
	})
	return updated, nil
}

// DeleteProvince removes a province, then publishes ProvinceDeletedEvent. It
// returns location.ErrProvinceReferenced if the province still has districts.
func (s *LocationService) DeleteProvince(ctx context.Context, id int64) error {
	count, err := s.repo.CountDistrictByProvince(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return location.ErrProvinceReferenced
	}
	if err := s.repo.DeleteProvince(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, location.ProvinceDeletedEvent{ProvinceID: id})
	return nil
}

// CreateDistrict stores a district, then publishes DistrictCreatedEvent.
func (s *LocationService) CreateDistrict(ctx context.Context, provinceID int64, nameThai, nameEnglish string) (location.District, error) {
	created, err := s.repo.CreateDistrict(ctx, provinceID, nameThai, nameEnglish)
	if err != nil {
		return location.District{}, err
	}
	s.publisher.Publish(ctx, location.DistrictCreatedEvent{
		DistrictID: created.ID, ProvinceID: created.ProvinceID, NameThai: created.NameThai, NameEnglish: created.NameEnglish,
	})
	return created, nil
}

// UpdateDistrict changes a district, then publishes DistrictUpdatedEvent.
func (s *LocationService) UpdateDistrict(ctx context.Context, id int64, nameThai, nameEnglish string) (location.District, error) {
	updated, err := s.repo.UpdateDistrict(ctx, id, nameThai, nameEnglish)
	if err != nil {
		return location.District{}, err
	}
	s.publisher.Publish(ctx, location.DistrictUpdatedEvent{
		DistrictID: updated.ID, ProvinceID: updated.ProvinceID, NameThai: updated.NameThai, NameEnglish: updated.NameEnglish,
	})
	return updated, nil
}

// DeleteDistrict removes a district, then publishes DistrictDeletedEvent. It
// returns location.ErrDistrictReferenced if the district still has healers.
func (s *LocationService) DeleteDistrict(ctx context.Context, id int64) error {
	count, err := s.repo.CountHealerByDistrict(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return location.ErrDistrictReferenced
	}
	if err := s.repo.DeleteDistrict(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, location.DistrictDeletedEvent{DistrictID: id})
	return nil
}

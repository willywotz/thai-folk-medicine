package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// ErrInvalidHealer means the healer input failed validation.
var ErrInvalidHealer = errors.New("invalid healer")

// HealerService creates, reads, and changes healers, publishing events on write.
type HealerService struct {
	repo      healer.Repository
	publisher Publisher
}

// NewHealerService builds the healer service.
func NewHealerService(repo healer.Repository, publisher Publisher) *HealerService {
	return &HealerService{repo: repo, publisher: publisher}
}

// Create validates and stores a healer, then publishes CreatedEvent.
func (s *HealerService) Create(ctx context.Context, p healer.CreateParams) (healer.Healer, error) {
	if strings.TrimSpace(p.FullName) == "" || p.DistrictID <= 0 {
		return healer.Healer{}, ErrInvalidHealer
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return healer.Healer{}, err
	}
	s.publisher.Publish(ctx, healer.CreatedEvent{HealerID: created.ID})
	return created, nil
}

// Get returns one healer.
func (s *HealerService) Get(ctx context.Context, id int64) (healer.Healer, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByDistrict returns the healers in one district.
func (s *HealerService) ListByDistrict(ctx context.Context, districtID int64) ([]healer.Healer, error) {
	return s.repo.ListByDistrict(ctx, districtID)
}

// Update validates and changes a healer, then publishes UpdatedEvent.
func (s *HealerService) Update(ctx context.Context, p healer.UpdateParams) (healer.Healer, error) {
	if strings.TrimSpace(p.FullName) == "" || p.DistrictID <= 0 {
		return healer.Healer{}, ErrInvalidHealer
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return healer.Healer{}, err
	}
	s.publisher.Publish(ctx, healer.UpdatedEvent{HealerID: updated.ID})
	return updated, nil
}

// Delete removes a healer, then publishes DeletedEvent.
func (s *HealerService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, healer.DeletedEvent{HealerID: id})
	return nil
}

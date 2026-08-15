package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrInvalidHerb means the herb input failed validation.
var ErrInvalidHerb = errors.New("invalid herb")

// HerbService creates, reads, and changes herbs, publishing events on write.
type HerbService struct {
	repo      herb.Repository
	publisher Publisher
}

// NewHerbService builds the herb service.
func NewHerbService(repo herb.Repository, publisher Publisher) *HerbService {
	return &HerbService{repo: repo, publisher: publisher}
}

// Create validates and stores a herb, then publishes CreatedEvent.
func (s *HerbService) Create(ctx context.Context, p herb.CreateParams) (herb.Herb, error) {
	if strings.TrimSpace(p.NameThai) == "" {
		return herb.Herb{}, ErrInvalidHerb
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return herb.Herb{}, err
	}
	s.publisher.Publish(ctx, herb.CreatedEvent{HerbID: created.ID})
	return created, nil
}

// Get returns one herb.
func (s *HerbService) Get(ctx context.Context, id int64) (herb.Herb, error) {
	return s.repo.GetByID(ctx, id)
}

// ListPage returns one paginated page of herbs, ordered by Thai name.
func (s *HerbService) ListPage(ctx context.Context, p listing.Params) (listing.Page[herb.Herb], error) {
	return s.repo.ListPage(ctx, p)
}

// Update validates and changes a herb, then publishes UpdatedEvent.
func (s *HerbService) Update(ctx context.Context, p herb.UpdateParams) (herb.Herb, error) {
	if strings.TrimSpace(p.NameThai) == "" {
		return herb.Herb{}, ErrInvalidHerb
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return herb.Herb{}, err
	}
	s.publisher.Publish(ctx, herb.UpdatedEvent{HerbID: updated.ID})
	return updated, nil
}

// Delete removes a herb, then publishes DeletedEvent.
func (s *HerbService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, herb.DeletedEvent{HerbID: id})
	return nil
}

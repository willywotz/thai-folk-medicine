package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// ErrInvalidRemedy means the remedy input failed validation.
var ErrInvalidRemedy = errors.New("invalid remedy")

// RemedyService creates, reads, and changes remedies, publishing events on write.
type RemedyService struct {
	repo      remedy.Repository
	publisher Publisher
}

// NewRemedyService builds the remedy service.
func NewRemedyService(repo remedy.Repository, publisher Publisher) *RemedyService {
	return &RemedyService{repo: repo, publisher: publisher}
}

// Create validates and stores a remedy, then publishes CreatedEvent.
func (s *RemedyService) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	if strings.TrimSpace(p.Name) == "" || p.HealerID <= 0 {
		return remedy.Remedy{}, ErrInvalidRemedy
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return remedy.Remedy{}, err
	}
	s.publisher.Publish(ctx, remedy.CreatedEvent{RemedyID: created.ID})
	return created, nil
}

// Get returns one remedy.
func (s *RemedyService) Get(ctx context.Context, id int64) (remedy.Remedy, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByHealerPage returns one page of the remedies of one healer.
func (s *RemedyService) ListByHealerPage(ctx context.Context, healerID int64, p listing.Params) (listing.Page[remedy.Remedy], error) {
	return s.repo.ListByHealerPage(ctx, healerID, p)
}

// ListPage returns one paginated page of remedies, most recent first.
func (s *RemedyService) ListPage(ctx context.Context, p listing.Params) (listing.Page[remedy.Remedy], error) {
	return s.repo.ListPage(ctx, p)
}

// Update validates and changes a remedy, then publishes UpdatedEvent.
func (s *RemedyService) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	if strings.TrimSpace(p.Name) == "" || p.HealerID <= 0 {
		return remedy.Remedy{}, ErrInvalidRemedy
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return remedy.Remedy{}, err
	}
	s.publisher.Publish(ctx, remedy.UpdatedEvent{RemedyID: updated.ID})
	return updated, nil
}

// Delete removes a remedy, then publishes DeletedEvent.
func (s *RemedyService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, remedy.DeletedEvent{RemedyID: id})
	return nil
}

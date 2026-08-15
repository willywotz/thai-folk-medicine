package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// ErrInvalidTreatmentCase means the case input failed validation.
var ErrInvalidTreatmentCase = errors.New("invalid treatment case")

// TreatmentCaseService creates, reads, and changes cases, publishing events on write.
type TreatmentCaseService struct {
	repo      treatmentcase.Repository
	publisher Publisher
}

// NewTreatmentCaseService builds the treatment-case service.
func NewTreatmentCaseService(repo treatmentcase.Repository, publisher Publisher) *TreatmentCaseService {
	return &TreatmentCaseService{repo: repo, publisher: publisher}
}

// Create validates and stores a case, then publishes CreatedEvent.
func (s *TreatmentCaseService) Create(ctx context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	if p.RemedyID <= 0 || p.HealerID <= 0 || p.PatientAge < 0 || strings.TrimSpace(p.PatientSex) == "" {
		return treatmentcase.TreatmentCase{}, ErrInvalidTreatmentCase
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	s.publisher.Publish(ctx, treatmentcase.CreatedEvent{TreatmentCaseID: created.ID})
	return created, nil
}

// Get returns one case.
func (s *TreatmentCaseService) Get(ctx context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByRemedyPage returns one page of cases for one remedy.
func (s *TreatmentCaseService) ListByRemedyPage(ctx context.Context, remedyID int64, p listing.Params) (listing.Page[treatmentcase.TreatmentCase], error) {
	return s.repo.ListByRemedyPage(ctx, remedyID, p)
}

// ListPage returns one page of the most recently treated cases.
func (s *TreatmentCaseService) ListPage(ctx context.Context, p listing.Params) (listing.Page[treatmentcase.TreatmentCase], error) {
	return s.repo.ListPage(ctx, p)
}

// Update validates and changes a case, then publishes UpdatedEvent.
func (s *TreatmentCaseService) Update(ctx context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	if p.RemedyID <= 0 || p.HealerID <= 0 || p.PatientAge < 0 || strings.TrimSpace(p.PatientSex) == "" {
		return treatmentcase.TreatmentCase{}, ErrInvalidTreatmentCase
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	s.publisher.Publish(ctx, treatmentcase.UpdatedEvent{TreatmentCaseID: updated.ID})
	return updated, nil
}

// Delete removes a case, then publishes DeletedEvent.
func (s *TreatmentCaseService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, treatmentcase.DeletedEvent{TreatmentCaseID: id})
	return nil
}

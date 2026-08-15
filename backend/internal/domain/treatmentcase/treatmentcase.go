// Package treatmentcase holds the treatment-case entity, its events, and
// repository interface. It imports no framework code. A case stores only
// patient age and sex — no patient identity (spec privacy choice A).
package treatmentcase

import (
	"context"
	"errors"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrNotFound means no treatment case has the given id.
var ErrNotFound = errors.New("treatment case not found")

// TreatmentCase records the use of a remedy on a patient.
type TreatmentCase struct {
	ID         int64
	RemedyID   int64
	HealerID   int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// CreateParams holds the fields to create a treatment case.
type CreateParams struct {
	RemedyID   int64
	HealerID   int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
}

// UpdateParams holds the fields to update a treatment case.
type UpdateParams struct {
	ID         int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
}

// Repository stores and reads treatment cases.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (TreatmentCase, error)
	GetByID(ctx context.Context, id int64) (TreatmentCase, error)
	ListByRemedyPage(ctx context.Context, remedyID int64, p listing.Params) (listing.Page[TreatmentCase], error)
	ListPage(ctx context.Context, p listing.Params) (listing.Page[TreatmentCase], error)
	Update(ctx context.Context, p UpdateParams) (TreatmentCase, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a case is created.
type CreatedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "treatmentcase.created" }

// UpdatedEvent is published after a case is updated.
type UpdatedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "treatmentcase.updated" }

// DeletedEvent is published after a case is deleted.
type DeletedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "treatmentcase.deleted" }

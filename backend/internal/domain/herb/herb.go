// Package herb holds the herb (สมุนไพร) entity and its ports.
package herb

import (
	"context"
	"errors"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrNotFound means no herb has the given id.
var ErrNotFound = errors.New("herb not found")

// ErrReferenced means the herb is still used by a remedy and cannot be deleted.
var ErrReferenced = errors.New("herb is referenced by other records")

// Herb is one medicinal herb (สมุนไพร).
type Herb struct {
	ID             int64
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// CreateParams holds the fields to create a herb.
type CreateParams struct {
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
}

// ListQuery selects and pages herbs for public browse.
type ListQuery struct {
	Page  listing.Params
	Query string
}

// UpdateParams holds the fields to update a herb.
type UpdateParams struct {
	ID             int64
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
}

// Repository stores and reads herbs.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Herb, error)
	GetByID(ctx context.Context, id int64) (Herb, error)
	ListPage(ctx context.Context, q ListQuery) (listing.Page[Herb], error)
	Update(ctx context.Context, p UpdateParams) (Herb, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a herb is created.
type CreatedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "herb.created" }

// UpdatedEvent is published after a herb is updated.
type UpdatedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "herb.updated" }

// DeletedEvent is published after a herb is deleted.
type DeletedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "herb.deleted" }

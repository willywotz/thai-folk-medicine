// Package remedy holds the remedy entity, its events, and repository interface.
// It imports no framework code.
package remedy

import (
	"context"
	"errors"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrNotFound means no remedy has the given id.
var ErrNotFound = errors.New("remedy not found")

// ErrReferenced means the remedy still has treatment cases and cannot be deleted.
var ErrReferenced = errors.New("remedy is referenced by other records")

// HerbRef links a remedy to a herb with an amount (write side).
type HerbRef struct {
	HerbID int64
	Amount string
}

// HerbLink is a herb linked to a remedy, with display names (read side).
type HerbLink struct {
	HerbID      int64
	NameThai    string
	NameEnglish string
	Amount      string
}

// Remedy is one folk-medicine remedy (ตำรับยา) of a healer.
type Remedy struct {
	ID                int64
	HealerID          int64
	Name              string
	Symptoms          string
	PreparationMethod string
	Usage             string
	Note              string
	Herbs             []HerbLink
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// CreateParams holds the fields to create a remedy.
type CreateParams struct {
	HealerID          int64
	Name              string
	Symptoms          string
	PreparationMethod string
	Usage             string
	Note              string
	Herbs             []HerbRef
}

// UpdateParams holds the fields to update a remedy.
type UpdateParams struct {
	ID                int64
	HealerID          int64
	Name              string
	Symptoms          string
	PreparationMethod string
	Usage             string
	Note              string
	Herbs             []HerbRef
}

// Repository stores and reads remedies.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Remedy, error)
	GetByID(ctx context.Context, id int64) (Remedy, error)
	ListByHealerPage(ctx context.Context, healerID int64, p listing.Params) (listing.Page[Remedy], error)
	ListByHerbPage(ctx context.Context, herbID int64, p listing.Params) (listing.Page[Remedy], error)
	ListPage(ctx context.Context, p listing.Params) (listing.Page[Remedy], error)
	Update(ctx context.Context, p UpdateParams) (Remedy, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a remedy is created.
type CreatedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "remedy.created" }

// UpdatedEvent is published after a remedy is updated.
type UpdatedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "remedy.updated" }

// DeletedEvent is published after a remedy is deleted.
type DeletedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "remedy.deleted" }

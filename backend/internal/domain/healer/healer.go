// Package healer holds the healer entity, its events, and repository interface.
// It imports no framework code.
package healer

import (
	"context"
	"errors"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrNotFound means no healer has the given id.
var ErrNotFound = errors.New("healer not found")

// ErrReferenced means the healer still has remedies or cases and cannot be deleted.
var ErrReferenced = errors.New("healer is referenced by other records")

// Healer is one local folk-medicine healer (หมอพื้นบ้าน).
type Healer struct {
	ID          int64
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// CreateParams holds the fields to create a healer.
type CreateParams struct {
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
}

// UpdateParams holds the fields to update a healer.
type UpdateParams struct {
	ID          int64
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
}

// Repository stores and reads healers.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Healer, error)
	GetByID(ctx context.Context, id int64) (Healer, error)
	ListByDistrictPage(ctx context.Context, districtID int64, p listing.Params) (listing.Page[Healer], error)
	Update(ctx context.Context, p UpdateParams) (Healer, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a healer is created.
type CreatedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "healer.created" }

// UpdatedEvent is published after a healer is updated.
type UpdatedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "healer.updated" }

// DeletedEvent is published after a healer is deleted.
type DeletedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "healer.deleted" }

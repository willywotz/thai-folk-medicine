// Package photo holds the photo entity, its store port, events, and repository
// interface. It imports only stdlib (context, errors, io, time).
package photo

import (
	"context"
	"errors"
	"io"
	"time"
)

// Owner-type values. A photo belongs to a healer, a remedy, or a case.
const (
	OwnerHealer = "healer"
	OwnerRemedy = "remedy"
	OwnerCase   = "case"
)

// ErrNotFound means no photo has the given id.
var ErrNotFound = errors.New("photo not found")

// ValidOwnerType reports whether t is a known owner type.
func ValidOwnerType(t string) bool {
	return t == OwnerHealer || t == OwnerRemedy || t == OwnerCase
}

// Photo is one stored image linked to a healer, remedy, or case.
type Photo struct {
	ID        int64
	OwnerType string
	OwnerID   int64
	ObjectKey string
	Caption   string
	CreatedAt time.Time
}

// CreateParams holds the fields to create a photo row.
type CreateParams struct {
	OwnerType string
	OwnerID   int64
	ObjectKey string
	Caption   string
}

// Repository stores and reads photo rows (not the bytes).
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Photo, error)
	GetByID(ctx context.Context, id int64) (Photo, error)
	Delete(ctx context.Context, id int64) error
	ListByOwner(ctx context.Context, ownerType string, ownerID int64) ([]Photo, error)
}

// Store keeps the image bytes. The object key identifies a stored file.
type Store interface {
	Save(ctx context.Context, r io.Reader, ext string) (objectKey string, err error)
	Open(ctx context.Context, objectKey string) (io.ReadCloser, error)
	Delete(ctx context.Context, objectKey string) error
}

// CreatedEvent is published after a photo is stored.
type CreatedEvent struct{ PhotoID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "photo.created" }

// DeletedEvent is published after a photo is deleted.
type DeletedEvent struct{ PhotoID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "photo.deleted" }

package usecase

import (
	"context"
	"errors"
	"io"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

// ErrInvalidPhoto means the photo input failed validation.
var ErrInvalidPhoto = errors.New("invalid photo")

// PhotoService stores photo bytes and rows, publishing events on write.
type PhotoService struct {
	repo      photo.Repository
	store     photo.Store
	publisher Publisher
}

// NewPhotoService builds the photo service.
func NewPhotoService(repo photo.Repository, store photo.Store, publisher Publisher) *PhotoService {
	return &PhotoService{repo: repo, store: store, publisher: publisher}
}

// Upload stores the bytes, writes the row, and publishes CreatedEvent.
func (s *PhotoService) Upload(ctx context.Context, ownerType string, ownerID int64, r io.Reader, ext, caption string) (photo.Photo, error) {
	if !photo.ValidOwnerType(ownerType) || ownerID <= 0 {
		return photo.Photo{}, ErrInvalidPhoto
	}
	objectKey, err := s.store.Save(ctx, r, ext)
	if err != nil {
		return photo.Photo{}, err
	}
	created, err := s.repo.Create(ctx, photo.CreateParams{
		OwnerType: ownerType,
		OwnerID:   ownerID,
		ObjectKey: objectKey,
		Caption:   caption,
	})
	if err != nil {
		_ = s.store.Delete(ctx, objectKey) // best-effort cleanup
		return photo.Photo{}, err
	}
	s.publisher.Publish(ctx, photo.CreatedEvent{PhotoID: created.ID})
	return created, nil
}

// Get returns one photo row.
func (s *PhotoService) Get(ctx context.Context, id int64) (photo.Photo, error) {
	return s.repo.GetByID(ctx, id)
}

// OpenFile opens the stored bytes for a photo.
func (s *PhotoService) OpenFile(ctx context.Context, p photo.Photo) (io.ReadCloser, error) {
	return s.store.Open(ctx, p.ObjectKey)
}

// ListByOwner returns the photos of one owner after validating the owner type.
func (s *PhotoService) ListByOwner(ctx context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	if !photo.ValidOwnerType(ownerType) || ownerID <= 0 {
		return nil, ErrInvalidPhoto
	}
	return s.repo.ListByOwner(ctx, ownerType, ownerID)
}

// Delete removes the row and the file, then publishes DeletedEvent.
func (s *PhotoService) Delete(ctx context.Context, id int64) error {
	found, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	_ = s.store.Delete(ctx, found.ObjectKey) // best-effort; row is the source of truth
	s.publisher.Publish(ctx, photo.DeletedEvent{PhotoID: id})
	return nil
}

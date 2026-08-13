package usecase

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

type fakePhotoRepo struct {
	created   photo.Photo
	getErr    error
	createErr error
}

func (f *fakePhotoRepo) Create(_ context.Context, p photo.CreateParams) (photo.Photo, error) {
	if f.createErr != nil {
		return photo.Photo{}, f.createErr
	}
	f.created = photo.Photo{ID: 1, OwnerType: p.OwnerType, OwnerID: p.OwnerID, ObjectKey: p.ObjectKey}
	return f.created, nil
}
func (f *fakePhotoRepo) GetByID(_ context.Context, id int64) (photo.Photo, error) {
	if f.getErr != nil {
		return photo.Photo{}, f.getErr
	}
	return photo.Photo{ID: id, ObjectKey: "k.jpg"}, nil
}
func (f *fakePhotoRepo) Delete(context.Context, int64) error { return nil }
func (f *fakePhotoRepo) ListByOwner(_ context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	return []photo.Photo{{ID: 1, OwnerType: ownerType, OwnerID: ownerID}}, nil
}

type fakeStore struct {
	saved   string
	deleted string
	saveErr error
}

func (f *fakeStore) Save(_ context.Context, _ io.Reader, ext string) (string, error) {
	if f.saveErr != nil {
		return "", f.saveErr
	}
	f.saved = "obj" + ext
	return f.saved, nil
}
func (f *fakeStore) Open(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewBufferString("bytes")), nil
}
func (f *fakeStore) Delete(_ context.Context, key string) error { f.deleted = key; return nil }

type photoRecorder struct{ events []event.Event }

func (r *photoRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func TestUploadStoresAndPublishes(t *testing.T) {
	repo := &fakePhotoRepo{}
	store := &fakeStore{}
	pub := &photoRecorder{}
	service := NewPhotoService(repo, store, pub)

	got, err := service.Upload(context.Background(), photo.OwnerHealer, 3, bytes.NewBufferString("img"), ".jpg", "cap")

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	assert.Equal(t, "obj.jpg", store.saved)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "photo.created", pub.events[0].EventName())
}

func TestUploadRejectsBadOwnerType(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.Upload(context.Background(), "district", 3, bytes.NewBufferString("x"), ".jpg", "")
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestUploadRejectsBadOwnerID(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.Upload(context.Background(), photo.OwnerRemedy, 0, bytes.NewBufferString("x"), ".jpg", "")
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestUploadDeletesFileWhenRowFails(t *testing.T) {
	store := &fakeStore{}
	service := NewPhotoService(&fakePhotoRepo{createErr: errors.New("db")}, store, &photoRecorder{})

	_, err := service.Upload(context.Background(), photo.OwnerHealer, 3, bytes.NewBufferString("x"), ".jpg", "")

	require.Error(t, err)
	assert.Equal(t, "obj.jpg", store.deleted, "file should be cleaned up when the row write fails")
}

func TestListByOwnerRejectsBadOwnerType(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.ListByOwner(context.Background(), "district", 1)
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestDeletePublishesEvent(t *testing.T) {
	pub := &photoRecorder{}
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, pub)

	require.NoError(t, service.Delete(context.Background(), 5))

	require.Len(t, pub.events, 1)
	assert.Equal(t, "photo.deleted", pub.events[0].EventName())
}

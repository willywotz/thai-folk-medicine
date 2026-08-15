package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

type fakeHealerRepo struct {
	created    healer.Healer
	createErr  error
	deleteErr  error
	updateErr  error
	lastCreate healer.CreateParams

	lastListDistrictID *int64
}

func (f *fakeHealerRepo) Create(_ context.Context, p healer.CreateParams) (healer.Healer, error) {
	f.lastCreate = p
	if f.createErr != nil {
		return healer.Healer{}, f.createErr
	}
	f.created = healer.Healer{ID: 1, DistrictID: p.DistrictID, FullName: p.FullName}
	return f.created, nil
}
func (f *fakeHealerRepo) GetByID(context.Context, int64) (healer.Healer, error) {
	return f.created, nil
}
func (f *fakeHealerRepo) ListByDistrictPage(context.Context, int64, listing.Params) (listing.Page[healer.Healer], error) {
	return listing.Page[healer.Healer]{Items: []healer.Healer{f.created}, Total: 1}, nil
}
func (f *fakeHealerRepo) ListPage(_ context.Context, _ listing.Params, districtID *int64) (listing.Page[healer.Healer], error) {
	f.lastListDistrictID = districtID
	return listing.Page[healer.Healer]{Items: []healer.Healer{f.created}, Total: 1}, nil
}
func (f *fakeHealerRepo) Update(_ context.Context, p healer.UpdateParams) (healer.Healer, error) {
	if f.updateErr != nil {
		return healer.Healer{}, f.updateErr
	}
	return healer.Healer{ID: p.ID, FullName: p.FullName}, nil
}
func (f *fakeHealerRepo) Delete(context.Context, int64) error { return f.deleteErr }

type recordingPublisher struct{ events []event.Event }

func (r *recordingPublisher) Publish(_ context.Context, e event.Event) {
	r.events = append(r.events, e)
}

func TestCreateHealerPublishesCreatedEvent(t *testing.T) {
	repo := &fakeHealerRepo{}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	got, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "หมอ ก"})

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.created", pub.events[0].EventName())
}

func TestCreateHealerRejectsEmptyName(t *testing.T) {
	repo := &fakeHealerRepo{}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "  "})

	assert.ErrorIs(t, err, ErrInvalidHealer)
	assert.Empty(t, pub.events, "no event on validation failure")
}

func TestCreateHealerRejectsBadDistrict(t *testing.T) {
	service := NewHealerService(&fakeHealerRepo{}, &recordingPublisher{})

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 0, FullName: "หมอ"})

	assert.ErrorIs(t, err, ErrInvalidHealer)
}

func TestCreateHealerNoEventOnRepoError(t *testing.T) {
	repo := &fakeHealerRepo{createErr: errors.New("db down")}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "หมอ"})

	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestDeleteHealerPublishesDeletedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewHealerService(&fakeHealerRepo{}, pub)

	require.NoError(t, service.Delete(context.Background(), 5))

	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.deleted", pub.events[0].EventName())
}

func TestListHealerPageForwardsDistrictFilter(t *testing.T) {
	repo := &fakeHealerRepo{created: healer.Healer{ID: 1, FullName: "หมอ ก"}}
	service := NewHealerService(repo, &recordingPublisher{})
	districtID := int64(9)

	page, err := service.List(context.Background(), listing.Params{Limit: 12}, &districtID)

	require.NoError(t, err)
	assert.Equal(t, 1, page.Total)
	require.NotNil(t, repo.lastListDistrictID)
	assert.Equal(t, districtID, *repo.lastListDistrictID)
}

func TestUpdateHealerPublishesUpdatedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewHealerService(&fakeHealerRepo{}, pub)

	_, err := service.Update(context.Background(), healer.UpdateParams{ID: 5, DistrictID: 2, FullName: "หมอ"})

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.updated", pub.events[0].EventName())
}

package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

type fakeRemedyRepo struct {
	createErr error
	deleteErr error
}

func (f *fakeRemedyRepo) Create(_ context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	if f.createErr != nil {
		return remedy.Remedy{}, f.createErr
	}
	return remedy.Remedy{ID: 1, HealerID: p.HealerID, Name: p.Name}, nil
}
func (f *fakeRemedyRepo) GetByID(context.Context, int64) (remedy.Remedy, error) {
	return remedy.Remedy{ID: 1}, nil
}
func (f *fakeRemedyRepo) ListByHealerPage(context.Context, int64, listing.Params) (listing.Page[remedy.Remedy], error) {
	return listing.Page[remedy.Remedy]{Items: []remedy.Remedy{{ID: 1}}, Total: 1}, nil
}
func (f *fakeRemedyRepo) ListByHerbPage(context.Context, int64, listing.Params) (listing.Page[remedy.Remedy], error) {
	return listing.Page[remedy.Remedy]{Items: []remedy.Remedy{{ID: 1}}, Total: 1}, nil
}
func (f *fakeRemedyRepo) ListPage(context.Context, remedy.ListQuery) (listing.Page[remedy.Remedy], error) {
	return listing.Page[remedy.Remedy]{Items: []remedy.Remedy{{ID: 1}}, Total: 1}, nil
}
func (f *fakeRemedyRepo) Update(_ context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	return remedy.Remedy{ID: p.ID, Name: p.Name}, nil
}
func (f *fakeRemedyRepo) Delete(context.Context, int64) error { return f.deleteErr }

type remedyRecorder struct{ events []event.Event }

func (r *remedyRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func TestCreateRemedyPublishesEvent(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{}, pub)

	got, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: "ยา"})

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "remedy.created", pub.events[0].EventName())
}

func TestCreateRemedyRejectsEmptyName(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{}, pub)

	_, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: " "})

	assert.ErrorIs(t, err, ErrInvalidRemedy)
	assert.Empty(t, pub.events)
}

func TestCreateRemedyRejectsBadHealer(t *testing.T) {
	_, err := NewRemedyService(&fakeRemedyRepo{}, &remedyRecorder{}).
		Create(context.Background(), remedy.CreateParams{HealerID: 0, Name: "ยา"})
	assert.ErrorIs(t, err, ErrInvalidRemedy)
}

func TestCreateRemedyNoEventOnRepoError(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{createErr: errors.New("db")}, pub)

	_, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: "ยา"})

	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestListPageRemedy(t *testing.T) {
	page, err := NewRemedyService(&fakeRemedyRepo{}, &remedyRecorder{}).
		ListPage(context.Background(), remedy.ListQuery{Page: listing.Params{Limit: 5}})
	require.NoError(t, err)
	assert.Equal(t, 1, page.Total)
	assert.Len(t, page.Items, 1)
}

func TestDeleteRemedyPublishesEvent(t *testing.T) {
	pub := &remedyRecorder{}
	require.NoError(t, NewRemedyService(&fakeRemedyRepo{}, pub).Delete(context.Background(), 7))
	require.Len(t, pub.events, 1)
	assert.Equal(t, "remedy.deleted", pub.events[0].EventName())
}

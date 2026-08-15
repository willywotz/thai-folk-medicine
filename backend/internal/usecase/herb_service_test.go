package usecase

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

type fakeHerbRepo struct {
	created        herb.Herb
	lastSearchTerm *string
}

func (f *fakeHerbRepo) Create(_ context.Context, p herb.CreateParams) (herb.Herb, error) {
	f.created = herb.Herb{ID: 1, NameThai: p.NameThai}
	return f.created, nil
}
func (f *fakeHerbRepo) GetByID(context.Context, int64) (herb.Herb, error) { return f.created, nil }
func (f *fakeHerbRepo) ListPage(_ context.Context, _ listing.Params, searchTerm *string) (listing.Page[herb.Herb], error) {
	f.lastSearchTerm = searchTerm
	return listing.Page[herb.Herb]{Items: []herb.Herb{{ID: 1}}, Total: 1}, nil
}
func (f *fakeHerbRepo) Update(_ context.Context, p herb.UpdateParams) (herb.Herb, error) {
	return herb.Herb{ID: p.ID, NameThai: p.NameThai}, nil
}
func (f *fakeHerbRepo) Delete(context.Context, int64) error { return nil }

func TestHerbService_CreateValidatesAndPublishes(t *testing.T) {
	pub := &recordingPublisher{}
	svc := NewHerbService(&fakeHerbRepo{}, pub)

	_, err := svc.Create(context.Background(), herb.CreateParams{NameThai: "  "})
	assert.ErrorIs(t, err, ErrInvalidHerb)

	created, err := svc.Create(context.Background(), herb.CreateParams{NameThai: "ขมิ้นชัน"})
	require.NoError(t, err)
	assert.Equal(t, int64(1), created.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "herb.created", pub.events[0].EventName())
}

func TestListPageHerb(t *testing.T) {
	page, err := NewHerbService(&fakeHerbRepo{}, &recordingPublisher{}).
		ListPage(context.Background(), listing.Params{Limit: 5}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1, page.Total)
	assert.Len(t, page.Items, 1)
}

func TestListPageHerbForwardsSearchTerm(t *testing.T) {
	repo := &fakeHerbRepo{}
	term := "ขิง"

	_, err := NewHerbService(repo, &recordingPublisher{}).
		ListPage(context.Background(), listing.Params{Limit: 5}, &term)

	require.NoError(t, err)
	require.NotNil(t, repo.lastSearchTerm)
	assert.Equal(t, term, *repo.lastSearchTerm)
}

func TestHerbService_UpdateAndDeletePublish(t *testing.T) {
	pub := &recordingPublisher{}
	svc := NewHerbService(&fakeHerbRepo{}, pub)

	_, err := svc.Update(context.Background(), herb.UpdateParams{ID: 5, NameThai: "ไพล"})
	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "herb.updated", pub.events[0].EventName())

	require.NoError(t, svc.Delete(context.Background(), 5))
	require.Len(t, pub.events, 2)
	assert.Equal(t, "herb.deleted", pub.events[1].EventName())
}

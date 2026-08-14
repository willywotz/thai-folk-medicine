package usecase

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
)

type fakeHerbRepo struct {
	created herb.Herb
}

func (f *fakeHerbRepo) Create(_ context.Context, p herb.CreateParams) (herb.Herb, error) {
	f.created = herb.Herb{ID: 1, NameThai: p.NameThai}
	return f.created, nil
}
func (f *fakeHerbRepo) GetByID(context.Context, int64) (herb.Herb, error) { return f.created, nil }
func (f *fakeHerbRepo) List(context.Context) ([]herb.Herb, error)         { return nil, nil }
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

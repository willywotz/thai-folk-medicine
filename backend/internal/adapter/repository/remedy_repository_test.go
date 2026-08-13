package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// makeHealer creates a healer and returns its id, for remedy FK tests.
func makeHealer(t *testing.T, ctx context.Context, queriesRepo *Healer, districtID int64) int64 {
	t.Helper()
	h, err := queriesRepo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอทดสอบ"})
	require.NoError(t, err)
	return h.ID
}

func TestRemedyCreateGetListUpdateDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	repo := NewRemedy(queries)

	created, err := repo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาต้ม", Symptoms: "ไข้", Ingredients: "ฟ้าทะลายโจร",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "ยาต้ม", created.Name)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "ฟ้าทะลายโจร", got.Ingredients)

	list, err := repo.ListByHealer(ctx, healerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	updated, err := repo.Update(ctx, remedy.UpdateParams{ID: created.ID, Name: "ยาต้มใหม่", Usage: "ดื่มวันละ 2 ครั้ง"})
	require.NoError(t, err)
	assert.Equal(t, "ยาต้มใหม่", updated.Name)
	assert.Equal(t, "ดื่มวันละ 2 ครั้ง", updated.Usage)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, remedy.ErrNotFound))
}

func TestRemedyGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	_, err := NewRemedy(queries).GetByID(ctx, 999999)
	assert.True(t, errors.Is(err, remedy.ErrNotFound))
}

func TestDeleteHealerWithRemedyReturnsReferenced(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerRepo := NewHealer(queries)
	healerID := makeHealer(t, ctx, healerRepo, districtID)
	_, err := NewRemedy(queries).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)

	err = healerRepo.Delete(ctx, healerID)

	assert.True(t, errors.Is(err, healer.ErrReferenced))
}

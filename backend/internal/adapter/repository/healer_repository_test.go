package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// firstDistrictID returns a seeded Yasothon district id for foreign keys.
func firstDistrictID(t *testing.T, ctx context.Context, r *Location) int64 {
	t.Helper()
	provinces, err := r.ListProvince(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, provinces)
	districts, err := r.ListDistrictByProvince(ctx, provinces[0].ID)
	require.NoError(t, err)
	require.NotEmpty(t, districts)
	return districts[0].ID
}

func TestHealerCreateAndGet(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	created, err := repo.Create(ctx, healer.CreateParams{
		DistrictID: districtID,
		FullName:   "หมอสมชาย",
		Specialty:  "สมุนไพร",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "หมอสมชาย", created.FullName)
	assert.Equal(t, "", created.SubDistrict)
	assert.False(t, created.CreatedAt.IsZero())

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
	assert.Equal(t, "สมุนไพร", got.Specialty)
}

func TestHealerGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewHealer(queries)

	_, err := repo.GetByID(ctx, 999999)

	assert.True(t, errors.Is(err, healer.ErrNotFound))
}

func TestHealerListByDistrict(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	_, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ก"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ข"})
	require.NoError(t, err)

	list, err := repo.ListByDistrict(ctx, districtID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestHealerUpdateAndDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	created, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "เดิม"})
	require.NoError(t, err)

	updated, err := repo.Update(ctx, healer.UpdateParams{
		ID: created.ID, DistrictID: districtID, FullName: "ใหม่", Biography: "ประวัติ",
	})
	require.NoError(t, err)
	assert.Equal(t, "ใหม่", updated.FullName)
	assert.Equal(t, "ประวัติ", updated.Biography)

	require.NoError(t, repo.Delete(ctx, created.ID))

	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, healer.ErrNotFound))

	err = repo.Delete(ctx, created.ID)
	assert.True(t, errors.Is(err, healer.ErrNotFound))
}

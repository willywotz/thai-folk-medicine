package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
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

	page, err := repo.ListByDistrictPage(ctx, districtID, listing.Params{Limit: 10})
	require.NoError(t, err)
	assert.Len(t, page.Items, 2)
}

func TestHealerRepository_ListByDistrictPage_OffsetWindow(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	for _, name := range []string{"หมอ ก", "หมอ ข", "หมอ ค"} {
		_, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: name})
		require.NoError(t, err)
	}

	page2, err := repo.ListByDistrictPage(ctx, districtID, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

func TestHealerRepository_ListPage_DistrictFilter(t *testing.T) {
	ctx, queries := newTestPool(t)
	provinces, err := NewLocation(queries).ListProvince(ctx)
	require.NoError(t, err)
	districts, err := NewLocation(queries).ListDistrictByProvince(ctx, provinces[0].ID)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(districts), 2)
	districtA, districtB := districts[0].ID, districts[1].ID

	repo := NewHealer(queries)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtA, FullName: "หมอ ก"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtA, FullName: "หมอ ข"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtB, FullName: "หมอ ค"})
	require.NoError(t, err)

	all, err := repo.ListPage(ctx, listing.Params{Limit: 10}, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 3, all.Total)
	assert.Len(t, all.Items, 3)

	filtered, err := repo.ListPage(ctx, listing.Params{Limit: 10}, &districtA, nil)
	require.NoError(t, err)
	assert.Equal(t, 2, filtered.Total)
	assert.Len(t, filtered.Items, 2)
	for _, item := range filtered.Items {
		assert.Equal(t, districtA, item.DistrictID)
	}
}

func TestHealerRepository_ListPage_SearchTermFilter(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	_, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอสมชาย", Specialty: "นวดแผนไทย"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอสมหญิง", Specialty: "สมุนไพร"})
	require.NoError(t, err)

	all, err := repo.ListPage(ctx, listing.Params{Limit: 10}, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 2, all.Total)

	term := "สมชาย"
	byName, err := repo.ListPage(ctx, listing.Params{Limit: 10}, nil, &term)
	require.NoError(t, err)
	assert.Equal(t, 1, byName.Total)
	assert.Equal(t, "หมอสมชาย", byName.Items[0].FullName)

	specialty := "สมุนไพร"
	bySpecialty, err := repo.ListPage(ctx, listing.Params{Limit: 10}, nil, &specialty)
	require.NoError(t, err)
	assert.Equal(t, 1, bySpecialty.Total)
	assert.Equal(t, "หมอสมหญิง", bySpecialty.Items[0].FullName)
}

func TestHealerCountCountsAllHealers(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)
	_, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ก"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ข"})
	require.NoError(t, err)

	count, err := repo.Count(ctx)

	require.NoError(t, err)
	assert.Equal(t, 2, count)
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

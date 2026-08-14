package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
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
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	repo := NewRemedy(pool)

	created, err := repo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาต้ม", Symptoms: "ไข้",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "ยาต้ม", created.Name)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)

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
	ctx, pool := newTestPoolConn(t)
	_, err := NewRemedy(pool).GetByID(ctx, 999999)
	assert.True(t, errors.Is(err, remedy.ErrNotFound))
}

func TestDeleteHealerWithRemedyReturnsReferenced(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerRepo := NewHealer(queries)
	healerID := makeHealer(t, ctx, healerRepo, districtID)
	_, err := NewRemedy(pool).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)

	err = healerRepo.Delete(ctx, healerID)

	assert.True(t, errors.Is(err, healer.ErrReferenced))
}

func TestRemedyRepository_HerbLinks(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	healerRepo := NewHealer(queries)
	herbRepo := NewHerb(queries)
	remedyRepo := NewRemedy(pool)

	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, healerRepo, districtID)
	hb1, err := herbRepo.Create(ctx, herb.CreateParams{NameThai: "ขิง"})
	require.NoError(t, err)
	hb2, err := herbRepo.Create(ctx, herb.CreateParams{NameThai: "ไพล"})
	require.NoError(t, err)

	created, err := remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาต้ม",
		Herbs: []remedy.HerbRef{{HerbID: hb1.ID, Amount: "2 กำมือ"}, {HerbID: hb2.ID}},
	})
	require.NoError(t, err)

	got, err := remedyRepo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Len(t, got.Herbs, 2)
	assert.Equal(t, "ขิง", got.Herbs[0].NameThai)
	assert.Equal(t, "2 กำมือ", got.Herbs[0].Amount)

	byHerb, err := remedyRepo.ListByHerb(ctx, hb1.ID)
	require.NoError(t, err)
	assert.Len(t, byHerb, 1)

	_, err = remedyRepo.Update(ctx, remedy.UpdateParams{
		ID: created.ID, Name: "ยาต้ม*",
		Herbs: []remedy.HerbRef{{HerbID: hb2.ID, Amount: "1 ช้อน"}},
	})
	require.NoError(t, err)
	got, err = remedyRepo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Len(t, got.Herbs, 1)
	assert.Equal(t, hb2.ID, got.Herbs[0].HerbID)
}

func TestRemedyRepository_ListRecent(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	repo := NewRemedy(pool)

	_, err := repo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา 1"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา 2"})
	require.NoError(t, err)

	list, err := repo.ListRecent(ctx, 1)
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, "ยา 2", list[0].Name)
}

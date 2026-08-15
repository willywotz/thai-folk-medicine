package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
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

	page, err := repo.ListByHealerPage(ctx, healerID, listing.Params{Limit: 10})
	require.NoError(t, err)
	assert.Len(t, page.Items, 1)

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

	byHerb, err := remedyRepo.ListByHerbPage(ctx, hb1.ID, listing.Params{Limit: 10})
	require.NoError(t, err)
	assert.Len(t, byHerb.Items, 1)

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

// remedyFixtures holds the ids a ListPage test needs to exercise each filter
// branch: a herb linked to one remedy, and the district of the healer whose
// remedy carries a distinctive symptom substring.
type remedyFixtures struct {
	herbID           int64
	secondDistrictID int64
}

// seedRemedyFixtures creates two healers in different districts, one herb,
// and three remedies (one linked to the herb; one, in the second district,
// with a distinctive symptom). It returns the ids needed to test each filter.
func seedRemedyFixtures(t *testing.T, ctx context.Context, pool *pgxpool.Pool) remedyFixtures {
	t.Helper()
	queries := db.New(pool)
	location := NewLocation(queries)
	provinces, err := location.ListProvince(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, provinces)
	districts, err := location.ListDistrictByProvince(ctx, provinces[0].ID)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(districts), 2)

	healerRepo := NewHealer(queries)
	healer1 := makeHealer(t, ctx, healerRepo, districts[0].ID)
	healer2 := makeHealer(t, ctx, healerRepo, districts[1].ID)

	hb, err := NewHerb(queries).Create(ctx, herb.CreateParams{NameThai: "ขิง"})
	require.NoError(t, err)

	repo := NewRemedy(pool)
	_, err = repo.Create(ctx, remedy.CreateParams{
		HealerID: healer1, Name: "ยา 1", Herbs: []remedy.HerbRef{{HerbID: hb.ID}},
	})
	require.NoError(t, err)
	_, err = repo.Create(ctx, remedy.CreateParams{HealerID: healer1, Name: "ยา 2"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, remedy.CreateParams{HealerID: healer2, Name: "ยา 3", Symptoms: "ปวดหัว"})
	require.NoError(t, err)

	return remedyFixtures{herbID: hb.ID, secondDistrictID: districts[1].ID}
}

func TestRemedyRepository_ListPage_FilterByHerb(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	repo := NewRemedy(pool)
	fixtures := seedRemedyFixtures(t, ctx, pool)

	page, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 10, Offset: 0}})
	require.NoError(t, err)
	assert.Equal(t, 3, page.Total)
	assert.Len(t, page.Items, 3)

	filtered, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 10}, HerbID: &fixtures.herbID})
	require.NoError(t, err)
	assert.Equal(t, 1, filtered.Total)
	assert.Len(t, filtered.Items, 1)
}

func TestRemedyRepository_ListPage_FilterByDistrictAndSymptom(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	repo := NewRemedy(pool)
	fixtures := seedRemedyFixtures(t, ctx, pool)

	byDistrict, err := repo.ListPage(ctx, remedy.ListQuery{
		Page: listing.Params{Limit: 10}, DistrictID: &fixtures.secondDistrictID,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, byDistrict.Total)
	require.Len(t, byDistrict.Items, 1)
	assert.Equal(t, "ยา 3", byDistrict.Items[0].Name)

	bySymptom, err := repo.ListPage(ctx, remedy.ListQuery{
		Page: listing.Params{Limit: 10}, Symptom: "ปวด",
	})
	require.NoError(t, err)
	assert.Equal(t, 1, bySymptom.Total)
	require.Len(t, bySymptom.Items, 1)
	assert.Equal(t, "ยา 3", bySymptom.Items[0].Name)
}

func TestRemedyRepository_ListPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	repo := NewRemedy(pool)
	seedRemedyFixtures(t, ctx, pool)

	page2, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 2, Offset: 2}})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

func TestRemedyRepository_ListByHealerPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	repo := NewRemedy(pool)
	for _, name := range []string{"ยา 1", "ยา 2", "ยา 3"} {
		_, err := repo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: name})
		require.NoError(t, err)
	}

	page2, err := repo.ListByHealerPage(ctx, healerID, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

func TestRemedyRepository_ListByHerbPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	hb, err := NewHerb(queries).Create(ctx, herb.CreateParams{NameThai: "ขิง"})
	require.NoError(t, err)
	repo := NewRemedy(pool)
	for _, name := range []string{"ยา 1", "ยา 2", "ยา 3"} {
		_, err := repo.Create(ctx, remedy.CreateParams{
			HealerID: healerID, Name: name, Herbs: []remedy.HerbRef{{HerbID: hb.ID}},
		})
		require.NoError(t, err)
	}

	page2, err := repo.ListByHerbPage(ctx, hb.ID, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

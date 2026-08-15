package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// makeRemedy creates a healer + remedy and returns their ids.
func makeRemedy(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (healerID, remedyID int64) {
	t.Helper()
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID = makeHealer(t, ctx, NewHealer(queries), districtID)
	r, err := NewRemedy(pool).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)
	return healerID, r.ID
}

func TestTreatmentCaseCreateGetListUpdateDelete(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	repo := NewTreatmentCase(db.New(pool))
	day := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	created, err := repo.Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, PatientAge: 45, PatientSex: "female",
		Symptoms: "ไข้", Result: "หาย", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, 45, created.PatientAge)
	assert.Equal(t, day, created.TreatedOn)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "female", got.PatientSex)

	page, err := repo.ListByRemedyPage(ctx, remedyID, listing.Params{Limit: 10})
	require.NoError(t, err)
	assert.Len(t, page.Items, 1)

	updated, err := repo.Update(ctx, treatmentcase.UpdateParams{
		ID: created.ID, RemedyID: remedyID, HealerID: healerID, PatientAge: 46, PatientSex: "female", Result: "ดีขึ้น", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.Equal(t, 46, updated.PatientAge)
	assert.Equal(t, "ดีขึ้น", updated.Result)

	otherHealerID, otherRemedyID := makeRemedy(t, ctx, pool)
	reassigned, err := repo.Update(ctx, treatmentcase.UpdateParams{
		ID: created.ID, RemedyID: otherRemedyID, HealerID: otherHealerID, PatientAge: 46, PatientSex: "female", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.Equal(t, otherRemedyID, reassigned.RemedyID)
	assert.Equal(t, otherHealerID, reassigned.HealerID)
	got, err = repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, otherRemedyID, got.RemedyID)
	assert.Equal(t, otherHealerID, got.HealerID)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, treatmentcase.ErrNotFound))
}

func TestTreatmentCaseCountCountsAllCases(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	repo := NewTreatmentCase(db.New(pool))
	for i := range 3 {
		_, err := repo.Create(ctx, treatmentcase.CreateParams{
			RemedyID: remedyID, HealerID: healerID, PatientSex: "male",
			TreatedOn: time.Date(2026, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC),
		})
		require.NoError(t, err)
	}

	count, err := repo.Count(ctx)

	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestTreatmentCaseRepository_ListPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	repo := NewTreatmentCase(db.New(pool))
	for i := range 3 {
		_, err := repo.Create(ctx, treatmentcase.CreateParams{
			RemedyID: remedyID, HealerID: healerID, PatientSex: "male",
			TreatedOn: time.Date(2026, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC),
		})
		require.NoError(t, err)
	}

	page2, err := repo.ListPage(ctx, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

func TestTreatmentCaseRepository_ListByRemedyPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	repo := NewTreatmentCase(db.New(pool))
	for i := range 3 {
		_, err := repo.Create(ctx, treatmentcase.CreateParams{
			RemedyID: remedyID, HealerID: healerID, PatientSex: "male",
			TreatedOn: time.Date(2026, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC),
		})
		require.NoError(t, err)
	}

	page2, err := repo.ListByRemedyPage(ctx, remedyID, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

func TestDeleteRemedyWithCaseReturnsReferenced(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	_, err := NewTreatmentCase(db.New(pool)).Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, TreatedOn: time.Now().UTC(),
	})
	require.NoError(t, err)

	err = NewRemedy(pool).Delete(ctx, remedyID)

	assert.True(t, errors.Is(err, remedy.ErrReferenced))
}

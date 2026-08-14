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

	list, err := repo.ListByRemedy(ctx, remedyID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	updated, err := repo.Update(ctx, treatmentcase.UpdateParams{
		ID: created.ID, PatientAge: 46, PatientSex: "female", Result: "ดีขึ้น", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.Equal(t, 46, updated.PatientAge)
	assert.Equal(t, "ดีขึ้น", updated.Result)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, treatmentcase.ErrNotFound))
}

func TestTreatmentCaseRepository_ListRecent(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	healerID, remedyID := makeRemedy(t, ctx, pool)
	repo := NewTreatmentCase(db.New(pool))

	_, err := repo.Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, PatientSex: "male", TreatedOn: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
	})
	require.NoError(t, err)
	_, err = repo.Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, PatientSex: "female", TreatedOn: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC),
	})
	require.NoError(t, err)

	list, err := repo.ListRecent(ctx, 1)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "female", list[0].PatientSex)
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

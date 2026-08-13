package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

type dbQueriesForTest struct{ q *db.Queries }

// makeRemedy creates a healer + remedy and returns their ids.
func makeRemedy(t *testing.T, ctx context.Context, queries *dbQueriesForTest) (healerID, remedyID int64) {
	t.Helper()
	districtID := firstDistrictID(t, ctx, NewLocation(queries.q))
	healerID = makeHealer(t, ctx, NewHealer(queries.q), districtID)
	r, err := NewRemedy(queries.q).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)
	return healerID, r.ID
}

func TestTreatmentCaseCreateGetListUpdateDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	healerID, remedyID := makeRemedy(t, ctx, &dbQueriesForTest{q: queries})
	repo := NewTreatmentCase(queries)
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

func TestDeleteRemedyWithCaseReturnsReferenced(t *testing.T) {
	ctx, queries := newTestPool(t)
	healerID, remedyID := makeRemedy(t, ctx, &dbQueriesForTest{q: queries})
	_, err := NewTreatmentCase(queries).Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, TreatedOn: time.Now().UTC(),
	})
	require.NoError(t, err)

	err = NewRemedy(queries).Delete(ctx, remedyID)

	assert.True(t, errors.Is(err, remedy.ErrReferenced))
}

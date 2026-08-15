package repository

import (
	"context"
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

// seedSearchFixtures creates a remedy, a healer, and a herb that all match "ขิง".
func seedSearchFixtures(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	_, err := NewHealer(queries).Update(ctx, healer.UpdateParams{
		ID: healerID, DistrictID: districtID, FullName: "ขิง",
	})
	require.NoError(t, err)
	_, err = NewHerb(queries).Create(ctx, herb.CreateParams{NameThai: "ขิง"})
	require.NoError(t, err)
	_, err = NewRemedy(pool).Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ขิง", Symptoms: "ขิง",
	})
	require.NoError(t, err)
}

func TestSearchRepository_SearchAll_RanksAndPaginates(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	seedSearchFixtures(t, ctx, pool)
	repo := NewSearch(db.New(pool))

	page, err := repo.SearchAll(ctx, "ขิง", listing.Params{Limit: 2, Offset: 0})

	require.NoError(t, err)
	if page.Total < 2 || len(page.Items) != 2 {
		t.Fatalf("total=%d items=%d", page.Total, len(page.Items))
	}
	assert.GreaterOrEqual(t, page.Items[0].Score, page.Items[1].Score)

	page2, err := repo.SearchAll(ctx, "ขิง", listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, page.Total, page2.Total)
	assert.NotEmpty(t, page2.Items)
}

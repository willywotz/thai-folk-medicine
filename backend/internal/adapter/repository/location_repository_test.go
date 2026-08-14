package repository

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
)

func newTestPool(t *testing.T) (context.Context, *db.Queries) {
	t.Helper()
	ctx, pool := newTestPoolConn(t)
	return ctx, db.New(pool)
}

// newTestPoolConn spins up a migrated Postgres testcontainer and returns the
// raw pool, for repositories (like Remedy) that need to run transactions.
func newTestPoolConn(t *testing.T) (context.Context, *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	container, err := tcpostgres.Run(ctx, "postgres:17",
		tcpostgres.WithDatabase("folk_medicine"),
		tcpostgres.WithUsername("folk"),
		tcpostgres.WithPassword("folk"),
		tcpostgres.BasicWaitStrategies(),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(container) })

	url, err := container.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)
	require.NoError(t, database.Migrate(url))

	pool, err := database.NewPool(ctx, url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	return ctx, pool
}

func TestLocationListProvinceReturnsYasothon(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)

	require.NoError(t, err)
	require.Len(t, provinces, 1)
	assert.Equal(t, "Yasothon", provinces[0].NameEnglish)
	assert.Equal(t, "ยโสธร", provinces[0].NameThai)
}

func TestLocationListDistrictByProvinceReturnsNine(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)
	require.NoError(t, err)
	require.Len(t, provinces, 1)

	districts, err := repo.ListDistrictByProvince(ctx, provinces[0].ID)

	require.NoError(t, err)
	assert.Len(t, districts, 9)
	assert.Equal(t, provinces[0].ID, districts[0].ProvinceID)
}

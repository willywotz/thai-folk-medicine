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
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
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

func TestLocationGetDistrictReturnsOne(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)
	require.NoError(t, err)
	districts, err := repo.ListDistrictByProvince(ctx, provinces[0].ID)
	require.NoError(t, err)
	require.NotEmpty(t, districts)

	got, err := repo.GetDistrict(ctx, districts[0].ID)

	require.NoError(t, err)
	assert.Equal(t, districts[0].ID, got.ID)
	assert.Equal(t, districts[0].ProvinceID, got.ProvinceID)
	assert.Equal(t, districts[0].NameThai, got.NameThai)
	assert.Equal(t, districts[0].NameEnglish, got.NameEnglish)
}

func TestLocationGetDistrictNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	_, err := repo.GetDistrict(ctx, 999999)

	assert.ErrorIs(t, err, location.ErrNotFound)
}

func TestLocationCreateGetUpdateDeleteProvince(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	created, err := repo.CreateProvince(ctx, "อุบลราชธานี", "Ubon Ratchathani")
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "Ubon Ratchathani", created.NameEnglish)

	got, err := repo.GetProvince(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created, got)

	count, err := repo.CountDistrictByProvince(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, count)

	updated, err := repo.UpdateProvince(ctx, created.ID, "อุบล", "Ubon")
	require.NoError(t, err)
	assert.Equal(t, "Ubon", updated.NameEnglish)
	assert.Equal(t, "อุบล", updated.NameThai)

	require.NoError(t, repo.DeleteProvince(ctx, created.ID))

	_, err = repo.GetProvince(ctx, created.ID)
	assert.ErrorIs(t, err, location.ErrProvinceNotFound)
}

func TestLocationGetProvinceNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	_, err := repo.GetProvince(ctx, 999999)

	assert.ErrorIs(t, err, location.ErrProvinceNotFound)
}

func TestLocationCountDistrictByProvinceCountsSeededDistricts(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)
	require.NoError(t, err)
	require.Len(t, provinces, 1)

	count, err := repo.CountDistrictByProvince(ctx, provinces[0].ID)

	require.NoError(t, err)
	assert.Equal(t, 9, count)
}

func TestLocationCreateUpdateDeleteDistrict(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)
	require.NoError(t, err)
	require.Len(t, provinces, 1)
	provinceID := provinces[0].ID

	created, err := repo.CreateDistrict(ctx, provinceID, "อำเภอใหม่", "New District")
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, provinceID, created.ProvinceID)
	assert.Equal(t, "New District", created.NameEnglish)

	count, err := repo.CountHealerByDistrict(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, count)

	updated, err := repo.UpdateDistrict(ctx, created.ID, "อำเภอ", "District")
	require.NoError(t, err)
	assert.Equal(t, "District", updated.NameEnglish)
	assert.Equal(t, "อำเภอ", updated.NameThai)
	assert.Equal(t, provinceID, updated.ProvinceID)

	require.NoError(t, repo.DeleteDistrict(ctx, created.ID))

	_, err = repo.GetDistrict(ctx, created.ID)
	assert.ErrorIs(t, err, location.ErrNotFound)
}

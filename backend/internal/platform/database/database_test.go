package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func startPostgres(t *testing.T) string {
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
	return url
}

func TestMigrateSeedsYasothon(t *testing.T) {
	url := startPostgres(t)
	ctx := context.Background()

	require.NoError(t, Migrate(url))

	pool, err := NewPool(ctx, url)
	require.NoError(t, err)
	defer pool.Close()

	var provinceCount int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM province WHERE name_english = 'Yasothon'`).Scan(&provinceCount))
	assert.Equal(t, 1, provinceCount)

	var districtCount int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM district`).Scan(&districtCount))
	assert.Equal(t, 9, districtCount)
}

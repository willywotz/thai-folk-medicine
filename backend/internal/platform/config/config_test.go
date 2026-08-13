package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadReadsEnvironment(t *testing.T) {
	t.Setenv("HTTP_PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	got, err := Load()

	require.NoError(t, err)
	assert.Equal(t, "9090", got.HTTPPort)
	assert.Equal(t, "postgres://localhost/test", got.DatabaseURL)
}

func TestLoadDefaultsHTTPPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	got, err := Load()

	require.NoError(t, err)
	assert.Equal(t, "8080", got.HTTPPort)
}

func TestLoadFailsWhenDatabaseURLMissing(t *testing.T) {
	t.Setenv("DATABASE_URL", "") // registers cleanup/restore of any ambient value
	os.Unsetenv("DATABASE_URL")  // removes it for the duration of this test

	_, err := Load()

	assert.Error(t, err)
}

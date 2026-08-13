package repository

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

func TestStaffCreateGetCount(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewStaff(queries)

	count, err := repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	created, err := repo.Create(ctx, staff.CreateParams{
		Username: "admin", Email: "admin@example.local", PasswordHash: "hash",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)

	got, err := repo.GetByUsername(ctx, "admin")
	require.NoError(t, err)
	assert.Equal(t, "admin", got.Username)
	assert.Equal(t, "hash", got.PasswordHash)

	count, err = repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

func TestStaffGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	_, err := NewStaff(queries).GetByUsername(ctx, "ghost")
	assert.True(t, errors.Is(err, staff.ErrNotFound))
}

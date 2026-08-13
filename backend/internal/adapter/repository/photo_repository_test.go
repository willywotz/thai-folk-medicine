package repository

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

func TestPhotoCreateGetDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewPhoto(queries)

	created, err := repo.Create(ctx, photo.CreateParams{
		OwnerType: photo.OwnerHealer, OwnerID: 1, ObjectKey: "abc.jpg", Caption: "หมอ",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "abc.jpg", got.ObjectKey)
	assert.Equal(t, photo.OwnerHealer, got.OwnerType)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, photo.ErrNotFound))

	err = repo.Delete(ctx, created.ID)
	assert.True(t, errors.Is(err, photo.ErrNotFound))
}

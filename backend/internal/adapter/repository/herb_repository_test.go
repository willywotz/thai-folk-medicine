package repository

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
)

func TestHerbRepository_CRUD(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewHerb(queries)

	created, err := repo.Create(ctx, herb.CreateParams{
		NameThai:       "ฟ้าทะลายโจร",
		NameEnglish:    "Andrographis",
		ScientificName: "Andrographis paniculata",
		Properties:     "แก้ไข้ แก้เจ็บคอ",
		Description:    "ไม้ล้มลุก",
	})
	require.NoError(t, err)
	require.NotZero(t, created.ID)
	assert.Equal(t, "ฟ้าทะลายโจร", created.NameThai)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)

	list, err := repo.List(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(list), 1)

	_, err = repo.Update(ctx, herb.UpdateParams{ID: created.ID, NameThai: "ฟ้าทะลายโจร*", NameEnglish: "A"})
	require.NoError(t, err)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, herb.ErrNotFound))
}

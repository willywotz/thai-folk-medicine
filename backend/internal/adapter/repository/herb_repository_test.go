package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
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

	page, err := repo.ListPage(ctx, listing.Params{Limit: 10})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(page.Items), 1)

	_, err = repo.Update(ctx, herb.UpdateParams{ID: created.ID, NameThai: "ฟ้าทะลายโจร*", NameEnglish: "A"})
	require.NoError(t, err)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, herb.ErrNotFound))
}

// seedHerbFixtures creates three herbs for pagination tests.
func seedHerbFixtures(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	repo := NewHerb(db.New(pool))
	_, err := repo.Create(ctx, herb.CreateParams{NameThai: "ขิง", NameEnglish: "Ginger", Properties: "แก้ท้องอืด"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, herb.CreateParams{NameThai: "ไพล", NameEnglish: "Cassumunar", Properties: "แก้ปวดเมื่อย"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, herb.CreateParams{NameThai: "กระชาย", NameEnglish: "Fingerroot", Properties: "บำรุงกำลัง"})
	require.NoError(t, err)
}

func TestHerbCountCountsAllHerbs(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	repo := NewHerb(db.New(pool))
	seedHerbFixtures(t, ctx, pool)

	count, err := repo.Count(ctx)

	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestHerbRepository_ListPage_OffsetWindow(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	repo := NewHerb(db.New(pool))
	seedHerbFixtures(t, ctx, pool)

	page2, err := repo.ListPage(ctx, listing.Params{Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, 3, page2.Total)
	assert.Len(t, page2.Items, 1)
}

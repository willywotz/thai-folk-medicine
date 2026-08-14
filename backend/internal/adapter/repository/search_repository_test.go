package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

func TestSearchRemedyMatchesThaiSubstring(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	remedyRepo := NewRemedy(pool)
	_, err := remedyRepo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยาแก้ไข้", Symptoms: "ไข้สูง"})
	require.NoError(t, err)
	_, err = remedyRepo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยาแก้ปวด", Symptoms: "ปวดหัว"})
	require.NoError(t, err)

	got, err := remedyRepo.Search(ctx, "ยาแก้ไข้")

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "ยาแก้ไข้", got[0].Name)
	assert.Equal(t, "หมอทดสอบ", got[0].HealerFullName)
}

func TestSearchRemedyRanksBySimilarity(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	queries := db.New(pool)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	remedyRepo := NewRemedy(pool)
	// Alphabetically first, but only a weak (diluted) symptoms match.
	_, err := remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "กระเทียมสด",
		Symptoms: "มีไข้ตัวร้อนใช้ยาแก้ไข้ที่ดีมากสำหรับทุกคนในหมู่บ้าน",
	})
	require.NoError(t, err)
	// Alphabetically last, but an exact name match (highest similarity).
	_, err = remedyRepo.Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยาแก้ไข้"})
	require.NoError(t, err)

	got, err := remedyRepo.Search(ctx, "ยาแก้ไข้")

	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "ยาแก้ไข้", got[0].Name, "exact name match must rank first")
}

func TestSearchHealerMatchesSpecialty(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerRepo := NewHealer(queries)
	makeHealer(t, ctx, healerRepo, districtID) // "หมอทดสอบ", empty specialty

	got, err := healerRepo.Search(ctx, "หมอทดสอบ")

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "หมอทดสอบ", got[0].FullName)
}

func TestSearchRemedyNoMatchReturnsEmpty(t *testing.T) {
	ctx, pool := newTestPoolConn(t)
	got, err := NewRemedy(pool).Search(ctx, "ไม่มีอยู่จริง")
	require.NoError(t, err)
	assert.Empty(t, got)
}

package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

func TestSearchRemedyMatchesThaiSubstring(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	remedyRepo := NewRemedy(queries)
	_, err := remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาแก้ไข้", Symptoms: "ไข้สูง", Ingredients: "ฟ้าทะลายโจร",
	})
	require.NoError(t, err)
	_, err = remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาแก้ปวด", Symptoms: "ปวดหัว", Ingredients: "ขิง",
	})
	require.NoError(t, err)

	got, err := remedyRepo.Search(ctx, "ฟ้าทะลายโจร")

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "ยาแก้ไข้", got[0].Name)
	assert.Equal(t, "หมอทดสอบ", got[0].HealerFullName)
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
	ctx, queries := newTestPool(t)
	got, err := NewRemedy(queries).Search(ctx, "ไม่มีอยู่จริง")
	require.NoError(t, err)
	assert.Empty(t, got)
}

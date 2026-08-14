package search

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

type fakeRemedyReader struct {
	term string
	out  []remedy.SearchResult
}

func (f *fakeRemedyReader) Search(_ context.Context, term string) ([]remedy.SearchResult, error) {
	f.term = term
	return f.out, nil
}

type fakeHealerReader struct {
	out []healer.Healer
}

func (f *fakeHealerReader) Search(context.Context, string) ([]healer.Healer, error) {
	return f.out, nil
}

type fakeHerbReader struct {
	out []herb.Herb
}

func (f *fakeHerbReader) Search(context.Context, string) ([]herb.Herb, error) {
	return f.out, nil
}

func TestSearchCombinesAllReaders(t *testing.T) {
	rr := &fakeRemedyReader{out: []remedy.SearchResult{{ID: 1, Name: "ยา"}}}
	hr := &fakeHealerReader{out: []healer.Healer{{ID: 2, FullName: "หมอ"}}}
	hbr := &fakeHerbReader{out: []herb.Herb{{ID: 3, NameThai: "ขิง"}}}
	service := NewService(rr, hr, hbr)

	got, err := service.Search(context.Background(), "  ยา  ")

	require.NoError(t, err)
	assert.Equal(t, "ยา", rr.term) // trimmed before the query
	require.Len(t, got.Remedies, 1)
	require.Len(t, got.Healers, 1)
	require.Len(t, got.Herbs, 1)
	assert.Equal(t, int64(1), got.Remedies[0].ID)
	assert.Equal(t, int64(2), got.Healers[0].ID)
	assert.Equal(t, int64(3), got.Herbs[0].ID)
}

func TestSearchRejectsShortTerm(t *testing.T) {
	service := NewService(&fakeRemedyReader{}, &fakeHealerReader{}, &fakeHerbReader{})

	_, err := service.Search(context.Background(), "ก") // 1 rune

	assert.ErrorIs(t, err, ErrTermTooShort)
}

func TestSearchIncludesHerbs(t *testing.T) {
	service := NewService(&fakeRemedyReader{}, &fakeHealerReader{}, &fakeHerbReader{out: []herb.Herb{{ID: 1, NameThai: "ขิง"}}})

	got, err := service.Search(context.Background(), "ขิง")

	require.NoError(t, err)
	require.Len(t, got.Herbs, 1)
}

package search

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

type fakeReader struct {
	term string
	page listing.Params
	out  listing.Page[Hit]
}

func (f *fakeReader) SearchAll(_ context.Context, term string, p listing.Params) (listing.Page[Hit], error) {
	f.term = term
	f.page = p
	return f.out, nil
}

func TestSearchDelegatesToReader(t *testing.T) {
	reader := &fakeReader{out: listing.Page[Hit]{
		Items: []Hit{{Type: "herb", ID: 3, Title: "ขิง", Score: 0.9}},
		Total: 1,
	}}
	service := NewService(reader)

	got, err := service.Search(context.Background(), "  ขิง  ", listing.Params{Limit: 10})

	require.NoError(t, err)
	assert.Equal(t, "ขิง", reader.term) // trimmed before the query
	assert.Equal(t, listing.Params{Limit: 10}, reader.page)
	require.Len(t, got.Items, 1)
	assert.Equal(t, "herb", got.Items[0].Type)
	assert.Equal(t, 1, got.Total)
}

func TestSearchRejectsShortTerm(t *testing.T) {
	service := NewService(&fakeReader{})

	_, err := service.Search(context.Background(), "ก", listing.Params{}) // 1 rune

	assert.ErrorIs(t, err, ErrTermTooShort)
}

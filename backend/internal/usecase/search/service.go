// Package search runs one merged, relevance-ranked search across remedies,
// healers, and herbs.
package search

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// ErrTermTooShort means the search term has fewer than two characters.
var ErrTermTooShort = errors.New("search term too short")

// Hit is one search match, drawn from a remedy, healer, or herb.
type Hit struct {
	Type     string
	ID       int64
	Title    string
	Subtitle string
	Score    float64
}

// Reader returns one merged, score-ordered page of search hits.
type Reader interface {
	SearchAll(ctx context.Context, term string, p listing.Params) (listing.Page[Hit], error)
}

// Service runs a merged search across remedies, healers, and herbs.
type Service struct {
	reader Reader
}

// NewService builds the search service.
func NewService(reader Reader) *Service {
	return &Service{reader: reader}
}

// Search returns one page of merged hits for a term of at least two runes.
func (s *Service) Search(ctx context.Context, term string, p listing.Params) (listing.Page[Hit], error) {
	term = strings.TrimSpace(term)
	if utf8.RuneCountInString(term) < 2 {
		return listing.Page[Hit]{}, ErrTermTooShort
	}
	return s.reader.SearchAll(ctx, term, p)
}

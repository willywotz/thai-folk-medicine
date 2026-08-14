// Package search composes remedy and healer text search into one result.
package search

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// ErrTermTooShort means the search term has fewer than two characters.
var ErrTermTooShort = errors.New("search term too short")

// RemedyReader searches remedies by free text.
type RemedyReader interface {
	Search(ctx context.Context, term string) ([]remedy.SearchResult, error)
}

// HealerReader searches healers by free text.
type HealerReader interface {
	Search(ctx context.Context, term string) ([]healer.Healer, error)
}

// HerbReader searches herbs by free text.
type HerbReader interface {
	Search(ctx context.Context, term string) ([]herb.Herb, error)
}

// Result holds the remedy, healer, and herb matches for one search.
type Result struct {
	Remedies []remedy.SearchResult
	Healers  []healer.Healer
	Herbs    []herb.Herb
}

// Service runs a search across remedies, healers, and herbs.
type Service struct {
	remedyReader RemedyReader
	healerReader HealerReader
	herbReader   HerbReader
}

// NewService builds the search service.
func NewService(remedyReader RemedyReader, healerReader HealerReader, herbReader HerbReader) *Service {
	return &Service{remedyReader: remedyReader, healerReader: healerReader, herbReader: herbReader}
}

// Search returns remedy, healer, and herb matches for a term of at least two runes.
func (s *Service) Search(ctx context.Context, term string) (Result, error) {
	term = strings.TrimSpace(term)
	if utf8.RuneCountInString(term) < 2 {
		return Result{}, ErrTermTooShort
	}
	remedies, err := s.remedyReader.Search(ctx, term)
	if err != nil {
		return Result{}, err
	}
	healers, err := s.healerReader.Search(ctx, term)
	if err != nil {
		return Result{}, err
	}
	herbs, err := s.herbReader.Search(ctx, term)
	if err != nil {
		return Result{}, err
	}
	return Result{Remedies: remedies, Healers: healers, Herbs: herbs}, nil
}

package repository

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

// Search runs the merged remedy/healer/herb trigram search in Postgres.
type Search struct {
	q *db.Queries
}

// NewSearch builds the search repository.
func NewSearch(q *db.Queries) *Search {
	return &Search{q: q}
}

// SearchAll returns one merged, score-ordered page of remedy/healer/herb hits.
//
// withinlazy: cross-type trigram scores are uncalibrated; add per-type weight multipliers here if merged ordering needs tuning.
func (r *Search) SearchAll(ctx context.Context, term string, p listing.Params) (listing.Page[search.Hit], error) {
	rows, err := r.q.SearchAll(ctx, db.SearchAllParams{
		SearchTerm: term, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[search.Hit]{}, err
	}
	total, err := r.q.CountSearchAll(ctx, term)
	if err != nil {
		return listing.Page[search.Hit]{}, err
	}
	items := make([]search.Hit, 0, len(rows))
	for _, row := range rows {
		items = append(items, search.Hit{
			Type: row.Type, ID: row.ID, Title: row.Title,
			Subtitle: row.Subtitle, Score: float64(row.Score),
		})
	}
	return listing.Page[search.Hit]{Items: items, Total: int(total)}, nil
}

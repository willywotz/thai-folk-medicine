package audit

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// Reader returns paginated persisted events, newest first.
type Reader struct {
	repo audit.Repository
}

// NewReader builds the reader.
func NewReader(repo audit.Repository) *Reader {
	return &Reader{repo: repo}
}

// List returns one page of persisted events.
func (r *Reader) List(ctx context.Context, p listing.Params) (listing.Page[audit.Entry], error) {
	return r.repo.List(ctx, p)
}

// Package audit holds the persisted-event read model: the Entry entity and
// the Repository port. It imports no framework code.
package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// Entry is one persisted domain event.
type Entry struct {
	ID         int64
	EventName  string
	Payload    json.RawMessage
	OccurredAt time.Time
}

// Repository records and reads persisted events.
type Repository interface {
	Record(ctx context.Context, name string, payload []byte) error
	List(ctx context.Context, p listing.Params) (listing.Page[Entry], error)
}

package repository

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// EventLog stores and reads persisted domain events in Postgres.
type EventLog struct {
	q *db.Queries
}

// NewEventLog builds the event log repository.
func NewEventLog(q *db.Queries) *EventLog {
	return &EventLog{q: q}
}

func toEntry(row db.EventLog) audit.Entry {
	return audit.Entry{
		ID:         row.ID,
		EventName:  row.EventName,
		Payload:    row.Payload,
		OccurredAt: row.OccurredAt.Time,
	}
}

// Record inserts one event row.
func (r *EventLog) Record(ctx context.Context, name string, payload []byte) error {
	return r.q.InsertEventLog(ctx, db.InsertEventLogParams{EventName: name, Payload: payload})
}

// List returns one page of persisted events, newest first.
func (r *EventLog) List(ctx context.Context, p listing.Params) (listing.Page[audit.Entry], error) {
	rows, err := r.q.ListEventLog(ctx, db.ListEventLogParams{
		PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[audit.Entry]{}, err
	}
	total, err := r.q.CountEventLog(ctx)
	if err != nil {
		return listing.Page[audit.Entry]{}, err
	}
	items := make([]audit.Entry, 0, len(rows))
	for _, row := range rows {
		items = append(items, toEntry(row))
	}
	return listing.Page[audit.Entry]{Items: items, Total: int(total)}, nil
}

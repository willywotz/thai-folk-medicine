// Package audit persists every domain event to a durable read model.
package audit

import (
	"context"
	"encoding/json"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
)

// Recorder persists every published domain event as an audit.Entry.
// Subscribed via (*eventbus.Bus).SubscribeAll.
type Recorder struct {
	repo audit.Repository
}

// NewRecorder builds the recorder.
func NewRecorder(repo audit.Repository) *Recorder {
	return &Recorder{repo: repo}
}

// Handle marshals the event and records it.
func (r *Recorder) Handle(ctx context.Context, e event.Event) error {
	payload, err := json.Marshal(e)
	if err != nil {
		return err
	}
	return r.repo.Record(ctx, e.EventName(), payload)
}

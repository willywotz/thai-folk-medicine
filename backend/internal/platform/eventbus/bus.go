// Package eventbus is an in-process implementation of the event port.
// withinlazy: synchronous in-process bus; swap for a broker (NATS) if the app
// splits into services. Events do not survive a restart.
package eventbus

import (
	"context"
	"log/slog"
	"sync"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
)

// Bus dispatches events to subscribed handlers, synchronously and in-process.
type Bus struct {
	mu      sync.RWMutex
	handler map[string][]event.Handler
	all     []event.Handler
	logger  *slog.Logger
}

// New builds an empty bus.
func New(logger *slog.Logger) *Bus {
	return &Bus{handler: make(map[string][]event.Handler), logger: logger}
}

// Subscribe registers a handler for one event name.
func (b *Bus) Subscribe(name string, h event.Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handler[name] = append(b.handler[name], h)
}

// SubscribeAll registers a handler that runs for every published event,
// after the name-keyed handlers.
func (b *Bus) SubscribeAll(h event.Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.all = append(b.all, h)
}

// Publish logs the event and runs its handlers. Handler errors are logged, not
// returned: a write must not fail because a reaction failed.
func (b *Bus) Publish(ctx context.Context, e event.Event) {
	name := e.EventName()
	b.logger.InfoContext(ctx, "event published", "event", name)

	b.mu.RLock()
	handler := b.handler[name]
	all := b.all
	b.mu.RUnlock()

	for _, h := range handler {
		if err := h(ctx, e); err != nil {
			b.logger.ErrorContext(ctx, "event handler failed", "event", name, "error", err)
		}
	}
	for _, h := range all {
		if err := h(ctx, e); err != nil {
			b.logger.ErrorContext(ctx, "event handler failed", "event", name, "error", err)
		}
	}
}

package usecase

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
)

// Publisher publishes domain events. The concrete eventbus.Bus satisfies it.
type Publisher interface {
	Publish(ctx context.Context, e event.Event)
}

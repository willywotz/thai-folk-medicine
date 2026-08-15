package eventbus

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
)

type sampleEvent struct{ name string }

func (e sampleEvent) EventName() string { return e.name }

func newSilentBus() *Bus {
	return New(slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestPublishRunsSubscribedHandler(t *testing.T) {
	bus := newSilentBus()
	var got string
	bus.Subscribe("healer.created", func(_ context.Context, e event.Event) error {
		got = e.EventName()
		return nil
	})

	bus.Publish(context.Background(), sampleEvent{name: "healer.created"})

	assert.Equal(t, "healer.created", got)
}

func TestPublishSkipsOtherNames(t *testing.T) {
	bus := newSilentBus()
	called := false
	bus.Subscribe("healer.updated", func(context.Context, event.Event) error {
		called = true
		return nil
	})

	bus.Publish(context.Background(), sampleEvent{name: "healer.created"})

	assert.False(t, called)
}

func TestPublishSwallowsHandlerError(t *testing.T) {
	bus := newSilentBus()
	bus.Subscribe("healer.created", func(context.Context, event.Event) error {
		return errors.New("handler failed")
	})

	// Must not panic and must not propagate: publishing is fire-and-forget.
	assert.NotPanics(t, func() {
		bus.Publish(context.Background(), sampleEvent{name: "healer.created"})
	})
}

func TestSubscribeAllReceivesEveryEvent(t *testing.T) {
	bus := newSilentBus()
	var got []string
	bus.SubscribeAll(func(_ context.Context, e event.Event) error {
		got = append(got, e.EventName())
		return nil
	})

	bus.Publish(context.Background(), sampleEvent{name: "a.created"})
	bus.Publish(context.Background(), sampleEvent{name: "b.updated"})

	assert.Equal(t, []string{"a.created", "b.updated"}, got)
}

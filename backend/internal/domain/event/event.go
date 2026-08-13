// Package event defines the domain event port. It imports no framework code.
package event

import "context"

// Event is a domain event. Its name identifies the kind for subscribers.
type Event interface {
	EventName() string
}

// Handler reacts to a published event.
type Handler func(context.Context, Event) error

# Healer + In-Process Event Bus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Healer aggregate (public read + staff write) and an in-process event bus that publishes domain events on every write.

**Architecture:** Clean Architecture, continuing Plan 1's layout. New: a pure `event` port (interface), an infrastructure `eventbus.Bus`, and a `usecase.Publisher` seam. Healer use cases publish `healer.created` / `healer.updated` / `healer.deleted` after a successful write; an audit handler logs each event. A small `RouteRegistrar` refactor lets each handler register its own routes, so the router stops changing shape every plan.

**Tech Stack:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, log/slog, testify, testcontainers-go.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§6 healer, §7 routes, §8 events).

## Global Constraints

- **Go version:** 1.26.5+. **Module:** `github.com/willywotz/thai-folk-medicine/backend`.
- **Clean Architecture:** `internal/domain/*` and `internal/usecase` import NO framework code (no gin, pgx, sqlc `db`, or the concrete `eventbus`). The `event` port and healer events are pure Go. Gin only in `internal/adapter/http`; pgx/sqlc only in `internal/adapter/repository*` and `internal/platform/*`.
- **Event-Driven:** every healer write publishes a domain event through the `usecase.Publisher` interface. Use cases never import the concrete bus.
- **Routes:** full English names, under `/api/v1`. Public read: `GET /api/v1/districts/{districtId}/healers`, `GET /api/v1/healers/{healerId}`. Staff write: `POST /api/v1/healers`, `PUT /api/v1/healers/{healerId}`, `DELETE /api/v1/healers/{healerId}`.
- **AUTH DEFERRED (ruling):** JWT auth arrives in Plan 4. In this plan the write routes are **not** guarded. Mark the write route registration with a `// withinlazy: unguarded until Plan 4 adds JWT middleware` comment. Do not deploy publicly before Plan 4.
- **Nullable text columns:** `sub_district`, `specialty`, `biography` are `TEXT NOT NULL DEFAULT ''` — empty string means "not provided". This keeps sqlc types plain `string` (no null handling). This is a deliberate simplification.
- **Input validation at the write boundary:** `fullName` must be non-empty and `districtId` > 0 — validated in the use case (a trust boundary; do not skip).
- **TDD:** red → green → refactor for every unit. **Commits:** Conventional Commits, one per task. **Branch:** `feat/healer-events` (already created).
- **Integration tests** need Docker; on this host set `TESTCONTAINERS_RYUK_DISABLED=true`.

---

### Task 1: In-process event bus

**Files:**
- Create: `backend/internal/domain/event/event.go`
- Create: `backend/internal/platform/eventbus/bus.go`
- Test: `backend/internal/platform/eventbus/bus_test.go`

**Interfaces:**
- Produces: `event.Event` interface (`EventName() string`); `event.Handler = func(context.Context, event.Event) error`.
- Produces: `eventbus.New(logger *slog.Logger) *eventbus.Bus`; methods `Subscribe(name string, h event.Handler)` and `Publish(ctx context.Context, e event.Event)`. `Publish` logs each event at Info, runs the handlers subscribed to that event's name, and logs (does not return) any handler error.

- [ ] **Step 1: Write the pure event port**

Create `backend/internal/domain/event/event.go`:

```go
// Package event defines the domain event port. It imports no framework code.
package event

import "context"

// Event is a domain event. Its name identifies the kind for subscribers.
type Event interface {
	EventName() string
}

// Handler reacts to a published event.
type Handler func(context.Context, Event) error
```

- [ ] **Step 2: Write the failing bus test**

Create `backend/internal/platform/eventbus/bus_test.go`:

```go
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && go test ./internal/platform/eventbus/... -v`
Expected: FAIL (compile error — `New`, `Bus` undefined).

- [ ] **Step 4: Write the bus**

Create `backend/internal/platform/eventbus/bus.go`:

```go
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
	mu       sync.RWMutex
	handler  map[string][]event.Handler
	logger   *slog.Logger
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

// Publish logs the event and runs its handlers. Handler errors are logged, not
// returned: a write must not fail because a reaction failed.
func (b *Bus) Publish(ctx context.Context, e event.Event) {
	name := e.EventName()
	b.logger.InfoContext(ctx, "event published", "event", name)

	b.mu.RLock()
	handler := b.handler[name]
	b.mu.RUnlock()

	for _, h := range handler {
		if err := h(ctx, e); err != nil {
			b.logger.ErrorContext(ctx, "event handler failed", "event", name, "error", err)
		}
	}
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && go test ./internal/platform/eventbus/... -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

Note for the orchestrator: builder does not commit; leave changes staged for Main.

---

### Task 2: Healer domain, migration, sqlc queries, repository

**Files:**
- Create: `backend/internal/domain/healer/healer.go`
- Create: `backend/migrations/000003_create_healer.up.sql`
- Create: `backend/migrations/000003_create_healer.down.sql`
- Modify: `backend/internal/adapter/repository/query/healer.sql` (new file)
- Create (generated): regenerate `backend/internal/adapter/repository/db/*` via `sqlc generate`
- Create: `backend/internal/adapter/repository/healer_repository.go`
- Test: `backend/internal/adapter/repository/healer_repository_test.go`

**Interfaces:**
- Produces: `healer.Healer{ ID, DistrictID int64; FullName, SubDistrict, Specialty, Biography string; CreatedAt, UpdatedAt time.Time }`.
- Produces: `healer.CreateParams{ DistrictID int64; FullName, SubDistrict, Specialty, Biography string }` and `healer.UpdateParams{ ID, DistrictID int64; FullName, SubDistrict, Specialty, Biography string }`.
- Produces: `healer.ErrNotFound` (a sentinel error).
- Produces: `healer.Repository` interface: `Create(ctx, CreateParams) (Healer, error)`, `GetByID(ctx, id int64) (Healer, error)` (returns `ErrNotFound` when absent), `ListByDistrict(ctx, districtID int64) ([]Healer, error)`, `Update(ctx, UpdateParams) (Healer, error)` (`ErrNotFound` when absent), `Delete(ctx, id int64) error` (`ErrNotFound` when absent).
- Produces: `healer.CreatedEvent{HealerID int64}`, `healer.UpdatedEvent{HealerID int64}`, `healer.DeletedEvent{HealerID int64}`, each with `EventName()` returning `"healer.created"` / `"healer.updated"` / `"healer.deleted"`.
- Produces: `repository.NewHealer(q *db.Queries) *repository.Healer`.
- Consumes: `db.New`, `database.NewPool`, `database.Migrate` from Plan 1.

- [ ] **Step 1: Write the healer domain**

Create `backend/internal/domain/healer/healer.go`:

```go
// Package healer holds the healer entity, its events, and repository interface.
// It imports no framework code.
package healer

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no healer has the given id.
var ErrNotFound = errors.New("healer not found")

// Healer is one local folk-medicine healer (หมอพื้นบ้าน).
type Healer struct {
	ID          int64
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// CreateParams holds the fields to create a healer.
type CreateParams struct {
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
}

// UpdateParams holds the fields to update a healer.
type UpdateParams struct {
	ID          int64
	DistrictID  int64
	FullName    string
	SubDistrict string
	Specialty   string
	Biography   string
}

// Repository stores and reads healers.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Healer, error)
	GetByID(ctx context.Context, id int64) (Healer, error)
	ListByDistrict(ctx context.Context, districtID int64) ([]Healer, error)
	Update(ctx context.Context, p UpdateParams) (Healer, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a healer is created.
type CreatedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "healer.created" }

// UpdatedEvent is published after a healer is updated.
type UpdatedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "healer.updated" }

// DeletedEvent is published after a healer is deleted.
type DeletedEvent struct{ HealerID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "healer.deleted" }
```

- [ ] **Step 2: Write the healer migration**

Create `backend/migrations/000003_create_healer.up.sql`:

```sql
CREATE TABLE healer (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id  BIGINT NOT NULL REFERENCES district (id),
    full_name    TEXT NOT NULL,
    sub_district TEXT NOT NULL DEFAULT '',
    specialty    TEXT NOT NULL DEFAULT '',
    biography    TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX healer_district_id_idx ON healer (district_id);
```

Create `backend/migrations/000003_create_healer.down.sql`:

```sql
DROP TABLE IF EXISTS healer;
```

- [ ] **Step 3: Write the healer queries**

Create `backend/internal/adapter/repository/query/healer.sql`:

```sql
-- name: CreateHealer :one
INSERT INTO healer (district_id, full_name, sub_district, specialty, biography)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: GetHealer :one
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE id = $1;

-- name: ListHealerByDistrict :many
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE district_id = $1
ORDER BY full_name;

-- name: UpdateHealer :one
UPDATE healer
SET district_id = $2, full_name = $3, sub_district = $4, specialty = $5, biography = $6, updated_at = now()
WHERE id = $1
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: DeleteHealer :execrows
DELETE FROM healer WHERE id = $1;
```

- [ ] **Step 4: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: the `db` package gains `CreateHealer`, `GetHealer`, `ListHealerByDistrict`, `UpdateHealer`, `DeleteHealer` methods, a `db.Healer` model (fields `int64`/`string`/`time.Time`), and `CreateHealerParams`/`UpdateHealerParams` structs. `DeleteHealer` returns `(int64, error)` (rows affected).

- [ ] **Step 5: Write the failing repository integration test**

Create `backend/internal/adapter/repository/healer_repository_test.go`:

```go
package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// firstDistrictID returns a seeded Yasothon district id for foreign keys.
func firstDistrictID(t *testing.T, ctx context.Context, r *Location) int64 {
	t.Helper()
	provinces, err := r.ListProvince(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, provinces)
	districts, err := r.ListDistrictByProvince(ctx, provinces[0].ID)
	require.NoError(t, err)
	require.NotEmpty(t, districts)
	return districts[0].ID
}

func TestHealerCreateAndGet(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	created, err := repo.Create(ctx, healer.CreateParams{
		DistrictID: districtID,
		FullName:   "หมอสมชาย",
		Specialty:  "สมุนไพร",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "หมอสมชาย", created.FullName)
	assert.Equal(t, "", created.SubDistrict)
	assert.False(t, created.CreatedAt.IsZero())

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
	assert.Equal(t, "สมุนไพร", got.Specialty)
}

func TestHealerGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewHealer(queries)

	_, err := repo.GetByID(ctx, 999999)

	assert.True(t, errors.Is(err, healer.ErrNotFound))
}

func TestHealerListByDistrict(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	_, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ก"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอ ข"})
	require.NoError(t, err)

	list, err := repo.ListByDistrict(ctx, districtID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestHealerUpdateAndDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	repo := NewHealer(queries)

	created, err := repo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "เดิม"})
	require.NoError(t, err)

	updated, err := repo.Update(ctx, healer.UpdateParams{
		ID: created.ID, DistrictID: districtID, FullName: "ใหม่", Biography: "ประวัติ",
	})
	require.NoError(t, err)
	assert.Equal(t, "ใหม่", updated.FullName)
	assert.Equal(t, "ประวัติ", updated.Biography)

	require.NoError(t, repo.Delete(ctx, created.ID))

	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, healer.ErrNotFound))

	err = repo.Delete(ctx, created.ID)
	assert.True(t, errors.Is(err, healer.ErrNotFound))
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run Healer -v`
Expected: FAIL (compile error — `NewHealer` undefined).

- [ ] **Step 7: Write the healer repository**

Create `backend/internal/adapter/repository/healer_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// Healer stores and reads healers in Postgres.
type Healer struct {
	q *db.Queries
}

// NewHealer builds the healer repository.
func NewHealer(q *db.Queries) *Healer {
	return &Healer{q: q}
}

func toHealer(row db.Healer) healer.Healer {
	return healer.Healer{
		ID:          row.ID,
		DistrictID:  row.DistrictID,
		FullName:    row.FullName,
		SubDistrict: row.SubDistrict,
		Specialty:   row.Specialty,
		Biography:   row.Biography,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

// Create inserts a healer.
func (r *Healer) Create(ctx context.Context, p healer.CreateParams) (healer.Healer, error) {
	row, err := r.q.CreateHealer(ctx, db.CreateHealerParams{
		DistrictID:  p.DistrictID,
		FullName:    p.FullName,
		SubDistrict: p.SubDistrict,
		Specialty:   p.Specialty,
		Biography:   p.Biography,
	})
	if err != nil {
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// GetByID returns one healer or healer.ErrNotFound.
func (r *Healer) GetByID(ctx context.Context, id int64) (healer.Healer, error) {
	row, err := r.q.GetHealer(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return healer.Healer{}, healer.ErrNotFound
		}
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// ListByDistrict returns the healers in one district.
func (r *Healer) ListByDistrict(ctx context.Context, districtID int64) ([]healer.Healer, error) {
	rows, err := r.q.ListHealerByDistrict(ctx, districtID)
	if err != nil {
		return nil, err
	}
	result := make([]healer.Healer, 0, len(rows))
	for _, row := range rows {
		result = append(result, toHealer(row))
	}
	return result, nil
}

// Update changes a healer or returns healer.ErrNotFound.
func (r *Healer) Update(ctx context.Context, p healer.UpdateParams) (healer.Healer, error) {
	row, err := r.q.UpdateHealer(ctx, db.UpdateHealerParams{
		ID:          p.ID,
		DistrictID:  p.DistrictID,
		FullName:    p.FullName,
		SubDistrict: p.SubDistrict,
		Specialty:   p.Specialty,
		Biography:   p.Biography,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return healer.Healer{}, healer.ErrNotFound
		}
		return healer.Healer{}, err
	}
	return toHealer(row), nil
}

// Delete removes a healer or returns healer.ErrNotFound.
func (r *Healer) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteHealer(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return healer.ErrNotFound
	}
	return nil
}
```

Note: verify the sqlc-generated field name for the params structs (`db.CreateHealerParams`, `db.UpdateHealerParams`) and the `DeleteHealer` return type (`int64` rows). Adjust field names if sqlc emits different casing.

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -v`
Expected: PASS (the four healer tests plus the existing location tests).

- [ ] **Step 9: Commit** (orchestrator commits; builder leaves changes staged.)

---

### Task 3: Healer use case with event publishing

**Files:**
- Create: `backend/internal/usecase/publisher.go`
- Create: `backend/internal/usecase/healer_service.go`
- Test: `backend/internal/usecase/healer_service_test.go`

**Interfaces:**
- Produces: `usecase.Publisher` interface: `Publish(ctx context.Context, e event.Event)`. (The `eventbus.Bus` from Task 1 satisfies it.)
- Produces: `usecase.ErrInvalidHealer` (validation sentinel).
- Produces: `usecase.NewHealerService(repo healer.Repository, publisher Publisher) *usecase.HealerService`.
- Produces: methods `Create(ctx, healer.CreateParams) (healer.Healer, error)`, `Get(ctx, id int64) (healer.Healer, error)`, `ListByDistrict(ctx, districtID int64) ([]healer.Healer, error)`, `Update(ctx, healer.UpdateParams) (healer.Healer, error)`, `Delete(ctx, id int64) error`. Create publishes `healer.CreatedEvent`, Update publishes `healer.UpdatedEvent`, Delete publishes `healer.DeletedEvent`, each only after the repository succeeds.
- Consumes: `healer.Repository`, `healer.*Params`, `healer.*Event`, `event.Event`.

- [ ] **Step 1: Write the Publisher port**

Create `backend/internal/usecase/publisher.go`:

```go
package usecase

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
)

// Publisher publishes domain events. The concrete eventbus.Bus satisfies it.
type Publisher interface {
	Publish(ctx context.Context, e event.Event)
}
```

- [ ] **Step 2: Write the failing use case test**

Create `backend/internal/usecase/healer_service_test.go`:

```go
package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

type fakeHealerRepo struct {
	created   healer.Healer
	createErr error
	deleteErr error
	updateErr error
	lastCreate healer.CreateParams
}

func (f *fakeHealerRepo) Create(_ context.Context, p healer.CreateParams) (healer.Healer, error) {
	f.lastCreate = p
	if f.createErr != nil {
		return healer.Healer{}, f.createErr
	}
	f.created = healer.Healer{ID: 1, DistrictID: p.DistrictID, FullName: p.FullName}
	return f.created, nil
}
func (f *fakeHealerRepo) GetByID(context.Context, int64) (healer.Healer, error) {
	return f.created, nil
}
func (f *fakeHealerRepo) ListByDistrict(context.Context, int64) ([]healer.Healer, error) {
	return []healer.Healer{f.created}, nil
}
func (f *fakeHealerRepo) Update(_ context.Context, p healer.UpdateParams) (healer.Healer, error) {
	if f.updateErr != nil {
		return healer.Healer{}, f.updateErr
	}
	return healer.Healer{ID: p.ID, FullName: p.FullName}, nil
}
func (f *fakeHealerRepo) Delete(context.Context, int64) error { return f.deleteErr }

type recordingPublisher struct{ events []event.Event }

func (r *recordingPublisher) Publish(_ context.Context, e event.Event) {
	r.events = append(r.events, e)
}

func TestCreateHealerPublishesCreatedEvent(t *testing.T) {
	repo := &fakeHealerRepo{}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	got, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "หมอ ก"})

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.created", pub.events[0].EventName())
}

func TestCreateHealerRejectsEmptyName(t *testing.T) {
	repo := &fakeHealerRepo{}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "  "})

	assert.ErrorIs(t, err, ErrInvalidHealer)
	assert.Empty(t, pub.events, "no event on validation failure")
}

func TestCreateHealerRejectsBadDistrict(t *testing.T) {
	service := NewHealerService(&fakeHealerRepo{}, &recordingPublisher{})

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 0, FullName: "หมอ"})

	assert.ErrorIs(t, err, ErrInvalidHealer)
}

func TestCreateHealerNoEventOnRepoError(t *testing.T) {
	repo := &fakeHealerRepo{createErr: errors.New("db down")}
	pub := &recordingPublisher{}
	service := NewHealerService(repo, pub)

	_, err := service.Create(context.Background(), healer.CreateParams{DistrictID: 2, FullName: "หมอ"})

	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestDeleteHealerPublishesDeletedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewHealerService(&fakeHealerRepo{}, pub)

	require.NoError(t, service.Delete(context.Background(), 5))

	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.deleted", pub.events[0].EventName())
}

func TestUpdateHealerPublishesUpdatedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewHealerService(&fakeHealerRepo{}, pub)

	_, err := service.Update(context.Background(), healer.UpdateParams{ID: 5, DistrictID: 2, FullName: "หมอ"})

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "healer.updated", pub.events[0].EventName())
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && go test ./internal/usecase/... -run Healer -v`
Expected: FAIL (compile error — `NewHealerService`, `ErrInvalidHealer` undefined).

- [ ] **Step 4: Write the healer service**

Create `backend/internal/usecase/healer_service.go`:

```go
package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
)

// ErrInvalidHealer means the healer input failed validation.
var ErrInvalidHealer = errors.New("invalid healer")

// HealerService creates, reads, and changes healers, publishing events on write.
type HealerService struct {
	repo      healer.Repository
	publisher Publisher
}

// NewHealerService builds the healer service.
func NewHealerService(repo healer.Repository, publisher Publisher) *HealerService {
	return &HealerService{repo: repo, publisher: publisher}
}

// Create validates and stores a healer, then publishes CreatedEvent.
func (s *HealerService) Create(ctx context.Context, p healer.CreateParams) (healer.Healer, error) {
	if strings.TrimSpace(p.FullName) == "" || p.DistrictID <= 0 {
		return healer.Healer{}, ErrInvalidHealer
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return healer.Healer{}, err
	}
	s.publisher.Publish(ctx, healer.CreatedEvent{HealerID: created.ID})
	return created, nil
}

// Get returns one healer.
func (s *HealerService) Get(ctx context.Context, id int64) (healer.Healer, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByDistrict returns the healers in one district.
func (s *HealerService) ListByDistrict(ctx context.Context, districtID int64) ([]healer.Healer, error) {
	return s.repo.ListByDistrict(ctx, districtID)
}

// Update validates and changes a healer, then publishes UpdatedEvent.
func (s *HealerService) Update(ctx context.Context, p healer.UpdateParams) (healer.Healer, error) {
	if strings.TrimSpace(p.FullName) == "" || p.DistrictID <= 0 {
		return healer.Healer{}, ErrInvalidHealer
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return healer.Healer{}, err
	}
	s.publisher.Publish(ctx, healer.UpdatedEvent{HealerID: updated.ID})
	return updated, nil
}

// Delete removes a healer, then publishes DeletedEvent.
func (s *HealerService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, healer.DeletedEvent{HealerID: id})
	return nil
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && go test ./internal/usecase/... -v`
Expected: PASS (healer tests + the existing location tests).

- [ ] **Step 6: Commit** (orchestrator commits.)

---

### Task 4: Healer HTTP handlers + RouteRegistrar refactor + wiring

**Files:**
- Create: `backend/internal/adapter/http/healer_handler.go`
- Test: `backend/internal/adapter/http/healer_handler_test.go`
- Modify: `backend/internal/adapter/http/router.go` (RouteRegistrar refactor)
- Modify: `backend/internal/adapter/http/location_handler.go` (add `RegisterRoutes`)
- Modify: `backend/internal/adapter/http/health_handler_test.go` (new `NewRouter()` call)
- Modify: `backend/internal/adapter/http/location_handler_test.go` (new router construction)
- Modify: `backend/cmd/api/main.go` (build bus, subscribe audit handler, wire healer)

**Interfaces:**
- Produces: `httpapi.RouteRegistrar` interface: `RegisterRoutes(rg *gin.RouterGroup)`.
- Produces: `httpapi.NewRouter(registrar ...RouteRegistrar) *gin.Engine` (registers `/health` and an `/api/v1` group, then lets each registrar add its routes).
- Produces: `httpapi.NewHealerHandler(service *usecase.HealerService) *httpapi.HealerHandler` with `RegisterRoutes`.
- Modifies: `LocationHandler` gains `RegisterRoutes(rg *gin.RouterGroup)`; its two routes move out of `NewRouter` into that method.
- Consumes: `usecase.HealerService`, `healer.ErrNotFound`, `usecase.ErrInvalidHealer`.

- [ ] **Step 1: Refactor the router to use RouteRegistrar**

Replace `backend/internal/adapter/http/router.go` with:

```go
// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// RouteRegistrar registers its routes onto the versioned API group.
type RouteRegistrar interface {
	RegisterRoutes(rg *gin.RouterGroup)
}

// NewRouter builds the Gin engine, mounts /health, and lets each registrar add
// its routes under /api/v1.
func NewRouter(registrar ...RouteRegistrar) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	v1 := r.Group("/api/v1")
	for _, reg := range registrar {
		reg.RegisterRoutes(v1)
	}
	return r
}
```

- [ ] **Step 2: Move the location routes into LocationHandler.RegisterRoutes**

In `backend/internal/adapter/http/location_handler.go`, add the method (keep the handler methods and DTOs as they are):

```go
// RegisterRoutes mounts the province and district read routes.
func (h *LocationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/provinces", h.ListProvince)
	rg.GET("/provinces/:provinceId/districts", h.ListDistrictByProvince)
}
```

- [ ] **Step 3: Update the two existing tests for the new router shape**

In `backend/internal/adapter/http/health_handler_test.go`, change the router construction to take no registrars:

```go
	router := NewRouter()
```

In `backend/internal/adapter/http/location_handler_test.go`, change `newTestRouter` so the handler registers itself:

```go
func newTestRouter(repo location.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewLocationService(repo)
	handler := NewLocationHandler(service)
	return NewRouter(handler)
}
```

- [ ] **Step 4: Write the failing healer handler test**

Create `backend/internal/adapter/http/healer_handler_test.go`:

```go
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubHealerRepo struct {
	getErr  error
	created healer.Healer
}

func (s *stubHealerRepo) Create(_ context.Context, p healer.CreateParams) (healer.Healer, error) {
	return healer.Healer{ID: 1, DistrictID: p.DistrictID, FullName: p.FullName}, nil
}
func (s *stubHealerRepo) GetByID(_ context.Context, id int64) (healer.Healer, error) {
	if s.getErr != nil {
		return healer.Healer{}, s.getErr
	}
	return healer.Healer{ID: id, FullName: "หมอ ก"}, nil
}
func (s *stubHealerRepo) ListByDistrict(_ context.Context, districtID int64) ([]healer.Healer, error) {
	return []healer.Healer{{ID: 1, DistrictID: districtID, FullName: "หมอ ก"}}, nil
}
func (s *stubHealerRepo) Update(_ context.Context, p healer.UpdateParams) (healer.Healer, error) {
	return healer.Healer{ID: p.ID, FullName: p.FullName}, nil
}
func (s *stubHealerRepo) Delete(context.Context, int64) error { return nil }

type noopPublisher struct{}

func (noopPublisher) Publish(context.Context, event.Event) {}

func newHealerRouter(repo healer.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewHealerService(repo, noopPublisher{})
	return NewRouter(NewHealerHandler(service))
}

func TestCreateHealerEndpoint(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	body, _ := json.Marshal(map[string]any{"districtId": 2, "fullName": "หมอ ก", "specialty": "สมุนไพร"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/healers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "หมอ ก", got["fullName"])
	assert.Equal(t, float64(2), got["districtId"])
}

func TestCreateHealerRejectsEmptyName(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	body, _ := json.Marshal(map[string]any{"districtId": 2, "fullName": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/healers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetHealerNotFound(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{getErr: healer.ErrNotFound})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/healers/1", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListHealerByDistrictEndpoint(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/districts/2/healers", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, float64(2), got[0]["districtId"])
}
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: FAIL (compile error — `NewHealerHandler` undefined).

- [ ] **Step 6: Write the healer handler**

Create `backend/internal/adapter/http/healer_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// HealerHandler serves the healer read and write endpoints.
type HealerHandler struct {
	service *usecase.HealerService
}

// NewHealerHandler builds the healer handler.
func NewHealerHandler(service *usecase.HealerService) *HealerHandler {
	return &HealerHandler{service: service}
}

// RegisterRoutes mounts the healer routes.
func (h *HealerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/districts/:districtId/healers", h.ListByDistrict)
	rg.GET("/healers/:healerId", h.Get)
	// withinlazy: unguarded until Plan 4 adds JWT middleware on the write routes.
	rg.POST("/healers", h.Create)
	rg.PUT("/healers/:healerId", h.Update)
	rg.DELETE("/healers/:healerId", h.Delete)
}

type healerDTO struct {
	ID          int64     `json:"id"`
	DistrictID  int64     `json:"districtId"`
	FullName    string    `json:"fullName"`
	SubDistrict string    `json:"subDistrict"`
	Specialty   string    `json:"specialty"`
	Biography   string    `json:"biography"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func toHealerDTO(h healer.Healer) healerDTO {
	return healerDTO{
		ID:          h.ID,
		DistrictID:  h.DistrictID,
		FullName:    h.FullName,
		SubDistrict: h.SubDistrict,
		Specialty:   h.Specialty,
		Biography:   h.Biography,
		CreatedAt:   h.CreatedAt,
		UpdatedAt:   h.UpdatedAt,
	}
}

type healerRequest struct {
	DistrictID  int64  `json:"districtId"`
	FullName    string `json:"fullName"`
	SubDistrict string `json:"subDistrict"`
	Specialty   string `json:"specialty"`
	Biography   string `json:"biography"`
}

// ListByDistrict handles GET /api/v1/districts/:districtId/healers.
func (h *HealerHandler) ListByDistrict(c *gin.Context) {
	districtID, err := strconv.ParseInt(c.Param("districtId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "district id must be a number"})
		return
	}
	list, err := h.service.ListByDistrict(c.Request.Context(), districtID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list healers"})
		return
	}
	out := make([]healerDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toHealerDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/healers/:healerId.
func (h *HealerHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, healer.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read healer"})
		return
	}
	c.JSON(http.StatusOK, toHealerDTO(found))
}

// Create handles POST /api/v1/healers.
func (h *HealerHandler) Create(c *gin.Context) {
	var req healerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), healer.CreateParams{
		DistrictID:  req.DistrictID,
		FullName:    req.FullName,
		SubDistrict: req.SubDistrict,
		Specialty:   req.Specialty,
		Biography:   req.Biography,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidHealer) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "full name is required and district id must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create healer"})
		return
	}
	c.JSON(http.StatusCreated, toHealerDTO(created))
}

// Update handles PUT /api/v1/healers/:healerId.
func (h *HealerHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	var req healerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), healer.UpdateParams{
		ID:          id,
		DistrictID:  req.DistrictID,
		FullName:    req.FullName,
		SubDistrict: req.SubDistrict,
		Specialty:   req.Specialty,
		Biography:   req.Biography,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidHealer):
			c.JSON(http.StatusBadRequest, gin.H{"error": "full name is required and district id must be valid"})
		case errors.Is(err, healer.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update healer"})
		}
		return
	}
	c.JSON(http.StatusOK, toHealerDTO(updated))
}

// Delete handles DELETE /api/v1/healers/:healerId.
func (h *HealerHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, healer.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete healer"})
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 7: Run the handler tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: PASS (health + location + the four healer tests).

- [ ] **Step 8: Wire the bus and healer into main**

Rewrite the wiring section of `backend/cmd/api/main.go` so it builds the event bus, subscribes an audit handler, and wires the healer stack. The full file:

```go
// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"context"
	"log/slog"
	"os"

	httpapi "github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/eventbus"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.Error("run migrations", "error", err)
		os.Exit(1)
	}

	pool, err := database.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Error("open pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	queries := db.New(pool)

	bus := eventbus.New(logger)
	bus.Subscribe("healer.created", auditHandler(logger))
	bus.Subscribe("healer.updated", auditHandler(logger))
	bus.Subscribe("healer.deleted", auditHandler(logger))

	locationHandler := httpapi.NewLocationHandler(
		usecase.NewLocationService(repository.NewLocation(queries)),
	)
	healerHandler := httpapi.NewHealerHandler(
		usecase.NewHealerService(repository.NewHealer(queries), bus),
	)

	router := httpapi.NewRouter(locationHandler, healerHandler)

	logger.Info("starting server", "port", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

// auditHandler logs each domain event. It is the first event subscriber.
func auditHandler(logger *slog.Logger) event.Handler {
	return func(ctx context.Context, e event.Event) error {
		logger.InfoContext(ctx, "audit", "event", e.EventName())
		return nil
	}
}
```

- [ ] **Step 9: Run the full build and suite**

Run: `cd backend && go build ./... && go vet ./... && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: build + vet clean; every package PASS.

- [ ] **Step 10: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage:**
- Healer entity + fields (spec §6.1) — Task 2. ✓
- Public read routes `GET /districts/{districtId}/healers`, `GET /healers/{healerId}` (spec §7.1) — Task 4. ✓
- Staff write routes POST/PUT/DELETE `/healers` (spec §7.2) — Task 4, unguarded (auth is Plan 4, ruled + commented). ✓
- In-process event bus + `EventPublisher` seam + audit handler; `HealerCreated`/`Updated`/`Deleted` (spec §8) — Tasks 1, 3, 4. ✓
- Clean Architecture: domain/usecase import no framework; `event` port is pure; bus in platform — Tasks 1–3. ✓

**Placeholder scan:** No TBD/TODO. Each code step has real code. Error mapping is concrete (not found → 404, invalid → 400, created → 201, deleted → 204).

**Type consistency:** `healer.Healer`, `CreateParams`, `UpdateParams`, and the event names (`healer.created/updated/deleted`) are used identically across domain (T2), repository (T2), use case (T3), handler + wiring (T4). `Publisher.Publish(ctx, event.Event)` is defined in T3 and satisfied by `eventbus.Bus` from T1 (matching signature). `NewRouter` becomes variadic `RouteRegistrar` in T4, and every caller (health test, location test, main) is updated in the same task. `DeleteHealer` uses `:execrows` → repo checks rows==0 → `ErrNotFound`, consistent with the handler's 404 mapping.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-healer-and-event-bus.md`.

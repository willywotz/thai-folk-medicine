# Remedy + Treatment Case — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Remedy aggregate (belongs to a healer) and the Treatment Case aggregate (belongs to a remedy + healer), each with public read + staff write and domain events, and map foreign-key violations to a clean 409 instead of a 500.

**Architecture:** Clean Architecture, continuing Plans 1–2. Each aggregate copies the established pattern: pure domain (entity + events + repository interface + sentinels) → use case (validates, publishes events) → Postgres repository (sqlc) → Gin handler (RouteRegistrar). Delete methods translate a Postgres FK violation (SQLSTATE 23503) into a domain `ErrReferenced`, surfaced as HTTP 409.

**Tech Stack:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, log/slog, testify, testcontainers-go.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§6 remedy/case, §7 routes, §8 events).

## Global Constraints

- **Go:** 1.26.5+. **Module:** `github.com/willywotz/thai-folk-medicine/backend`.
- **Clean Architecture:** `internal/domain/*` and `internal/usecase` import NO framework code (no gin, pgx, pgtype, sqlc `db`, concrete `eventbus`). Gin only in `internal/adapter/http`; pgx/pgtype/sqlc only in repository + `db` + `platform`.
- **Event-Driven:** every write publishes through `usecase.Publisher`, only AFTER the repository succeeds. Events: `remedy.created/updated/deleted`, `treatmentcase.created/updated/deleted`. The audit handler subscribes to all of them.
- **Routes (full English, under `/api/v1`):**
  - Remedy read: `GET /healers/{healerId}/remedies`, `GET /remedies/{remedyId}`.
  - Remedy write: `POST /remedies`, `PUT /remedies/{remedyId}`, `DELETE /remedies/{remedyId}`.
  - Case read: `GET /remedies/{remedyId}/treatment-cases`, `GET /treatment-cases/{treatmentCaseId}`.
  - Case write: `POST /treatment-cases`, `PUT /treatment-cases/{treatmentCaseId}`, `DELETE /treatment-cases/{treatmentCaseId}`.
- **AUTH DEFERRED:** write routes remain unguarded until Plan 4. Mark write route registration with `// withinlazy: unguarded until Plan 4 adds JWT middleware`.
- **Patient privacy (spec choice A):** a case stores ONLY `patient_age` and `patient_sex` — no name, no address. Do not add patient-identifying fields.
- **Nullable text (`note`) columns:** `TEXT NOT NULL DEFAULT ''` — empty means "not provided" (keeps sqlc types plain `string`).
- **FK-violation mapping:** deleting a row another table references must return the domain's `ErrReferenced` (→ HTTP 409), never a raw 500. Detect pgx `*pgconn.PgError` with `Code == "23503"`.
- **Validation at the write boundary:** remedy needs non-empty `name` and `healerId > 0`; case needs `remedyId > 0`, `healerId > 0`, `patientAge >= 0`, non-empty `patientSex`. Validate in the use case.
- **TDD** mandatory; **Conventional Commits**, one per task; **branch** `feat/remedy-treatmentcase` (already created). Integration tests need Docker + `TESTCONTAINERS_RYUK_DISABLED=true`.

---

### Task 1: Remedy aggregate + healer FK-delete mapping

**Files:**
- Create: `backend/internal/domain/remedy/remedy.go`
- Create: `backend/migrations/000004_create_remedy.up.sql`, `.down.sql`
- Create: `backend/internal/adapter/repository/query/remedy.sql`
- Regenerate: `backend/internal/adapter/repository/db/*` (`sqlc generate`)
- Create: `backend/internal/adapter/repository/remedy_repository.go`
- Test: `backend/internal/adapter/repository/remedy_repository_test.go`
- Modify: `backend/internal/domain/healer/healer.go` (add `ErrReferenced`)
- Modify: `backend/internal/adapter/repository/healer_repository.go` (map 23503 in `Delete`)
- Modify: `backend/internal/adapter/http/healer_handler.go` (`ErrReferenced` → 409)
- Test: extend `backend/internal/adapter/repository/healer_repository_test.go` (delete-referenced → ErrReferenced)

**Interfaces:**
- Produces: `remedy.Remedy{ ID, HealerID int64; Name, Symptoms, Ingredients, PreparationMethod, Usage, Note string; CreatedAt, UpdatedAt time.Time }`.
- Produces: `remedy.CreateParams{ HealerID int64; Name, Symptoms, Ingredients, PreparationMethod, Usage, Note string }`; `remedy.UpdateParams{ ID int64; ...same fields... }`.
- Produces: `remedy.ErrNotFound`; `remedy.Repository` (`Create`, `GetByID`, `ListByHealer`, `Update`, `Delete`); events `remedy.CreatedEvent/UpdatedEvent/DeletedEvent` (names `remedy.created/updated/deleted`).
- Produces: `healer.ErrReferenced`; `repository.NewRemedy(q *db.Queries) *repository.Remedy`.
- Consumes: `healer.Repository`, `db.New`, `database.*` from earlier plans.

- [ ] **Step 1: Write the remedy domain**

Create `backend/internal/domain/remedy/remedy.go`:

```go
// Package remedy holds the remedy entity, its events, and repository interface.
// It imports no framework code.
package remedy

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no remedy has the given id.
var ErrNotFound = errors.New("remedy not found")

// ErrReferenced means the remedy still has treatment cases and cannot be deleted.
var ErrReferenced = errors.New("remedy is referenced by other records")

// Remedy is one folk-medicine remedy (ตำรับยา) of a healer.
type Remedy struct {
	ID                int64
	HealerID          int64
	Name              string
	Symptoms          string
	Ingredients       string
	PreparationMethod string
	Usage             string
	Note              string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// CreateParams holds the fields to create a remedy.
type CreateParams struct {
	HealerID          int64
	Name              string
	Symptoms          string
	Ingredients       string
	PreparationMethod string
	Usage             string
	Note              string
}

// UpdateParams holds the fields to update a remedy.
type UpdateParams struct {
	ID                int64
	Name              string
	Symptoms          string
	Ingredients       string
	PreparationMethod string
	Usage             string
	Note              string
}

// Repository stores and reads remedies.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Remedy, error)
	GetByID(ctx context.Context, id int64) (Remedy, error)
	ListByHealer(ctx context.Context, healerID int64) ([]Remedy, error)
	Update(ctx context.Context, p UpdateParams) (Remedy, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a remedy is created.
type CreatedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "remedy.created" }

// UpdatedEvent is published after a remedy is updated.
type UpdatedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "remedy.updated" }

// DeletedEvent is published after a remedy is deleted.
type DeletedEvent struct{ RemedyID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "remedy.deleted" }
```

Note: `HealerID` is on `Remedy` and `CreateParams` but NOT `UpdateParams` — a remedy does not move between healers (spec: one remedy belongs to one healer). Update changes only the content fields.

- [ ] **Step 2: Write the remedy migration**

Create `backend/migrations/000004_create_remedy.up.sql`:

```sql
CREATE TABLE remedy (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    healer_id          BIGINT NOT NULL REFERENCES healer (id),
    name               TEXT NOT NULL,
    symptoms           TEXT NOT NULL DEFAULT '',
    ingredients        TEXT NOT NULL DEFAULT '',
    preparation_method TEXT NOT NULL DEFAULT '',
    usage              TEXT NOT NULL DEFAULT '',
    note               TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX remedy_healer_id_idx ON remedy (healer_id);
```

Create `backend/migrations/000004_create_remedy.down.sql`:

```sql
DROP TABLE IF EXISTS remedy;
```

Note: `usage` is a reserved-ish word in some engines but is a valid, unreserved column name in PostgreSQL. It needs no quoting here.

- [ ] **Step 3: Write the remedy queries**

Create `backend/internal/adapter/repository/query/remedy.sql`:

```sql
-- name: CreateRemedy :one
INSERT INTO remedy (healer_id, name, symptoms, ingredients, preparation_method, usage, note)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at;

-- name: GetRemedy :one
SELECT id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE id = $1;

-- name: ListRemedyByHealer :many
SELECT id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE healer_id = $1
ORDER BY name;

-- name: UpdateRemedy :one
UPDATE remedy
SET name = $2, symptoms = $3, ingredients = $4, preparation_method = $5, usage = $6, note = $7, updated_at = now()
WHERE id = $1
RETURNING id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at;

-- name: DeleteRemedy :execrows
DELETE FROM remedy WHERE id = $1;
```

- [ ] **Step 4: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: `db` gains `CreateRemedy`, `GetRemedy`, `ListRemedyByHealer`, `UpdateRemedy`, `DeleteRemedy`, model `db.Remedy`, and `CreateRemedyParams`/`UpdateRemedyParams`. Timestamps are `pgtype.Timestamptz` (map `.Time`, as in the healer repository).

- [ ] **Step 5: Add a shared FK-violation helper and the healer ErrReferenced**

In `backend/internal/domain/healer/healer.go`, add next to `ErrNotFound`:

```go
// ErrReferenced means the healer still has remedies or cases and cannot be deleted.
var ErrReferenced = errors.New("healer is referenced by other records")
```

Create `backend/internal/adapter/repository/errors.go`:

```go
package repository

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// isForeignKeyViolation reports whether err is a Postgres FK-violation (23503).
func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
```

- [ ] **Step 6: Map the FK violation in the healer repository Delete**

In `backend/internal/adapter/repository/healer_repository.go`, change `Delete` so a FK violation becomes `healer.ErrReferenced`:

```go
// Delete removes a healer, or returns healer.ErrNotFound / healer.ErrReferenced.
func (r *Healer) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteHealer(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return healer.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return healer.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 7: Map ErrReferenced → 409 in the healer handler**

In `backend/internal/adapter/http/healer_handler.go`, extend the `Delete` handler's error switch:

```go
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, healer.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
		case errors.Is(err, healer.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "healer has remedies or cases; delete them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete healer"})
		}
		return
	}
	c.Status(http.StatusNoContent)
```

- [ ] **Step 8: Write the failing remedy repository test (+ healer referenced test)**

Create `backend/internal/adapter/repository/remedy_repository_test.go`:

```go
package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

func seedHealer(t *testing.T, ctx context.Context, queries interface {
	CreateHealer(context.Context, healer.CreateParams) (healer.Healer, error)
}) {
	t.Helper()
}

// makeHealer creates a healer and returns its id, for remedy FK tests.
func makeHealer(t *testing.T, ctx context.Context, queriesRepo *Healer, districtID int64) int64 {
	t.Helper()
	h, err := queriesRepo.Create(ctx, healer.CreateParams{DistrictID: districtID, FullName: "หมอทดสอบ"})
	require.NoError(t, err)
	return h.ID
}

func TestRemedyCreateGetListUpdateDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	repo := NewRemedy(queries)

	created, err := repo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาต้ม", Symptoms: "ไข้", Ingredients: "ฟ้าทะลายโจร",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, "ยาต้ม", created.Name)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "ฟ้าทะลายโจร", got.Ingredients)

	list, err := repo.ListByHealer(ctx, healerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	updated, err := repo.Update(ctx, remedy.UpdateParams{ID: created.ID, Name: "ยาต้มใหม่", Usage: "ดื่มวันละ 2 ครั้ง"})
	require.NoError(t, err)
	assert.Equal(t, "ยาต้มใหม่", updated.Name)
	assert.Equal(t, "ดื่มวันละ 2 ครั้ง", updated.Usage)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, remedy.ErrNotFound))
}

func TestRemedyGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	_, err := NewRemedy(queries).GetByID(ctx, 999999)
	assert.True(t, errors.Is(err, remedy.ErrNotFound))
}

func TestDeleteHealerWithRemedyReturnsReferenced(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerRepo := NewHealer(queries)
	healerID := makeHealer(t, ctx, healerRepo, districtID)
	_, err := NewRemedy(queries).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)

	err = healerRepo.Delete(ctx, healerID)

	assert.True(t, errors.Is(err, healer.ErrReferenced))
}
```

Note: delete the unused `seedHealer` stub if your linter flags it; it is not needed — `makeHealer` is the helper. (Included only to show the intent; prefer `makeHealer`.)

- [ ] **Step 9: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run 'Remedy|Referenced' -v`
Expected: FAIL (compile error — `NewRemedy` undefined).

- [ ] **Step 10: Write the remedy repository**

Create `backend/internal/adapter/repository/remedy_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// Remedy stores and reads remedies in Postgres.
type Remedy struct {
	q *db.Queries
}

// NewRemedy builds the remedy repository.
func NewRemedy(q *db.Queries) *Remedy {
	return &Remedy{q: q}
}

func toRemedy(row db.Remedy) remedy.Remedy {
	return remedy.Remedy{
		ID:                row.ID,
		HealerID:          row.HealerID,
		Name:              row.Name,
		Symptoms:          row.Symptoms,
		Ingredients:       row.Ingredients,
		PreparationMethod: row.PreparationMethod,
		Usage:             row.Usage,
		Note:              row.Note,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

// Create inserts a remedy.
func (r *Remedy) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	row, err := r.q.CreateRemedy(ctx, db.CreateRemedyParams{
		HealerID:          p.HealerID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		Ingredients:       p.Ingredients,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// GetByID returns one remedy or remedy.ErrNotFound.
func (r *Remedy) GetByID(ctx context.Context, id int64) (remedy.Remedy, error) {
	row, err := r.q.GetRemedy(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// ListByHealer returns the remedies of one healer.
func (r *Remedy) ListByHealer(ctx context.Context, healerID int64) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRemedyByHealer(ctx, healerID)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, toRemedy(row))
	}
	return result, nil
}

// Update changes a remedy or returns remedy.ErrNotFound.
func (r *Remedy) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	row, err := r.q.UpdateRemedy(ctx, db.UpdateRemedyParams{
		ID:                p.ID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		Ingredients:       p.Ingredients,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// Delete removes a remedy, or returns remedy.ErrNotFound / remedy.ErrReferenced.
func (r *Remedy) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteRemedy(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return remedy.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return remedy.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -v`
Expected: PASS (remedy tests + the new healer-referenced test + existing tests). Also run `go build ./... && go vet ./... && gofmt -l . && go mod tidy`.

- [ ] **Step 12: Commit** (orchestrator commits.)

---

### Task 2: Remedy use case + HTTP + wiring

**Files:**
- Create: `backend/internal/usecase/remedy_service.go`
- Test: `backend/internal/usecase/remedy_service_test.go`
- Create: `backend/internal/adapter/http/remedy_handler.go`
- Test: `backend/internal/adapter/http/remedy_handler_test.go`
- Modify: `backend/cmd/api/main.go` (wire remedy; subscribe audit to remedy events)

**Interfaces:**
- Produces: `usecase.ErrInvalidRemedy`; `usecase.NewRemedyService(repo remedy.Repository, publisher Publisher) *usecase.RemedyService` with `Create`, `Get`, `ListByHealer`, `Update`, `Delete` (publishes remedy events after repo success).
- Produces: `httpapi.NewRemedyHandler(service *usecase.RemedyService) *httpapi.RemedyHandler` with `RegisterRoutes`.
- Consumes: `remedy.*`, `usecase.Publisher`.

- [ ] **Step 1: Write the failing remedy use case test**

Create `backend/internal/usecase/remedy_service_test.go`:

```go
package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

type fakeRemedyRepo struct {
	createErr error
	deleteErr error
}

func (f *fakeRemedyRepo) Create(_ context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	if f.createErr != nil {
		return remedy.Remedy{}, f.createErr
	}
	return remedy.Remedy{ID: 1, HealerID: p.HealerID, Name: p.Name}, nil
}
func (f *fakeRemedyRepo) GetByID(context.Context, int64) (remedy.Remedy, error) {
	return remedy.Remedy{ID: 1}, nil
}
func (f *fakeRemedyRepo) ListByHealer(context.Context, int64) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1}}, nil
}
func (f *fakeRemedyRepo) Update(_ context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	return remedy.Remedy{ID: p.ID, Name: p.Name}, nil
}
func (f *fakeRemedyRepo) Delete(context.Context, int64) error { return f.deleteErr }

type remedyRecorder struct{ events []event.Event }

func (r *remedyRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func TestCreateRemedyPublishesEvent(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{}, pub)

	got, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: "ยา"})

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "remedy.created", pub.events[0].EventName())
}

func TestCreateRemedyRejectsEmptyName(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{}, pub)

	_, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: " "})

	assert.ErrorIs(t, err, ErrInvalidRemedy)
	assert.Empty(t, pub.events)
}

func TestCreateRemedyRejectsBadHealer(t *testing.T) {
	_, err := NewRemedyService(&fakeRemedyRepo{}, &remedyRecorder{}).
		Create(context.Background(), remedy.CreateParams{HealerID: 0, Name: "ยา"})
	assert.ErrorIs(t, err, ErrInvalidRemedy)
}

func TestCreateRemedyNoEventOnRepoError(t *testing.T) {
	pub := &remedyRecorder{}
	service := NewRemedyService(&fakeRemedyRepo{createErr: errors.New("db")}, pub)

	_, err := service.Create(context.Background(), remedy.CreateParams{HealerID: 3, Name: "ยา"})

	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestDeleteRemedyPublishesEvent(t *testing.T) {
	pub := &remedyRecorder{}
	require.NoError(t, NewRemedyService(&fakeRemedyRepo{}, pub).Delete(context.Background(), 7))
	require.Len(t, pub.events, 1)
	assert.Equal(t, "remedy.deleted", pub.events[0].EventName())
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && go test ./internal/usecase/... -run Remedy -v`
Expected: FAIL (compile error — `NewRemedyService` undefined).

- [ ] **Step 3: Write the remedy service**

Create `backend/internal/usecase/remedy_service.go`:

```go
package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// ErrInvalidRemedy means the remedy input failed validation.
var ErrInvalidRemedy = errors.New("invalid remedy")

// RemedyService creates, reads, and changes remedies, publishing events on write.
type RemedyService struct {
	repo      remedy.Repository
	publisher Publisher
}

// NewRemedyService builds the remedy service.
func NewRemedyService(repo remedy.Repository, publisher Publisher) *RemedyService {
	return &RemedyService{repo: repo, publisher: publisher}
}

// Create validates and stores a remedy, then publishes CreatedEvent.
func (s *RemedyService) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	if strings.TrimSpace(p.Name) == "" || p.HealerID <= 0 {
		return remedy.Remedy{}, ErrInvalidRemedy
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return remedy.Remedy{}, err
	}
	s.publisher.Publish(ctx, remedy.CreatedEvent{RemedyID: created.ID})
	return created, nil
}

// Get returns one remedy.
func (s *RemedyService) Get(ctx context.Context, id int64) (remedy.Remedy, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByHealer returns the remedies of one healer.
func (s *RemedyService) ListByHealer(ctx context.Context, healerID int64) ([]remedy.Remedy, error) {
	return s.repo.ListByHealer(ctx, healerID)
}

// Update validates and changes a remedy, then publishes UpdatedEvent.
func (s *RemedyService) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	if strings.TrimSpace(p.Name) == "" {
		return remedy.Remedy{}, ErrInvalidRemedy
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return remedy.Remedy{}, err
	}
	s.publisher.Publish(ctx, remedy.UpdatedEvent{RemedyID: updated.ID})
	return updated, nil
}

// Delete removes a remedy, then publishes DeletedEvent.
func (s *RemedyService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, remedy.DeletedEvent{RemedyID: id})
	return nil
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && go test ./internal/usecase/... -v`
Expected: PASS.

- [ ] **Step 5: Write the failing remedy handler test**

Create `backend/internal/adapter/http/remedy_handler_test.go`:

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
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubRemedyRepo struct{ getErr error }

func (s *stubRemedyRepo) Create(_ context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	return remedy.Remedy{ID: 1, HealerID: p.HealerID, Name: p.Name}, nil
}
func (s *stubRemedyRepo) GetByID(_ context.Context, id int64) (remedy.Remedy, error) {
	if s.getErr != nil {
		return remedy.Remedy{}, s.getErr
	}
	return remedy.Remedy{ID: id, Name: "ยา"}, nil
}
func (s *stubRemedyRepo) ListByHealer(_ context.Context, healerID int64) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1, HealerID: healerID, Name: "ยา"}}, nil
}
func (s *stubRemedyRepo) Update(_ context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	return remedy.Remedy{ID: p.ID, Name: p.Name}, nil
}
func (s *stubRemedyRepo) Delete(context.Context, int64) error { return nil }

type noopPub struct{}

func (noopPub) Publish(context.Context, event.Event) {}

func newRemedyRouter(repo remedy.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewRemedyService(repo, noopPub{})
	return NewRouter(NewRemedyHandler(service))
}

func TestCreateRemedyEndpoint(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	body, _ := json.Marshal(map[string]any{"healerId": 3, "name": "ยาต้ม", "symptoms": "ไข้"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "ยาต้ม", got["name"])
	assert.Equal(t, float64(3), got["healerId"])
}

func TestCreateRemedyRejectsEmptyName(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	body, _ := json.Marshal(map[string]any{"healerId": 3, "name": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetRemedyNotFound(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{getErr: remedy.ErrNotFound})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/remedies/1", nil)
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListRemedyByHealerEndpoint(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/healers/3/remedies", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, float64(3), got[0]["healerId"])
}
```

Note: `noopPub` may collide with the healer test's `noopPublisher`; this uses a distinct name `noopPub` to avoid a duplicate declaration in package `httpapi`.

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -run Remedy -v`
Expected: FAIL (compile error — `NewRemedyHandler` undefined).

- [ ] **Step 7: Write the remedy handler**

Create `backend/internal/adapter/http/remedy_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// RemedyHandler serves the remedy read and write endpoints.
type RemedyHandler struct {
	service *usecase.RemedyService
}

// NewRemedyHandler builds the remedy handler.
func NewRemedyHandler(service *usecase.RemedyService) *RemedyHandler {
	return &RemedyHandler{service: service}
}

// RegisterRoutes mounts the remedy routes.
func (h *RemedyHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/healers/:healerId/remedies", h.ListByHealer)
	rg.GET("/remedies/:remedyId", h.Get)
	// withinlazy: unguarded until Plan 4 adds JWT middleware on the write routes.
	rg.POST("/remedies", h.Create)
	rg.PUT("/remedies/:remedyId", h.Update)
	rg.DELETE("/remedies/:remedyId", h.Delete)
}

type remedyDTO struct {
	ID                int64     `json:"id"`
	HealerID          int64     `json:"healerId"`
	Name              string    `json:"name"`
	Symptoms          string    `json:"symptoms"`
	Ingredients       string    `json:"ingredients"`
	PreparationMethod string    `json:"preparationMethod"`
	Usage             string    `json:"usage"`
	Note              string    `json:"note"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

func toRemedyDTO(r remedy.Remedy) remedyDTO {
	return remedyDTO{
		ID:                r.ID,
		HealerID:          r.HealerID,
		Name:              r.Name,
		Symptoms:          r.Symptoms,
		Ingredients:       r.Ingredients,
		PreparationMethod: r.PreparationMethod,
		Usage:             r.Usage,
		Note:              r.Note,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
	}
}

type remedyRequest struct {
	HealerID          int64  `json:"healerId"`
	Name              string `json:"name"`
	Symptoms          string `json:"symptoms"`
	Ingredients       string `json:"ingredients"`
	PreparationMethod string `json:"preparationMethod"`
	Usage             string `json:"usage"`
	Note              string `json:"note"`
}

// ListByHealer handles GET /api/v1/healers/:healerId/remedies.
func (h *RemedyHandler) ListByHealer(c *gin.Context) {
	healerID, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	list, err := h.service.ListByHealer(c.Request.Context(), healerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies"})
		return
	}
	out := make([]remedyDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toRemedyDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, remedy.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read remedy"})
		return
	}
	c.JSON(http.StatusOK, toRemedyDTO(found))
}

// Create handles POST /api/v1/remedies.
func (h *RemedyHandler) Create(c *gin.Context) {
	var req remedyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), remedy.CreateParams{
		HealerID:          req.HealerID,
		Name:              req.Name,
		Symptoms:          req.Symptoms,
		Ingredients:       req.Ingredients,
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidRemedy) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required and healer id must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create remedy"})
		return
	}
	c.JSON(http.StatusCreated, toRemedyDTO(created))
}

// Update handles PUT /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	var req remedyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), remedy.UpdateParams{
		ID:                id,
		Name:              req.Name,
		Symptoms:          req.Symptoms,
		Ingredients:       req.Ingredients,
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidRemedy):
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		case errors.Is(err, remedy.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update remedy"})
		}
		return
	}
	c.JSON(http.StatusOK, toRemedyDTO(updated))
}

// Delete handles DELETE /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, remedy.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
		case errors.Is(err, remedy.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "remedy has treatment cases; delete them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete remedy"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 8: Run the handler tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: PASS.

- [ ] **Step 9: Wire the remedy stack into main**

In `backend/cmd/api/main.go`: after the healer wiring, subscribe the audit handler to the remedy events and build the remedy handler; add it to `NewRouter`.

```go
	bus.Subscribe("remedy.created", auditHandler(logger))
	bus.Subscribe("remedy.updated", auditHandler(logger))
	bus.Subscribe("remedy.deleted", auditHandler(logger))
```

```go
	remedyHandler := httpapi.NewRemedyHandler(
		usecase.NewRemedyService(repository.NewRemedy(queries), bus),
	)
```

```go
	router := httpapi.NewRouter(locationHandler, healerHandler, remedyHandler)
```

- [ ] **Step 10: Run the full suite**

Run: `cd backend && go build ./... && go vet ./... && gofmt -l . && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: clean + every package PASS.

- [ ] **Step 11: Commit** (orchestrator commits.)

---

### Task 3: Treatment Case aggregate + remedy FK-delete mapping

**Files:**
- Create: `backend/internal/domain/treatmentcase/treatmentcase.go`
- Create: `backend/migrations/000005_create_treatment_case.up.sql`, `.down.sql`
- Create: `backend/internal/adapter/repository/query/treatment_case.sql`
- Regenerate: `db/*`
- Create: `backend/internal/adapter/repository/treatment_case_repository.go`
- Test: `backend/internal/adapter/repository/treatment_case_repository_test.go`

**Interfaces:**
- Produces: `treatmentcase.TreatmentCase{ ID, RemedyID, HealerID int64; PatientAge int; PatientSex, Symptoms, Result, Note string; TreatedOn, CreatedAt, UpdatedAt time.Time }`.
- Produces: `treatmentcase.CreateParams{ RemedyID, HealerID int64; PatientAge int; PatientSex, Symptoms, Result, Note string; TreatedOn time.Time }`; `treatmentcase.UpdateParams{ ID int64; PatientAge int; PatientSex, Symptoms, Result, Note string; TreatedOn time.Time }`.
- Produces: `treatmentcase.ErrNotFound`; `treatmentcase.Repository` (`Create`, `GetByID`, `ListByRemedy`, `Update`, `Delete`); events `CreatedEvent/UpdatedEvent/DeletedEvent` (names `treatmentcase.created/updated/deleted`).
- Produces: `repository.NewTreatmentCase(q *db.Queries) *repository.TreatmentCase`.
- Consumes: the shared `isForeignKeyViolation` helper (Task 1); `remedy.Repository`, `healer.Repository` (test seeding).

- [ ] **Step 1: Write the treatment-case domain**

Create `backend/internal/domain/treatmentcase/treatmentcase.go`:

```go
// Package treatmentcase holds the treatment-case entity, its events, and
// repository interface. It imports no framework code. A case stores only
// patient age and sex — no patient identity (spec privacy choice A).
package treatmentcase

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no treatment case has the given id.
var ErrNotFound = errors.New("treatment case not found")

// TreatmentCase records the use of a remedy on a patient.
type TreatmentCase struct {
	ID         int64
	RemedyID   int64
	HealerID   int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// CreateParams holds the fields to create a treatment case.
type CreateParams struct {
	RemedyID   int64
	HealerID   int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
}

// UpdateParams holds the fields to update a treatment case.
type UpdateParams struct {
	ID         int64
	PatientAge int
	PatientSex string
	Symptoms   string
	Result     string
	Note       string
	TreatedOn  time.Time
}

// Repository stores and reads treatment cases.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (TreatmentCase, error)
	GetByID(ctx context.Context, id int64) (TreatmentCase, error)
	ListByRemedy(ctx context.Context, remedyID int64) ([]TreatmentCase, error)
	Update(ctx context.Context, p UpdateParams) (TreatmentCase, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a case is created.
type CreatedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "treatmentcase.created" }

// UpdatedEvent is published after a case is updated.
type UpdatedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "treatmentcase.updated" }

// DeletedEvent is published after a case is deleted.
type DeletedEvent struct{ TreatmentCaseID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "treatmentcase.deleted" }
```

- [ ] **Step 2: Write the treatment-case migration**

Create `backend/migrations/000005_create_treatment_case.up.sql`:

```sql
CREATE TABLE treatment_case (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    remedy_id   BIGINT NOT NULL REFERENCES remedy (id),
    healer_id   BIGINT NOT NULL REFERENCES healer (id),
    patient_age INTEGER NOT NULL DEFAULT 0,
    patient_sex TEXT NOT NULL DEFAULT '',
    symptoms    TEXT NOT NULL DEFAULT '',
    result      TEXT NOT NULL DEFAULT '',
    note        TEXT NOT NULL DEFAULT '',
    treated_on  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX treatment_case_remedy_id_idx ON treatment_case (remedy_id);
CREATE INDEX treatment_case_healer_id_idx ON treatment_case (healer_id);
```

Create `backend/migrations/000005_create_treatment_case.down.sql`:

```sql
DROP TABLE IF EXISTS treatment_case;
```

- [ ] **Step 3: Write the treatment-case queries**

Create `backend/internal/adapter/repository/query/treatment_case.sql`:

```sql
-- name: CreateTreatmentCase :one
INSERT INTO treatment_case (remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: GetTreatmentCase :one
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE id = $1;

-- name: ListTreatmentCaseByRemedy :many
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE remedy_id = $1
ORDER BY treated_on DESC, id DESC;

-- name: UpdateTreatmentCase :one
UPDATE treatment_case
SET patient_age = $2, patient_sex = $3, symptoms = $4, result = $5, note = $6, treated_on = $7, updated_at = now()
WHERE id = $1
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: DeleteTreatmentCase :execrows
DELETE FROM treatment_case WHERE id = $1;
```

- [ ] **Step 4: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: `db` gains the five treatment-case methods, `db.TreatmentCase` (note: `PatientAge` is `int32`; `TreatedOn` is `pgtype.Date`; timestamps `pgtype.Timestamptz`), and the params structs.

- [ ] **Step 5: Write the failing repository test**

Create `backend/internal/adapter/repository/treatment_case_repository_test.go`:

```go
package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// makeRemedy creates a healer + remedy and returns their ids.
func makeRemedy(t *testing.T, ctx context.Context, queries *dbQueriesForTest) (healerID, remedyID int64) {
	t.Helper()
	districtID := firstDistrictID(t, ctx, NewLocation(queries.q))
	healerID = makeHealer(t, ctx, NewHealer(queries.q), districtID)
	r, err := NewRemedy(queries.q).Create(ctx, remedy.CreateParams{HealerID: healerID, Name: "ยา"})
	require.NoError(t, err)
	return healerID, r.ID
}

func TestTreatmentCaseCreateGetListUpdateDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	healerID, remedyID := makeRemedy(t, ctx, &dbQueriesForTest{q: queries})
	repo := NewTreatmentCase(queries)
	day := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	created, err := repo.Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, PatientAge: 45, PatientSex: "female",
		Symptoms: "ไข้", Result: "หาย", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Equal(t, 45, created.PatientAge)
	assert.Equal(t, day, created.TreatedOn)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "female", got.PatientSex)

	list, err := repo.ListByRemedy(ctx, remedyID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	updated, err := repo.Update(ctx, treatmentcase.UpdateParams{
		ID: created.ID, PatientAge: 46, PatientSex: "female", Result: "ดีขึ้น", TreatedOn: day,
	})
	require.NoError(t, err)
	assert.Equal(t, 46, updated.PatientAge)
	assert.Equal(t, "ดีขึ้น", updated.Result)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, treatmentcase.ErrNotFound))
}

func TestDeleteRemedyWithCaseReturnsReferenced(t *testing.T) {
	ctx, queries := newTestPool(t)
	healerID, remedyID := makeRemedy(t, ctx, &dbQueriesForTest{q: queries})
	_, err := NewTreatmentCase(queries).Create(ctx, treatmentcase.CreateParams{
		RemedyID: remedyID, HealerID: healerID, TreatedOn: time.Now().UTC(),
	})
	require.NoError(t, err)

	err = NewRemedy(queries).Delete(ctx, remedyID)

	assert.True(t, errors.Is(err, remedy.ErrReferenced))
}
```

Note: `dbQueriesForTest` is a tiny shim so `makeRemedy` can pass the `*db.Queries` around with a named type. Add it to this test file:

```go
type dbQueriesForTest struct{ q *db.Queries }
```

Add the import `"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"` to the test file. (If you prefer, drop the shim and pass `*db.Queries` directly — but keep the helper compiling.)

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run 'TreatmentCase|Referenced' -v`
Expected: FAIL (compile error — `NewTreatmentCase` undefined).

- [ ] **Step 7: Write the treatment-case repository**

Create `backend/internal/adapter/repository/treatment_case_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// TreatmentCase stores and reads treatment cases in Postgres.
type TreatmentCase struct {
	q *db.Queries
}

// NewTreatmentCase builds the treatment-case repository.
func NewTreatmentCase(q *db.Queries) *TreatmentCase {
	return &TreatmentCase{q: q}
}

func toTreatmentCase(row db.TreatmentCase) treatmentcase.TreatmentCase {
	return treatmentcase.TreatmentCase{
		ID:         row.ID,
		RemedyID:   row.RemedyID,
		HealerID:   row.HealerID,
		PatientAge: int(row.PatientAge),
		PatientSex: row.PatientSex,
		Symptoms:   row.Symptoms,
		Result:     row.Result,
		Note:       row.Note,
		TreatedOn:  row.TreatedOn.Time,
		CreatedAt:  row.CreatedAt.Time,
		UpdatedAt:  row.UpdatedAt.Time,
	}
}

func dateOf(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

// Create inserts a treatment case.
func (r *TreatmentCase) Create(ctx context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.CreateTreatmentCase(ctx, db.CreateTreatmentCaseParams{
		RemedyID:   p.RemedyID,
		HealerID:   p.HealerID,
		PatientAge: int32(p.PatientAge),
		PatientSex: p.PatientSex,
		Symptoms:   p.Symptoms,
		Result:     p.Result,
		Note:       p.Note,
		TreatedOn:  dateOf(p.TreatedOn),
	})
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// GetByID returns one case or treatmentcase.ErrNotFound.
func (r *TreatmentCase) GetByID(ctx context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.GetTreatmentCase(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return treatmentcase.TreatmentCase{}, treatmentcase.ErrNotFound
		}
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// ListByRemedy returns the cases for one remedy.
func (r *TreatmentCase) ListByRemedy(ctx context.Context, remedyID int64) ([]treatmentcase.TreatmentCase, error) {
	rows, err := r.q.ListTreatmentCaseByRemedy(ctx, remedyID)
	if err != nil {
		return nil, err
	}
	result := make([]treatmentcase.TreatmentCase, 0, len(rows))
	for _, row := range rows {
		result = append(result, toTreatmentCase(row))
	}
	return result, nil
}

// Update changes a case or returns treatmentcase.ErrNotFound.
func (r *TreatmentCase) Update(ctx context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.UpdateTreatmentCase(ctx, db.UpdateTreatmentCaseParams{
		ID:         p.ID,
		PatientAge: int32(p.PatientAge),
		PatientSex: p.PatientSex,
		Symptoms:   p.Symptoms,
		Result:     p.Result,
		Note:       p.Note,
		TreatedOn:  dateOf(p.TreatedOn),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return treatmentcase.TreatmentCase{}, treatmentcase.ErrNotFound
		}
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// Delete removes a case or returns treatmentcase.ErrNotFound.
func (r *TreatmentCase) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteTreatmentCase(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return treatmentcase.ErrNotFound
	}
	return nil
}
```

Note: add `"time"` to the imports (used by `dateOf`). Verify the sqlc field name for the date column is `TreatedOn` and its type is `pgtype.Date`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -v`
Expected: PASS (treatment-case tests + remedy-referenced test + all earlier). Then `go build ./... && go vet ./... && gofmt -l . && go mod tidy`.

- [ ] **Step 9: Commit** (orchestrator commits.)

---

### Task 4: Treatment Case use case + HTTP + wiring

**Files:**
- Create: `backend/internal/usecase/treatment_case_service.go`
- Test: `backend/internal/usecase/treatment_case_service_test.go`
- Create: `backend/internal/adapter/http/treatment_case_handler.go`
- Test: `backend/internal/adapter/http/treatment_case_handler_test.go`
- Modify: `backend/cmd/api/main.go` (wire treatment case; subscribe audit to its events)

**Interfaces:**
- Produces: `usecase.ErrInvalidTreatmentCase`; `usecase.NewTreatmentCaseService(repo treatmentcase.Repository, publisher Publisher) *usecase.TreatmentCaseService` with `Create`, `Get`, `ListByRemedy`, `Update`, `Delete` (publishes case events after repo success).
- Produces: `httpapi.NewTreatmentCaseHandler(service *usecase.TreatmentCaseService) *httpapi.TreatmentCaseHandler` with `RegisterRoutes`. The date field `treatedOn` is accepted/returned as an ISO date string `"2006-01-02"`.
- Consumes: `treatmentcase.*`, `usecase.Publisher`.

- [ ] **Step 1: Write the failing use case test**

Create `backend/internal/usecase/treatment_case_service_test.go`:

```go
package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

type fakeCaseRepo struct{ createErr error }

func (f *fakeCaseRepo) Create(_ context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	if f.createErr != nil {
		return treatmentcase.TreatmentCase{}, f.createErr
	}
	return treatmentcase.TreatmentCase{ID: 1, RemedyID: p.RemedyID, HealerID: p.HealerID}, nil
}
func (f *fakeCaseRepo) GetByID(context.Context, int64) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: 1}, nil
}
func (f *fakeCaseRepo) ListByRemedy(context.Context, int64) ([]treatmentcase.TreatmentCase, error) {
	return []treatmentcase.TreatmentCase{{ID: 1}}, nil
}
func (f *fakeCaseRepo) Update(_ context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: p.ID}, nil
}
func (f *fakeCaseRepo) Delete(context.Context, int64) error { return nil }

type caseRecorder struct{ events []event.Event }

func (r *caseRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func validCreate() treatmentcase.CreateParams {
	return treatmentcase.CreateParams{RemedyID: 2, HealerID: 3, PatientAge: 40, PatientSex: "male", TreatedOn: time.Now().UTC()}
}

func TestCreateCasePublishesEvent(t *testing.T) {
	pub := &caseRecorder{}
	got, err := NewTreatmentCaseService(&fakeCaseRepo{}, pub).Create(context.Background(), validCreate())
	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "treatmentcase.created", pub.events[0].EventName())
}

func TestCreateCaseRejectsBadRemedy(t *testing.T) {
	p := validCreate()
	p.RemedyID = 0
	pub := &caseRecorder{}
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, pub).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
	assert.Empty(t, pub.events)
}

func TestCreateCaseRejectsEmptySex(t *testing.T) {
	p := validCreate()
	p.PatientSex = ""
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, &caseRecorder{}).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
}

func TestCreateCaseRejectsNegativeAge(t *testing.T) {
	p := validCreate()
	p.PatientAge = -1
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, &caseRecorder{}).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
}

func TestCreateCaseNoEventOnRepoError(t *testing.T) {
	pub := &caseRecorder{}
	_, err := NewTreatmentCaseService(&fakeCaseRepo{createErr: errors.New("db")}, pub).Create(context.Background(), validCreate())
	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestDeleteCasePublishesEvent(t *testing.T) {
	pub := &caseRecorder{}
	require.NoError(t, NewTreatmentCaseService(&fakeCaseRepo{}, pub).Delete(context.Background(), 9))
	require.Len(t, pub.events, 1)
	assert.Equal(t, "treatmentcase.deleted", pub.events[0].EventName())
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && go test ./internal/usecase/... -run Case -v`
Expected: FAIL (compile error — `NewTreatmentCaseService` undefined).

- [ ] **Step 3: Write the treatment-case service**

Create `backend/internal/usecase/treatment_case_service.go`:

```go
package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// ErrInvalidTreatmentCase means the case input failed validation.
var ErrInvalidTreatmentCase = errors.New("invalid treatment case")

// TreatmentCaseService creates, reads, and changes cases, publishing events on write.
type TreatmentCaseService struct {
	repo      treatmentcase.Repository
	publisher Publisher
}

// NewTreatmentCaseService builds the treatment-case service.
func NewTreatmentCaseService(repo treatmentcase.Repository, publisher Publisher) *TreatmentCaseService {
	return &TreatmentCaseService{repo: repo, publisher: publisher}
}

// Create validates and stores a case, then publishes CreatedEvent.
func (s *TreatmentCaseService) Create(ctx context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	if p.RemedyID <= 0 || p.HealerID <= 0 || p.PatientAge < 0 || strings.TrimSpace(p.PatientSex) == "" {
		return treatmentcase.TreatmentCase{}, ErrInvalidTreatmentCase
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	s.publisher.Publish(ctx, treatmentcase.CreatedEvent{TreatmentCaseID: created.ID})
	return created, nil
}

// Get returns one case.
func (s *TreatmentCaseService) Get(ctx context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	return s.repo.GetByID(ctx, id)
}

// ListByRemedy returns the cases for one remedy.
func (s *TreatmentCaseService) ListByRemedy(ctx context.Context, remedyID int64) ([]treatmentcase.TreatmentCase, error) {
	return s.repo.ListByRemedy(ctx, remedyID)
}

// Update validates and changes a case, then publishes UpdatedEvent.
func (s *TreatmentCaseService) Update(ctx context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	if p.PatientAge < 0 || strings.TrimSpace(p.PatientSex) == "" {
		return treatmentcase.TreatmentCase{}, ErrInvalidTreatmentCase
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	s.publisher.Publish(ctx, treatmentcase.UpdatedEvent{TreatmentCaseID: updated.ID})
	return updated, nil
}

// Delete removes a case, then publishes DeletedEvent.
func (s *TreatmentCaseService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, treatmentcase.DeletedEvent{TreatmentCaseID: id})
	return nil
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && go test ./internal/usecase/... -v`
Expected: PASS.

- [ ] **Step 5: Write the failing handler test**

Create `backend/internal/adapter/http/treatment_case_handler_test.go`:

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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubCaseRepo struct{ getErr error }

func (s *stubCaseRepo) Create(_ context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: 1, RemedyID: p.RemedyID, HealerID: p.HealerID, PatientAge: p.PatientAge, TreatedOn: p.TreatedOn}, nil
}
func (s *stubCaseRepo) GetByID(_ context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	if s.getErr != nil {
		return treatmentcase.TreatmentCase{}, s.getErr
	}
	return treatmentcase.TreatmentCase{ID: id}, nil
}
func (s *stubCaseRepo) ListByRemedy(_ context.Context, remedyID int64) ([]treatmentcase.TreatmentCase, error) {
	return []treatmentcase.TreatmentCase{{ID: 1, RemedyID: remedyID}}, nil
}
func (s *stubCaseRepo) Update(_ context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: p.ID}, nil
}
func (s *stubCaseRepo) Delete(context.Context, int64) error { return nil }

func newCaseRouter(repo treatmentcase.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewTreatmentCaseService(repo, noopPub{})
	return NewRouter(NewTreatmentCaseHandler(service))
}

func TestCreateCaseEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	body, _ := json.Marshal(map[string]any{
		"remedyId": 2, "healerId": 3, "patientAge": 40, "patientSex": "male", "treatedOn": "2026-03-01",
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/treatment-cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, float64(40), got["patientAge"])
	assert.Equal(t, "2026-03-01", got["treatedOn"])
}

func TestCreateCaseRejectsBadDate(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	body, _ := json.Marshal(map[string]any{
		"remedyId": 2, "healerId": 3, "patientAge": 40, "patientSex": "male", "treatedOn": "01-03-2026",
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/treatment-cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetCaseNotFound(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{getErr: treatmentcase.ErrNotFound})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/treatment-cases/1", nil)
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListCaseByRemedyEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/remedies/2/treatment-cases", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, float64(2), got[0]["remedyId"])
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -run Case -v`
Expected: FAIL (compile error — `NewTreatmentCaseHandler` undefined).

- [ ] **Step 7: Write the treatment-case handler**

Create `backend/internal/adapter/http/treatment_case_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

const dateLayout = "2006-01-02"

// TreatmentCaseHandler serves the treatment-case read and write endpoints.
type TreatmentCaseHandler struct {
	service *usecase.TreatmentCaseService
}

// NewTreatmentCaseHandler builds the treatment-case handler.
func NewTreatmentCaseHandler(service *usecase.TreatmentCaseService) *TreatmentCaseHandler {
	return &TreatmentCaseHandler{service: service}
}

// RegisterRoutes mounts the treatment-case routes.
func (h *TreatmentCaseHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/remedies/:remedyId/treatment-cases", h.ListByRemedy)
	rg.GET("/treatment-cases/:treatmentCaseId", h.Get)
	// withinlazy: unguarded until Plan 4 adds JWT middleware on the write routes.
	rg.POST("/treatment-cases", h.Create)
	rg.PUT("/treatment-cases/:treatmentCaseId", h.Update)
	rg.DELETE("/treatment-cases/:treatmentCaseId", h.Delete)
}

type treatmentCaseDTO struct {
	ID         int64  `json:"id"`
	RemedyID   int64  `json:"remedyId"`
	HealerID   int64  `json:"healerId"`
	PatientAge int    `json:"patientAge"`
	PatientSex string `json:"patientSex"`
	Symptoms   string `json:"symptoms"`
	Result     string `json:"result"`
	Note       string `json:"note"`
	TreatedOn  string `json:"treatedOn"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func toTreatmentCaseDTO(c treatmentcase.TreatmentCase) treatmentCaseDTO {
	return treatmentCaseDTO{
		ID:         c.ID,
		RemedyID:   c.RemedyID,
		HealerID:   c.HealerID,
		PatientAge: c.PatientAge,
		PatientSex: c.PatientSex,
		Symptoms:   c.Symptoms,
		Result:     c.Result,
		Note:       c.Note,
		TreatedOn:  c.TreatedOn.Format(dateLayout),
		CreatedAt:  c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  c.UpdatedAt.Format(time.RFC3339),
	}
}

type treatmentCaseRequest struct {
	RemedyID   int64  `json:"remedyId"`
	HealerID   int64  `json:"healerId"`
	PatientAge int    `json:"patientAge"`
	PatientSex string `json:"patientSex"`
	Symptoms   string `json:"symptoms"`
	Result     string `json:"result"`
	Note       string `json:"note"`
	TreatedOn  string `json:"treatedOn"`
}

// ListByRemedy handles GET /api/v1/remedies/:remedyId/treatment-cases.
func (h *TreatmentCaseHandler) ListByRemedy(c *gin.Context) {
	remedyID, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	list, err := h.service.ListByRemedy(c.Request.Context(), remedyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list treatment cases"})
		return
	}
	out := make([]treatmentCaseDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toTreatmentCaseDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, treatmentcase.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read treatment case"})
		return
	}
	c.JSON(http.StatusOK, toTreatmentCaseDTO(found))
}

// Create handles POST /api/v1/treatment-cases.
func (h *TreatmentCaseHandler) Create(c *gin.Context) {
	var req treatmentCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	treatedOn, err := time.Parse(dateLayout, req.TreatedOn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatedOn must be a date like 2006-01-02"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), treatmentcase.CreateParams{
		RemedyID:   req.RemedyID,
		HealerID:   req.HealerID,
		PatientAge: req.PatientAge,
		PatientSex: req.PatientSex,
		Symptoms:   req.Symptoms,
		Result:     req.Result,
		Note:       req.Note,
		TreatedOn:  treatedOn,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidTreatmentCase) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "remedyId, healerId, patientSex are required and patientAge must be >= 0"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create treatment case"})
		return
	}
	c.JSON(http.StatusCreated, toTreatmentCaseDTO(created))
}

// Update handles PUT /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	var req treatmentCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	treatedOn, err := time.Parse(dateLayout, req.TreatedOn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatedOn must be a date like 2006-01-02"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), treatmentcase.UpdateParams{
		ID:         id,
		PatientAge: req.PatientAge,
		PatientSex: req.PatientSex,
		Symptoms:   req.Symptoms,
		Result:     req.Result,
		Note:       req.Note,
		TreatedOn:  treatedOn,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidTreatmentCase):
			c.JSON(http.StatusBadRequest, gin.H{"error": "patientSex is required and patientAge must be >= 0"})
		case errors.Is(err, treatmentcase.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update treatment case"})
		}
		return
	}
	c.JSON(http.StatusOK, toTreatmentCaseDTO(updated))
}

// Delete handles DELETE /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, treatmentcase.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete treatment case"})
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 8: Run the handler tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: PASS.

- [ ] **Step 9: Wire the treatment-case stack into main**

In `backend/cmd/api/main.go`: subscribe the audit handler to the three case events, build the handler, add it to `NewRouter`.

```go
	bus.Subscribe("treatmentcase.created", auditHandler(logger))
	bus.Subscribe("treatmentcase.updated", auditHandler(logger))
	bus.Subscribe("treatmentcase.deleted", auditHandler(logger))
```

```go
	treatmentCaseHandler := httpapi.NewTreatmentCaseHandler(
		usecase.NewTreatmentCaseService(repository.NewTreatmentCase(queries), bus),
	)
```

```go
	router := httpapi.NewRouter(locationHandler, healerHandler, remedyHandler, treatmentCaseHandler)
```

- [ ] **Step 10: Run the full suite**

Run: `cd backend && go build ./... && go vet ./... && gofmt -l . && go mod tidy && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: clean + every package PASS.

- [ ] **Step 11: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage:**
- Remedy entity + fields (spec §6.1) — Task 1. ✓
- Treatment Case entity, patient age/sex only (spec §6.1, privacy choice A) — Task 3. ✓
- Remedy routes (spec §7.1/§7.2) — Task 2; Case routes incl. `treatment-cases` — Task 4. ✓
- Events remedy.* and treatmentcase.* + audit subscription (spec §8) — Tasks 2, 4. ✓
- FK-violation → 409 (Plan 2 carry-forward) — healer in Task 1, remedy in Tasks 1/3. ✓
- Clean Architecture, unguarded writes with `withinlazy` (auth = Plan 4). ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Concrete error mapping (404/400/409/201/204). Date handled as ISO string at the boundary.

**Type consistency:** `remedy.*` and `treatmentcase.*` names/types are used identically across domain, repository, use case, and handler. `isForeignKeyViolation` (Task 1) is reused by remedy Delete (Task 1) and is available for case (Task 3). `PatientAge` is `int` in the domain, mapped to/from sqlc `int32` in the repository. `TreatedOn` is `time.Time` in the domain and `pgtype.Date` in sqlc; the handler converts to/from the `"2006-01-02"` string. `NewRouter` is already variadic (Plan 2), so adding remedy + case handlers needs no signature change. Publisher/event names match the audit subscriptions in main.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-remedy-and-treatment-case.md`.

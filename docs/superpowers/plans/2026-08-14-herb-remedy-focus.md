# Herb + Remedy Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app remedy/herb-focused: add a first-class Herb entity, link remedies to herbs (structured, dropping free-text `ingredients`), and rework the public site to lead with search + Herbs + Remedies + Cases.

**Architecture:** Follow the existing Clean-Architecture aggregate pattern (`domain ← usecase ← adapter/platform`), 15-Factor, event-driven. Herb copies the healer aggregate shape end to end. The remedy aggregate gains a many-to-many link table (`remedy_herb`) that the remedy repository writes transactionally (the remedy aggregate owns its links). The Next.js public site is reworked; staff get Herb CRUD + a herb picker.

**Tech Stack:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, testify, testcontainers-go; Next.js App Router + TypeScript, Tailwind, TanStack Query, react-hook-form + zod, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-14-herb-remedy-focus-design.md`

## Global Constraints

- TDD mandatory: write failing test → confirm fail → minimal code → confirm pass → refactor.
- Clean Architecture: `domain` imports only stdlib; `usecase` imports domain (+ stdlib); Gin/pgx/sqlc stay in `adapter`/`platform`.
- Event-driven: every write publishes a domain event through the in-process bus; the audit handler subscribes in `cmd/api/main.go`.
- Full English names for API routes, all under `/api/v1`. No abbreviations.
- Style: uber-go for Go, Google for TS/HTML/CSS. American English names. Organized (path-sorted) imports.
- After sqlc query changes run `cd backend && sqlc generate` (sqlc v1.31.1) before building.
- Backend module path: `github.com/willywotz/thai-folk-medicine/backend`.
- Integration tests need Docker; on this host prefix with `TESTCONTAINERS_RYUK_DISABLED=true`.
- Frontend API base: server code uses `INTERNAL_API_URL`; client/staff code uses the same-origin `/api/v1` proxy for reads and `/bff/*` for writes.
- Work on branch `feat/herb-catalog` (already created). Commit after every green step.
- The final task updates `CONTEXT.md` and reseeds; do not update `CONTEXT.md` mid-plan.

---

## File Structure

**Backend — create:**
- `backend/migrations/000009_create_herb.up.sql` / `.down.sql`
- `backend/migrations/000010_create_remedy_herb.up.sql` / `.down.sql`
- `backend/internal/domain/herb/herb.go`
- `backend/internal/usecase/herb_service.go` (+ `_test.go`)
- `backend/internal/adapter/repository/herb_repository.go` (+ `_test.go`)
- `backend/internal/adapter/repository/query/herb.sql`
- `backend/internal/adapter/repository/query/remedy_herb.sql`
- `backend/internal/adapter/http/herb_handler.go` (+ `_test.go`)

**Backend — modify:**
- `backend/internal/domain/photo/photo.go` (add `OwnerHerb`)
- `backend/internal/domain/remedy/remedy.go` (drop `Ingredients`, add herb links)
- `backend/internal/adapter/repository/remedy_repository.go` (tx + herb links)
- `backend/internal/adapter/repository/query/remedy.sql` (drop ingredients, search rework)
- `backend/internal/adapter/http/remedy_handler.go` (herbs in/out DTO)
- `backend/internal/adapter/http/search_handler.go` (herb group)
- `backend/internal/usecase/remedy_service.go` (pass herbs through)
- `backend/internal/usecase/treatment_case_service.go` (recent list)
- `backend/internal/usecase/search/service.go` (HerbReader)
- `backend/internal/adapter/repository/treatment_case_repository.go` (recent list)
- `backend/internal/adapter/http/treatment_case_handler.go` (recent route)
- `backend/cmd/api/main.go` (wire herb, herb events, remedy repo pool arg, recent routes, herb reader)
- `backend/cmd/seed/generate.go` + `main.go` (herbs + links)
- Regenerated: `backend/internal/adapter/repository/db/*` (via sqlc)

**Frontend — create:**
- `src/lib/herb-schema.ts`
- `src/components/HerbForm.tsx` (+ `.test.tsx`)
- `src/components/HerbAdminList.tsx`
- `src/components/HerbPicker.tsx` (+ `.test.tsx`)
- `src/app/herbs/page.tsx`, `src/app/herbs/[herbId]/page.tsx`
- `src/app/remedies/page.tsx`, `src/app/treatment-cases/page.tsx`
- `src/app/staff/herbs/page.tsx`, `src/app/staff/herbs/new/page.tsx`, `src/app/staff/herbs/[herbId]/edit/page.tsx`
- `src/app/bff/herbs/route.ts`, `src/app/bff/herbs/[herbId]/route.ts`

**Frontend — modify:**
- `src/lib/api-types.ts`, `src/lib/api.ts`, `src/lib/staff-queries.ts`, `src/lib/remedy-schema.ts`
- `src/app/page.tsx` (home rework)
- `src/app/remedies/[remedyId]/page.tsx` (herb list, healer/district context)
- `src/app/search/page.tsx` (herb group)
- `src/components/RemedyForm.tsx` (herb picker)
- `src/app/staff/layout.tsx` or dashboard (link to `/staff/herbs`)

---

## Task 1: Herb table, domain, sqlc, repository

**Files:**
- Create: `backend/migrations/000009_create_herb.up.sql`, `.down.sql`
- Create: `backend/internal/domain/herb/herb.go`
- Create: `backend/internal/adapter/repository/query/herb.sql`
- Create: `backend/internal/adapter/repository/herb_repository.go`
- Modify: `backend/internal/domain/photo/photo.go`
- Test: `backend/internal/adapter/repository/herb_repository_test.go`

**Interfaces:**
- Produces domain `herb` package:
  - `herb.Herb{ ID int64; NameThai, NameEnglish, ScientificName, Properties, Description string; CreatedAt, UpdatedAt time.Time }`
  - `herb.CreateParams{ NameThai, NameEnglish, ScientificName, Properties, Description string }`
  - `herb.UpdateParams{ ID int64; NameThai, NameEnglish, ScientificName, Properties, Description string }`
  - `herb.Repository{ Create; GetByID; List; Update; Delete; Search }`
  - events `herb.CreatedEvent{HerbID}` / `UpdatedEvent` / `DeletedEvent` with `EventName()` = `"herb.created"|"herb.updated"|"herb.deleted"`
  - `herb.ErrNotFound`, `herb.ErrReferenced`
- Produces repository `*repository.Herb` via `repository.NewHerb(q *db.Queries) *repository.Herb` with methods matching `herb.Repository` plus `Search(ctx, term) ([]herb.Herb, error)`.
- Consumes: `db.Queries` (sqlc), `isForeignKeyViolation` (existing in `repository/errors.go`).

- [ ] **Step 1: Write the migration files**

Create `backend/migrations/000009_create_herb.up.sql`:

```sql
CREATE TABLE herb (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_thai       TEXT NOT NULL,
    name_english    TEXT NOT NULL DEFAULT '',
    scientific_name TEXT NOT NULL DEFAULT '',
    properties      TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX herb_name_thai_trgm ON herb USING gin (name_thai gin_trgm_ops);
CREATE INDEX herb_name_english_trgm ON herb USING gin (name_english gin_trgm_ops);

-- Let a photo belong to a herb too.
ALTER TABLE photo DROP CONSTRAINT photo_owner_type_check;
ALTER TABLE photo ADD CONSTRAINT photo_owner_type_check
    CHECK (owner_type IN ('healer', 'remedy', 'case', 'herb'));
```

Create `backend/migrations/000009_create_herb.down.sql`:

```sql
ALTER TABLE photo DROP CONSTRAINT photo_owner_type_check;
ALTER TABLE photo ADD CONSTRAINT photo_owner_type_check
    CHECK (owner_type IN ('healer', 'remedy', 'case'));
DROP TABLE IF EXISTS herb;
```

- [ ] **Step 2: Write the domain package**

Create `backend/internal/domain/herb/herb.go`:

```go
// Package herb holds the herb (สมุนไพร) entity and its ports.
package herb

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no herb has the given id.
var ErrNotFound = errors.New("herb not found")

// ErrReferenced means the herb is still used by a remedy and cannot be deleted.
var ErrReferenced = errors.New("herb is referenced by other records")

// Herb is one medicinal herb (สมุนไพร).
type Herb struct {
	ID             int64
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// CreateParams holds the fields to create a herb.
type CreateParams struct {
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
}

// UpdateParams holds the fields to update a herb.
type UpdateParams struct {
	ID             int64
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
	Description    string
}

// Repository stores and reads herbs.
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Herb, error)
	GetByID(ctx context.Context, id int64) (Herb, error)
	List(ctx context.Context) ([]Herb, error)
	Update(ctx context.Context, p UpdateParams) (Herb, error)
	Delete(ctx context.Context, id int64) error
}

// CreatedEvent is published after a herb is created.
type CreatedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "herb.created" }

// UpdatedEvent is published after a herb is updated.
type UpdatedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (UpdatedEvent) EventName() string { return "herb.updated" }

// DeletedEvent is published after a herb is deleted.
type DeletedEvent struct{ HerbID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "herb.deleted" }
```

- [ ] **Step 3: Add the herb photo owner type**

In `backend/internal/domain/photo/photo.go`, add the constant and extend `ValidOwnerType`:

```go
const (
	OwnerHealer = "healer"
	OwnerRemedy = "remedy"
	OwnerCase   = "case"
	OwnerHerb   = "herb"
)

// ValidOwnerType reports whether t is a known owner type.
func ValidOwnerType(t string) bool {
	return t == OwnerHealer || t == OwnerRemedy || t == OwnerCase || t == OwnerHerb
}
```

- [ ] **Step 4: Write the sqlc queries**

Create `backend/internal/adapter/repository/query/herb.sql`:

```sql
-- name: CreateHerb :one
INSERT INTO herb (name_thai, name_english, scientific_name, properties, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at;

-- name: GetHerb :one
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE id = $1;

-- name: ListHerb :many
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
ORDER BY name_thai;

-- name: UpdateHerb :one
UPDATE herb
SET name_thai = $2, name_english = $3, scientific_name = $4, properties = $5, description = $6, updated_at = now()
WHERE id = $1
RETURNING id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at;

-- name: DeleteHerb :execrows
DELETE FROM herb WHERE id = $1;

-- name: SearchHerb :many
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE name_thai ILIKE '%' || @search_term::text || '%'
   OR name_english ILIKE '%' || @search_term::text || '%'
   OR scientific_name ILIKE '%' || @search_term::text || '%'
   OR properties ILIKE '%' || @search_term::text || '%'
ORDER BY GREATEST(
    similarity(name_thai, @search_term::text),
    similarity(name_english, @search_term::text)
) DESC, name_thai;
```

- [ ] **Step 5: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: creates `internal/adapter/repository/db/herb.sql.go` and a `Herb` model in `db/models.go`. No errors.

- [ ] **Step 6: Write the failing repository test**

Create `backend/internal/adapter/repository/herb_repository_test.go`. Mirror the setup helper used by `healer_repository_test.go` (same package, same testcontainers `newTestPool`/`newTestQueries` helper — reuse whatever that file already defines; do NOT redefine it):

```go
package repository_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
)

func TestHerbRepository_CRUD(t *testing.T) {
	queries := newTestQueries(t) // existing helper from healer_repository_test.go
	repo := repository.NewHerb(queries)
	ctx := context.Background()

	created, err := repo.Create(ctx, herb.CreateParams{
		NameThai:       "ฟ้าทะลายโจร",
		NameEnglish:    "Andrographis",
		ScientificName: "Andrographis paniculata",
		Properties:     "แก้ไข้ แก้เจ็บคอ",
		Description:    "ไม้ล้มลุก",
	})
	require.NoError(t, err)
	require.NotZero(t, created.ID)
	require.Equal(t, "ฟ้าทะลายโจร", created.NameThai)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, created.ID, got.ID)

	list, err := repo.List(ctx)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(list), 1)

	_, err = repo.Update(ctx, herb.UpdateParams{ID: created.ID, NameThai: "ฟ้าทะลายโจร*", NameEnglish: "A"})
	require.NoError(t, err)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	require.ErrorIs(t, err, herb.ErrNotFound)
}
```

> If `healer_repository_test.go` uses a different helper name, match it exactly. Read that file first to confirm the helper signature.

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestHerbRepository_CRUD -v`
Expected: FAIL — `repository.NewHerb` undefined.

- [ ] **Step 8: Write the repository**

Create `backend/internal/adapter/repository/herb_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
)

// Herb stores and reads herbs in Postgres.
type Herb struct {
	q *db.Queries
}

// NewHerb builds the herb repository.
func NewHerb(q *db.Queries) *Herb {
	return &Herb{q: q}
}

func toHerb(row db.Herb) herb.Herb {
	return herb.Herb{
		ID:             row.ID,
		NameThai:       row.NameThai,
		NameEnglish:    row.NameEnglish,
		ScientificName: row.ScientificName,
		Properties:     row.Properties,
		Description:    row.Description,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

// Create inserts a herb.
func (r *Herb) Create(ctx context.Context, p herb.CreateParams) (herb.Herb, error) {
	row, err := r.q.CreateHerb(ctx, db.CreateHerbParams{
		NameThai:       p.NameThai,
		NameEnglish:    p.NameEnglish,
		ScientificName: p.ScientificName,
		Properties:     p.Properties,
		Description:    p.Description,
	})
	if err != nil {
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// GetByID returns one herb or herb.ErrNotFound.
func (r *Herb) GetByID(ctx context.Context, id int64) (herb.Herb, error) {
	row, err := r.q.GetHerb(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return herb.Herb{}, herb.ErrNotFound
		}
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// List returns every herb ordered by Thai name.
func (r *Herb) List(ctx context.Context) ([]herb.Herb, error) {
	rows, err := r.q.ListHerb(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]herb.Herb, 0, len(rows))
	for _, row := range rows {
		result = append(result, toHerb(row))
	}
	return result, nil
}

// Update changes a herb or returns herb.ErrNotFound.
func (r *Herb) Update(ctx context.Context, p herb.UpdateParams) (herb.Herb, error) {
	row, err := r.q.UpdateHerb(ctx, db.UpdateHerbParams{
		ID:             p.ID,
		NameThai:       p.NameThai,
		NameEnglish:    p.NameEnglish,
		ScientificName: p.ScientificName,
		Properties:     p.Properties,
		Description:    p.Description,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return herb.Herb{}, herb.ErrNotFound
		}
		return herb.Herb{}, err
	}
	return toHerb(row), nil
}

// Delete removes a herb, or returns herb.ErrNotFound / herb.ErrReferenced.
func (r *Herb) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteHerb(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return herb.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return herb.ErrNotFound
	}
	return nil
}

// Search returns herbs whose names or properties match the term.
func (r *Herb) Search(ctx context.Context, term string) ([]herb.Herb, error) {
	rows, err := r.q.SearchHerb(ctx, term)
	if err != nil {
		return nil, err
	}
	result := make([]herb.Herb, 0, len(rows))
	for _, row := range rows {
		result = append(result, toHerb(row))
	}
	return result, nil
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestHerbRepository_CRUD -v`
Expected: PASS.

- [ ] **Step 10: Build and commit**

```bash
cd backend && go build ./... && gofmt -l internal cmd
git add backend/migrations/000009_create_herb.*.sql backend/internal/domain/herb backend/internal/domain/photo backend/internal/adapter/repository/query/herb.sql backend/internal/adapter/repository/herb_repository.go backend/internal/adapter/repository/herb_repository_test.go backend/internal/adapter/repository/db
git commit -m "feat(herb): add herb table, domain, and repository"
```

---

## Task 2: Herb use case + events

**Files:**
- Create: `backend/internal/usecase/herb_service.go`
- Test: `backend/internal/usecase/herb_service_test.go`

**Interfaces:**
- Consumes: `herb.Repository`, `usecase.Publisher` (existing: `Publish(ctx, event.Event)`).
- Produces: `usecase.HerbService` via `usecase.NewHerbService(repo herb.Repository, publisher Publisher) *HerbService` with methods `Create(ctx, herb.CreateParams) (herb.Herb, error)`, `Get(ctx, int64) (herb.Herb, error)`, `List(ctx) ([]herb.Herb, error)`, `Update(ctx, herb.UpdateParams) (herb.Herb, error)`, `Delete(ctx, int64) error`, and `usecase.ErrInvalidHerb`.

- [ ] **Step 1: Write the failing test**

Create `backend/internal/usecase/herb_service_test.go`. Reuse the fake publisher used by `healer_service_test.go` if one exists in the package; otherwise define a minimal fake here:

```go
package usecase_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type herbRepoStub struct {
	created herb.Herb
	createErr error
}

func (s *herbRepoStub) Create(_ context.Context, p herb.CreateParams) (herb.Herb, error) {
	return herb.Herb{ID: 1, NameThai: p.NameThai}, s.createErr
}
func (s *herbRepoStub) GetByID(context.Context, int64) (herb.Herb, error) { return herb.Herb{ID: 1}, nil }
func (s *herbRepoStub) List(context.Context) ([]herb.Herb, error)         { return nil, nil }
func (s *herbRepoStub) Update(_ context.Context, p herb.UpdateParams) (herb.Herb, error) {
	return herb.Herb{ID: p.ID}, nil
}
func (s *herbRepoStub) Delete(context.Context, int64) error { return nil }

type recordingPublisher struct{ events []event.Event }

func (p *recordingPublisher) Publish(_ context.Context, e event.Event) { p.events = append(p.events, e) }

func TestHerbService_CreateValidatesAndPublishes(t *testing.T) {
	pub := &recordingPublisher{}
	svc := usecase.NewHerbService(&herbRepoStub{}, pub)

	_, err := svc.Create(context.Background(), herb.CreateParams{NameThai: "  "})
	require.ErrorIs(t, err, usecase.ErrInvalidHerb)

	created, err := svc.Create(context.Background(), herb.CreateParams{NameThai: "ขมิ้นชัน"})
	require.NoError(t, err)
	require.Equal(t, int64(1), created.ID)
	require.Len(t, pub.events, 1)
	require.Equal(t, "herb.created", pub.events[0].EventName())
}
```

> If the package already has a shared publisher fake (check `healer_service_test.go`), delete `recordingPublisher` here and reuse the shared one to avoid a duplicate-type compile error.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/usecase/ -run TestHerbService -v`
Expected: FAIL — `usecase.NewHerbService` undefined.

- [ ] **Step 3: Write the service**

Create `backend/internal/usecase/herb_service.go`:

```go
package usecase

import (
	"context"
	"errors"
	"strings"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
)

// ErrInvalidHerb means the herb input failed validation.
var ErrInvalidHerb = errors.New("invalid herb")

// HerbService creates, reads, and changes herbs, publishing events on write.
type HerbService struct {
	repo      herb.Repository
	publisher Publisher
}

// NewHerbService builds the herb service.
func NewHerbService(repo herb.Repository, publisher Publisher) *HerbService {
	return &HerbService{repo: repo, publisher: publisher}
}

// Create validates and stores a herb, then publishes CreatedEvent.
func (s *HerbService) Create(ctx context.Context, p herb.CreateParams) (herb.Herb, error) {
	if strings.TrimSpace(p.NameThai) == "" {
		return herb.Herb{}, ErrInvalidHerb
	}
	created, err := s.repo.Create(ctx, p)
	if err != nil {
		return herb.Herb{}, err
	}
	s.publisher.Publish(ctx, herb.CreatedEvent{HerbID: created.ID})
	return created, nil
}

// Get returns one herb.
func (s *HerbService) Get(ctx context.Context, id int64) (herb.Herb, error) {
	return s.repo.GetByID(ctx, id)
}

// List returns every herb.
func (s *HerbService) List(ctx context.Context) ([]herb.Herb, error) {
	return s.repo.List(ctx)
}

// Update validates and changes a herb, then publishes UpdatedEvent.
func (s *HerbService) Update(ctx context.Context, p herb.UpdateParams) (herb.Herb, error) {
	if strings.TrimSpace(p.NameThai) == "" {
		return herb.Herb{}, ErrInvalidHerb
	}
	updated, err := s.repo.Update(ctx, p)
	if err != nil {
		return herb.Herb{}, err
	}
	s.publisher.Publish(ctx, herb.UpdatedEvent{HerbID: updated.ID})
	return updated, nil
}

// Delete removes a herb, then publishes DeletedEvent.
func (s *HerbService) Delete(ctx context.Context, id int64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.publisher.Publish(ctx, herb.DeletedEvent{HerbID: id})
	return nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && go test ./internal/usecase/ -run TestHerbService -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/usecase/herb_service.go backend/internal/usecase/herb_service_test.go
git commit -m "feat(herb): add herb use case with events"
```

---

## Task 3: Herb HTTP handler, routes, and wiring

**Files:**
- Create: `backend/internal/adapter/http/herb_handler.go`
- Test: `backend/internal/adapter/http/herb_handler_test.go`
- Modify: `backend/cmd/api/main.go`

**Interfaces:**
- Consumes: `*usecase.HerbService`.
- Produces: `httpapi.NewHerbHandler(*usecase.HerbService) *HerbHandler` implementing `RegisterRoutes(public, protected *gin.RouterGroup)`.
- JSON DTO field names (camelCase): `id, nameThai, nameEnglish, scientificName, properties, description, createdAt, updatedAt`.
- Public routes: `GET /api/v1/herbs`, `GET /api/v1/herbs/:herbId`. Protected: `POST /api/v1/herbs`, `PUT /api/v1/herbs/:herbId`, `DELETE /api/v1/herbs/:herbId`. (`GET /api/v1/herbs/:herbId/remedies` is added in Task 5 where remedy-by-herb reads exist.)

- [ ] **Step 1: Write the failing handler test**

Create `backend/internal/adapter/http/herb_handler_test.go`. Mirror the existing `healer_handler_test.go` harness (reuse its router/test helpers if present). Minimum:

```go
package http_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHerbHandler_CreateAndGet(t *testing.T) {
	srv := newTestServer(t) // existing helper wiring a router with an in-memory/real herb service
	// POST /api/v1/herbs (with auth token from the helper)
	body := `{"nameThai":"ไพล","nameEnglish":"Cassumunar ginger"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/herbs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	srv.authorize(req) // helper adds Bearer token
	rec := httptest.NewRecorder()
	srv.engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var created map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Equal(t, "ไพล", created["nameThai"])
}
```

> Read `healer_handler_test.go` first and copy its exact server-setup helper (`newTestServer`/`authorize` names may differ). If handler tests there use a real service + testcontainers, follow that; if they use a stub service, define a herb stub the same way.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/ -run TestHerbHandler -v`
Expected: FAIL — herb handler undefined.

- [ ] **Step 3: Write the handler**

Create `backend/internal/adapter/http/herb_handler.go`:

```go
package http

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// HerbHandler serves the herb read and write endpoints.
type HerbHandler struct {
	service *usecase.HerbService
}

// NewHerbHandler builds the herb handler.
func NewHerbHandler(service *usecase.HerbService) *HerbHandler {
	return &HerbHandler{service: service}
}

// RegisterRoutes mounts the herb routes: reads public, writes JWT-guarded.
func (h *HerbHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/herbs", h.List)
	public.GET("/herbs/:herbId", h.Get)
	protected.POST("/herbs", h.Create)
	protected.PUT("/herbs/:herbId", h.Update)
	protected.DELETE("/herbs/:herbId", h.Delete)
}

type herbDTO struct {
	ID             int64     `json:"id"`
	NameThai       string    `json:"nameThai"`
	NameEnglish    string    `json:"nameEnglish"`
	ScientificName string    `json:"scientificName"`
	Properties     string    `json:"properties"`
	Description    string    `json:"description"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func toHerbDTO(h herb.Herb) herbDTO {
	return herbDTO{
		ID:             h.ID,
		NameThai:       h.NameThai,
		NameEnglish:    h.NameEnglish,
		ScientificName: h.ScientificName,
		Properties:     h.Properties,
		Description:    h.Description,
		CreatedAt:      h.CreatedAt,
		UpdatedAt:      h.UpdatedAt,
	}
}

type herbRequest struct {
	NameThai       string `json:"nameThai"`
	NameEnglish    string `json:"nameEnglish"`
	ScientificName string `json:"scientificName"`
	Properties     string `json:"properties"`
	Description    string `json:"description"`
}

// List handles GET /api/v1/herbs.
func (h *HerbHandler) List(c *gin.Context) {
	list, err := h.service.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list herbs"})
		return
	}
	out := make([]herbDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toHerbDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/herbs/:herbId.
func (h *HerbHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, herb.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read herb"})
		return
	}
	c.JSON(http.StatusOK, toHerbDTO(found))
}

// Create handles POST /api/v1/herbs.
func (h *HerbHandler) Create(c *gin.Context) {
	var req herbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), herb.CreateParams{
		NameThai:       req.NameThai,
		NameEnglish:    req.NameEnglish,
		ScientificName: req.ScientificName,
		Properties:     req.Properties,
		Description:    req.Description,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidHerb) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "thai name is required"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create herb"})
		return
	}
	c.JSON(http.StatusCreated, toHerbDTO(created))
}

// Update handles PUT /api/v1/herbs/:herbId.
func (h *HerbHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	var req herbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), herb.UpdateParams{
		ID:             id,
		NameThai:       req.NameThai,
		NameEnglish:    req.NameEnglish,
		ScientificName: req.ScientificName,
		Properties:     req.Properties,
		Description:    req.Description,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidHerb):
			c.JSON(http.StatusBadRequest, gin.H{"error": "thai name is required"})
		case errors.Is(err, herb.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update herb"})
		}
		return
	}
	c.JSON(http.StatusOK, toHerbDTO(updated))
}

// Delete handles DELETE /api/v1/herbs/:herbId.
func (h *HerbHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, herb.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
		case errors.Is(err, herb.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "herb is used by remedies; unlink them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete herb"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 4: Wire herb into main + subscribe events**

In `backend/cmd/api/main.go`:
- After the existing `bus.Subscribe("photo.deleted", ...)` line add:

```go
	bus.Subscribe("herb.created", auditHandler(logger))
	bus.Subscribe("herb.updated", auditHandler(logger))
	bus.Subscribe("herb.deleted", auditHandler(logger))
```

- After the `searchHandler := ...` block add:

```go
	herbHandler := httpapi.NewHerbHandler(
		usecase.NewHerbService(repository.NewHerb(queries), bus),
	)
```

- Add `herbHandler` to the `NewRouter(...)` argument list.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && go test ./internal/adapter/http/ -run TestHerbHandler -v`
Expected: PASS.

- [ ] **Step 6: Build and commit**

```bash
cd backend && go build ./...
git add backend/internal/adapter/http/herb_handler.go backend/internal/adapter/http/herb_handler_test.go backend/cmd/api/main.go
git commit -m "feat(herb): add herb HTTP routes and wiring"
```

---

## Task 4: remedy_herb link — migration, sqlc, remedy domain + transactional repository

**Files:**
- Create: `backend/migrations/000010_create_remedy_herb.up.sql`, `.down.sql`
- Create: `backend/internal/adapter/repository/query/remedy_herb.sql`
- Modify: `backend/internal/domain/remedy/remedy.go`
- Modify: `backend/internal/adapter/repository/query/remedy.sql`
- Modify: `backend/internal/adapter/repository/remedy_repository.go`
- Modify: `backend/internal/usecase/remedy_service.go`
- Modify: `backend/cmd/api/main.go` (remedy repo now needs the pool)
- Test: `backend/internal/adapter/repository/remedy_repository_test.go` (extend)

**Interfaces:**
- Produces domain types:
  - `remedy.HerbRef{ HerbID int64; Amount string }` (write side)
  - `remedy.HerbLink{ HerbID int64; NameThai string; NameEnglish string; Amount string }` (read side)
  - `remedy.Remedy` drops `Ingredients`, gains `Herbs []HerbLink`
  - `remedy.CreateParams` drops `Ingredients`, gains `Herbs []HerbRef`
  - `remedy.UpdateParams` drops `Ingredients`, gains `Herbs []HerbRef`
  - `remedy.SearchResult` drops `Ingredients`
  - `remedy.Repository` gains `ListByHerb(ctx, herbID int64) ([]Remedy, error)`
- Produces repository constructor change: `repository.NewRemedy(pool *pgxpool.Pool) *Remedy` (repo builds `db.New(pool)` internally and begins transactions on the pool).
- Consumes: `db.Queries.WithTx(tx)`, `pgxpool.Pool.Begin(ctx)`.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/000010_create_remedy_herb.up.sql`:

```sql
CREATE TABLE remedy_herb (
    remedy_id BIGINT NOT NULL REFERENCES remedy (id) ON DELETE CASCADE,
    herb_id   BIGINT NOT NULL REFERENCES herb (id),
    amount    TEXT NOT NULL DEFAULT '',
    position  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (remedy_id, herb_id)
);

CREATE INDEX remedy_herb_herb_id_idx ON remedy_herb (herb_id);

-- Ingredients are now the linked herbs.
DROP INDEX IF EXISTS remedy_ingredients_trgm;
ALTER TABLE remedy DROP COLUMN ingredients;
```

Create `backend/migrations/000010_create_remedy_herb.down.sql`:

```sql
ALTER TABLE remedy ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';
CREATE INDEX remedy_ingredients_trgm ON remedy USING gin (ingredients gin_trgm_ops);
DROP TABLE IF EXISTS remedy_herb;
```

> `ON DELETE CASCADE` on `remedy_id` means deleting a remedy also clears its links; the existing remedy-delete FK guard (cases) is unchanged. The `herb_id` FK has no cascade, so a herb still linked cannot be deleted — this is what maps to `herb.ErrReferenced` in Task 1.

- [ ] **Step 2: Change the remedy domain**

In `backend/internal/domain/remedy/remedy.go`:
- Add link types:

```go
// HerbRef links a remedy to a herb with an amount (write side).
type HerbRef struct {
	HerbID int64
	Amount string
}

// HerbLink is a herb linked to a remedy, with display names (read side).
type HerbLink struct {
	HerbID      int64
	NameThai    string
	NameEnglish string
	Amount      string
}
```

- In `Remedy`, delete `Ingredients string` and add `Herbs []HerbLink`.
- In `CreateParams`, delete `Ingredients string` and add `Herbs []HerbRef`.
- In `UpdateParams`, delete `Ingredients string` and add `Herbs []HerbRef`.
- In `SearchResult`, delete `Ingredients string`.
- In `Repository`, add: `ListByHerb(ctx context.Context, herbID int64) ([]Remedy, error)`.

- [ ] **Step 3: Update remedy sqlc queries (drop ingredients, rework search)**

Edit `backend/internal/adapter/repository/query/remedy.sql` — remove `ingredients` everywhere and rework search to match herb names via the join. Replace the whole file with:

```sql
-- name: CreateRemedy :one
INSERT INTO remedy (healer_id, name, symptoms, preparation_method, usage, note)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: GetRemedy :one
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE id = $1;

-- name: ListRemedyByHealer :many
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE healer_id = $1
ORDER BY name;

-- name: ListRecentRemedy :many
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
ORDER BY created_at DESC, id DESC
LIMIT $1;

-- name: UpdateRemedy :one
UPDATE remedy
SET name = $2, symptoms = $3, preparation_method = $4, usage = $5, note = $6, updated_at = now()
WHERE id = $1
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: DeleteRemedy :execrows
DELETE FROM remedy WHERE id = $1;

-- name: SearchRemedy :many
SELECT DISTINCT r.id, r.name, r.symptoms, r.healer_id, h.full_name AS healer_full_name
FROM remedy r
JOIN healer h ON h.id = r.healer_id
LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
LEFT JOIN herb hb ON hb.id = rh.herb_id
WHERE r.name ILIKE '%' || @search_term::text || '%'
   OR r.symptoms ILIKE '%' || @search_term::text || '%'
   OR hb.name_thai ILIKE '%' || @search_term::text || '%'
   OR hb.name_english ILIKE '%' || @search_term::text || '%'
ORDER BY r.name;
```

> Ranking by `similarity()` is dropped from remedy search because the join makes the `GREATEST(...)` ordering ambiguous with `DISTINCT`; ordering by name is acceptable for the first cut (the spec already defers ranking niceties). Herb search (Task 1) keeps similarity ranking.

- [ ] **Step 4: Write the remedy_herb queries**

Create `backend/internal/adapter/repository/query/remedy_herb.sql`:

```sql
-- name: InsertRemedyHerb :exec
INSERT INTO remedy_herb (remedy_id, herb_id, amount, position)
VALUES ($1, $2, $3, $4);

-- name: DeleteRemedyHerbByRemedy :exec
DELETE FROM remedy_herb WHERE remedy_id = $1;

-- name: ListHerbByRemedy :many
SELECT rh.herb_id, h.name_thai, h.name_english, rh.amount
FROM remedy_herb rh
JOIN herb h ON h.id = rh.herb_id
WHERE rh.remedy_id = $1
ORDER BY rh.position, h.name_thai;

-- name: ListRemedyByHerb :many
SELECT r.id, r.healer_id, r.name, r.symptoms, r.preparation_method, r.usage, r.note, r.created_at, r.updated_at
FROM remedy r
JOIN remedy_herb rh ON rh.remedy_id = r.id
WHERE rh.herb_id = $1
ORDER BY r.name;
```

- [ ] **Step 5: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: `db/remedy.sql.go` regenerated without `Ingredients`; new `remedy_herb.sql.go`; `db/models.go` `Remedy` loses `Ingredients`. No errors.

- [ ] **Step 6: Extend the failing repository test**

Add to `backend/internal/adapter/repository/remedy_repository_test.go` a test that creates a healer + two herbs, creates a remedy with two herb links, reads them back, updates the links, and lists remedies by herb:

```go
func TestRemedyRepository_HerbLinks(t *testing.T) {
	pool := newTestPool(t) // existing helper returning *pgxpool.Pool
	queries := db.New(pool)
	healerRepo := repository.NewHealer(queries)
	herbRepo := repository.NewHerb(queries)
	remedyRepo := repository.NewRemedy(pool)
	ctx := context.Background()

	d := firstDistrictID(t, ctx, queries) // existing helper used by healer test
	h, err := healerRepo.Create(ctx, healer.CreateParams{DistrictID: d, FullName: "หมอทดสอบ"})
	require.NoError(t, err)
	hb1, _ := herbRepo.Create(ctx, herb.CreateParams{NameThai: "ขิง"})
	hb2, _ := herbRepo.Create(ctx, herb.CreateParams{NameThai: "ไพล"})

	created, err := remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: h.ID, Name: "ยาต้ม",
		Herbs: []remedy.HerbRef{{HerbID: hb1.ID, Amount: "2 กำมือ"}, {HerbID: hb2.ID}},
	})
	require.NoError(t, err)

	got, err := remedyRepo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Len(t, got.Herbs, 2)
	require.Equal(t, "ขิง", got.Herbs[0].NameThai)

	byHerb, err := remedyRepo.ListByHerb(ctx, hb1.ID)
	require.NoError(t, err)
	require.Len(t, byHerb, 1)

	_, err = remedyRepo.Update(ctx, remedy.UpdateParams{
		ID: created.ID, Name: "ยาต้ม*",
		Herbs: []remedy.HerbRef{{HerbID: hb2.ID, Amount: "1 ช้อน"}},
	})
	require.NoError(t, err)
	got, _ = remedyRepo.GetByID(ctx, created.ID)
	require.Len(t, got.Herbs, 1)
	require.Equal(t, hb2.ID, got.Herbs[0].HerbID)
}
```

> Match the existing test helpers by name (`newTestPool`, `firstDistrictID`, etc.). Read the current `remedy_repository_test.go` and `healer_repository_test.go` first. Add imports for `pgxpool`, `db`, `herb`.

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestRemedyRepository_HerbLinks -v`
Expected: FAIL — `NewRemedy(pool)` signature mismatch / `HerbRef` undefined until code is written.

- [ ] **Step 8: Rewrite the remedy repository with a pool + transactions**

Replace `backend/internal/adapter/repository/remedy_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// Remedy stores and reads remedies (and their herb links) in Postgres.
type Remedy struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// NewRemedy builds the remedy repository. It needs the pool to run the
// remedy + remedy_herb writes in one transaction.
func NewRemedy(pool *pgxpool.Pool) *Remedy {
	return &Remedy{pool: pool, q: db.New(pool)}
}

func toRemedy(row db.Remedy) remedy.Remedy {
	return remedy.Remedy{
		ID:                row.ID,
		HealerID:          row.HealerID,
		Name:              row.Name,
		Symptoms:          row.Symptoms,
		PreparationMethod: row.PreparationMethod,
		Usage:             row.Usage,
		Note:              row.Note,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

func (r *Remedy) loadHerbs(ctx context.Context, remedyID int64) ([]remedy.HerbLink, error) {
	rows, err := r.q.ListHerbByRemedy(ctx, remedyID)
	if err != nil {
		return nil, err
	}
	links := make([]remedy.HerbLink, 0, len(rows))
	for _, row := range rows {
		links = append(links, remedy.HerbLink{
			HerbID:      row.HerbID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
			Amount:      row.Amount,
		})
	}
	return links, nil
}

// Create inserts a remedy and its herb links in one transaction.
func (r *Remedy) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return remedy.Remedy{}, err
	}
	defer tx.Rollback(ctx)
	qtx := r.q.WithTx(tx)

	row, err := qtx.CreateRemedy(ctx, db.CreateRemedyParams{
		HealerID:          p.HealerID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		return remedy.Remedy{}, err
	}
	if err := insertHerbLinks(ctx, qtx, row.ID, p.Herbs); err != nil {
		return remedy.Remedy{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, row.ID)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
}

// GetByID returns one remedy with its herb links, or remedy.ErrNotFound.
func (r *Remedy) GetByID(ctx context.Context, id int64) (remedy.Remedy, error) {
	row, err := r.q.GetRemedy(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, id)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
}

// ListByHealer returns a healer's remedies (without herb links, for list views).
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

// ListByHerb returns the remedies that use a herb.
func (r *Remedy) ListByHerb(ctx context.Context, herbID int64) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRemedyByHerb(ctx, herbID)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, remedy.Remedy{
			ID:                row.ID,
			HealerID:          row.HealerID,
			Name:              row.Name,
			Symptoms:          row.Symptoms,
			PreparationMethod: row.PreparationMethod,
			Usage:             row.Usage,
			Note:              row.Note,
			CreatedAt:         row.CreatedAt.Time,
			UpdatedAt:         row.UpdatedAt.Time,
		})
	}
	return result, nil
}

// ListRecent returns the most recently created remedies.
func (r *Remedy) ListRecent(ctx context.Context, limit int32) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRecentRemedy(ctx, limit)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, toRemedy(row))
	}
	return result, nil
}

// Update changes a remedy and replaces its herb links in one transaction.
func (r *Remedy) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return remedy.Remedy{}, err
	}
	defer tx.Rollback(ctx)
	qtx := r.q.WithTx(tx)

	row, err := qtx.UpdateRemedy(ctx, db.UpdateRemedyParams{
		ID:                p.ID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
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
	if err := qtx.DeleteRemedyHerbByRemedy(ctx, p.ID); err != nil {
		return remedy.Remedy{}, err
	}
	if err := insertHerbLinks(ctx, qtx, p.ID, p.Herbs); err != nil {
		return remedy.Remedy{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, p.ID)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
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

// Search returns remedies whose name, symptoms, or linked herb names match.
func (r *Remedy) Search(ctx context.Context, term string) ([]remedy.SearchResult, error) {
	rows, err := r.q.SearchRemedy(ctx, term)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.SearchResult, 0, len(rows))
	for _, row := range rows {
		result = append(result, remedy.SearchResult{
			ID:             row.ID,
			Name:           row.Name,
			Symptoms:       row.Symptoms,
			HealerID:       row.HealerID,
			HealerFullName: row.HealerFullName,
		})
	}
	return result, nil
}

func insertHerbLinks(ctx context.Context, qtx *db.Queries, remedyID int64, refs []remedy.HerbRef) error {
	for i, ref := range refs {
		if err := qtx.InsertRemedyHerb(ctx, db.InsertRemedyHerbParams{
			RemedyID: remedyID,
			HerbID:   ref.HerbID,
			Amount:   ref.Amount,
			Position: int32(i),
		}); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 9: Pass herbs through the remedy service**

In `backend/internal/usecase/remedy_service.go`, the service already forwards `CreateParams`/`UpdateParams` to the repo — since the struct now carries `Herbs`, no field-by-field change is needed. Confirm `Create`/`Update` still compile (they pass `p` straight through). No behavior change beyond the struct.

- [ ] **Step 10: Update remedy repo wiring in main**

In `backend/cmd/api/main.go` change:

```go
	remedyHandler := httpapi.NewRemedyHandler(
		usecase.NewRemedyService(repository.NewRemedy(pool), bus),
	)
```

and update the `searchHandler` construction (Task 6 will revisit) to also use `repository.NewRemedy(pool)`. For now change every `repository.NewRemedy(queries)` occurrence to `repository.NewRemedy(pool)`.

- [ ] **Step 11: Run the test to verify it passes**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestRemedyRepository -v`
Expected: PASS. Also run `go build ./...` — fix any remaining `Ingredients` references the compiler flags (the remedy handler in Task 5 still references it; that is expected to fail to build until Task 5 — so run only the repository package build here: `go build ./internal/adapter/repository/... ./internal/domain/... ./internal/usecase/...`).

- [ ] **Step 12: Commit**

```bash
git add backend/migrations/000010_create_remedy_herb.*.sql backend/internal/domain/remedy backend/internal/adapter/repository/query backend/internal/adapter/repository/remedy_repository.go backend/internal/adapter/repository/remedy_repository_test.go backend/internal/usecase/remedy_service.go backend/cmd/api/main.go backend/internal/adapter/repository/db
git commit -m "feat(remedy): link remedies to herbs, drop free-text ingredients"
```

---

## Task 5: Remedy + treatment-case HTTP — herbs in/out and recent-list endpoints

**Files:**
- Modify: `backend/internal/adapter/http/remedy_handler.go`
- Modify: `backend/internal/usecase/remedy_service.go` (add `ListRecent`)
- Modify: `backend/internal/usecase/treatment_case_service.go` (add `ListRecent`)
- Modify: `backend/internal/adapter/repository/treatment_case_repository.go` (add `ListRecent`)
- Modify: `backend/internal/adapter/repository/query/treatment_case.sql` (add recent query) + sqlc generate
- Modify: `backend/internal/adapter/http/treatment_case_handler.go` (add `GET /treatment-cases`)
- Modify: `backend/internal/adapter/http/herb_handler.go` (add `GET /herbs/:herbId/remedies`)
- Modify: `backend/cmd/api/main.go` (herb handler needs remedy reader)
- Test: `backend/internal/adapter/http/remedy_handler_test.go` (extend)

**Interfaces:**
- Remedy DTO gains `herbs` array; request accepts `herbs: [{herbId, amount}]`, drops `ingredients`.
  - `remedyHerbDTO{ HerbID int64 json:"herbId"; NameThai string json:"nameThai"; NameEnglish string json:"nameEnglish"; Amount string json:"amount" }`
  - `remedyHerbRequest{ HerbID int64 json:"herbId"; Amount string json:"amount" }`
- `GET /api/v1/remedies?limit=N` → `[]remedyDTO` (recent). `GET /api/v1/treatment-cases?limit=N` → recent cases.
- `GET /api/v1/herbs/:herbId/remedies` → `[]remedyDTO` (uses `remedy.ListByHerb`). This route lives on the herb handler, which now also holds a `remedyReader` with `ListByHerb`.
- `usecase.RemedyService.ListRecent(ctx, limit int) ([]remedy.Remedy, error)`; `usecase.TreatmentCaseService.ListRecent(ctx, limit int) ([]treatmentcase.TreatmentCase, error)`.

- [ ] **Step 1: Extend the failing remedy handler test**

Add a test asserting a POST with `herbs` returns the herbs in the response and that `GET /api/v1/remedies` returns a list. (Mirror the existing remedy handler test harness.)

```go
func TestRemedyHandler_CreateWithHerbs(t *testing.T) {
	srv := newTestServer(t)
	// assume helper seeds a healer id=1 and a herb id=1
	body := `{"healerId":1,"name":"ยาต้ม","herbs":[{"herbId":1,"amount":"2 กำมือ"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	srv.authorize(req)
	rec := httptest.NewRecorder()
	srv.engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code)
	require.Contains(t, rec.Body.String(), `"herbs"`)
	require.Contains(t, rec.Body.String(), `"herbId":1`)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/ -run TestRemedyHandler_CreateWithHerbs -v`
Expected: FAIL — build error (`Ingredients` gone) or missing `herbs` handling.

- [ ] **Step 3: Update the remedy handler DTOs**

In `backend/internal/adapter/http/remedy_handler.go`:
- Add:

```go
type remedyHerbDTO struct {
	HerbID      int64  `json:"herbId"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
	Amount      string `json:"amount"`
}

type remedyHerbRequest struct {
	HerbID int64  `json:"herbId"`
	Amount string `json:"amount"`
}
```

- In `remedyDTO`, remove `Ingredients string ...` and add `Herbs []remedyHerbDTO json:"herbs"`.
- In `remedyRequest`, remove `Ingredients string ...` and add `Herbs []remedyHerbRequest json:"herbs"`.
- In `toRemedyDTO`, remove the `Ingredients` line and build `Herbs`:

```go
	herbs := make([]remedyHerbDTO, 0, len(r.Herbs))
	for _, l := range r.Herbs {
		herbs = append(herbs, remedyHerbDTO{HerbID: l.HerbID, NameThai: l.NameThai, NameEnglish: l.NameEnglish, Amount: l.Amount})
	}
	// set Herbs: herbs in the returned struct
```

- In `Create` and `Update`, map the request herbs to `[]remedy.HerbRef`:

```go
	refs := make([]remedy.HerbRef, 0, len(req.Herbs))
	for _, h := range req.Herbs {
		refs = append(refs, remedy.HerbRef{HerbID: h.HerbID, Amount: h.Amount})
	}
```

and set `Herbs: refs` in `remedy.CreateParams` / `remedy.UpdateParams`. Remove the `Ingredients: req.Ingredients` lines.

- Add the recent route + handler:

```go
// In RegisterRoutes, add:
	public.GET("/remedies", h.ListRecent)

// ListRecent handles GET /api/v1/remedies?limit=N (default 12).
func (h *RemedyHandler) ListRecent(c *gin.Context) {
	limit := parseLimit(c.Query("limit"), 12)
	list, err := h.service.ListRecent(c.Request.Context(), limit)
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
```

Add a shared helper in a suitable http file (e.g. a new `helpers.go` or top of `remedy_handler.go`):

```go
func parseLimit(raw string, def int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 || n > 100 {
		return def
	}
	return n
}
```

- [ ] **Step 4: Add RemedyService.ListRecent**

In `backend/internal/usecase/remedy_service.go` add:

```go
// ListRecent returns the most recent remedies (limit clamped by the repo query).
func (s *RemedyService) ListRecent(ctx context.Context, limit int) ([]remedy.Remedy, error) {
	return s.repo.ListRecent(ctx, int32(limit))
}
```

Add `ListRecent(ctx context.Context, limit int32) ([]Remedy, error)` to the `remedy.Repository` interface (domain) so the service can call it. (The repository already implements it from Task 4 Step 8.)

- [ ] **Step 5: Add treatment-case recent query, repo, service, route**

- `backend/internal/adapter/repository/query/treatment_case.sql` — add:

```sql
-- name: ListRecentTreatmentCase :many
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
ORDER BY treated_on DESC, id DESC
LIMIT $1;
```

Run `sqlc generate`.

- In `treatment_case_repository.go` add `ListRecent(ctx, limit int32) ([]treatmentcase.TreatmentCase, error)` mirroring the existing `ListByRemedy` mapping but calling `ListRecentTreatmentCase`.
- Add `ListRecent(ctx, int32) ([]TreatmentCase, error)` to the `treatmentcase.Repository` interface.
- In `treatment_case_service.go` add `ListRecent(ctx, limit int) (...)` forwarding to the repo.
- In `treatment_case_handler.go` add to `RegisterRoutes`: `public.GET("/treatment-cases", h.ListRecent)` and a `ListRecent` handler using `parseLimit(c.Query("limit"), 12)` and the existing case DTO mapper.

- [ ] **Step 6: Add GET /herbs/:herbId/remedies**

The herb handler needs to read remedies by herb. Give it a small reader interface:

- In `herb_handler.go`:

```go
// RemedyReader lists remedies that use a herb (for the herb profile page).
type RemedyReader interface {
	ListByHerb(ctx context.Context, herbID int64) ([]remedy.Remedy, error)
}

// HerbHandler ... add field:
//   remedyReader RemedyReader
// NewHerbHandler(service *usecase.HerbService, remedyReader RemedyReader) *HerbHandler
```

Update `NewHerbHandler` to take the reader, add `public.GET("/herbs/:herbId/remedies", h.ListRemedies)`, and implement `ListRemedies` returning `[]remedyDTO` (import the remedy DTO mapper — it is in the same `http` package, so `toRemedyDTO` is directly callable).

- In `cmd/api/main.go` update the herb handler wiring:

```go
	remedyRepo := repository.NewRemedy(pool)
	herbHandler := httpapi.NewHerbHandler(
		usecase.NewHerbService(repository.NewHerb(queries), bus),
		remedyRepo,
	)
```

(Reuse `remedyRepo` for the remedy service too, so the pool-backed repo is shared.)

- [ ] **Step 7: Run tests + build to verify green**

Run: `cd backend && go build ./... && go test ./internal/adapter/http/ -run 'TestRemedyHandler|TestHerbHandler|TestTreatmentCase' -v`
Expected: PASS and clean build (all `Ingredients` references gone).

- [ ] **Step 8: Commit**

```bash
git add backend/internal/adapter/http backend/internal/usecase backend/internal/adapter/repository backend/internal/domain/remedy backend/internal/domain/treatmentcase backend/cmd/api/main.go
git commit -m "feat(remedy): herbs in remedy DTO + recent remedy/case + herb remedies endpoints"
```

---

## Task 6: Search — add herb group

**Files:**
- Modify: `backend/internal/usecase/search/service.go`
- Modify: `backend/internal/adapter/http/search_handler.go`
- Modify: `backend/cmd/api/main.go` (pass herb reader into search)
- Test: `backend/internal/usecase/search/service_test.go` (extend)

**Interfaces:**
- `search.HerbReader interface { Search(ctx, term string) ([]herb.Herb, error) }` (the herb repository already has `Search`).
- `search.Result` gains `Herbs []herb.Herb`.
- `search.NewService(remedyReader RemedyReader, healerReader HealerReader, herbReader HerbReader) *Service`.
- Search response DTO gains `herbs: [{id, nameThai, nameEnglish, scientificName}]`. Remedy match DTO drops `ingredients`.

- [ ] **Step 1: Extend the failing search service test**

Add a stub herb reader and assert `Search` returns herb matches. Mirror the existing `service_test.go` stubs.

```go
func TestSearch_IncludesHerbs(t *testing.T) {
	svc := search.NewService(stubRemedyReader{}, stubHealerReader{}, stubHerbReader{herbs: []herb.Herb{{ID: 1, NameThai: "ขิง"}}})
	res, err := svc.Search(context.Background(), "ขิง")
	require.NoError(t, err)
	require.Len(t, res.Herbs, 1)
}
```

(Define `stubHerbReader` next to the existing stubs.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/usecase/search/ -run TestSearch_IncludesHerbs -v`
Expected: FAIL — `NewService` arity/`Result.Herbs` undefined.

- [ ] **Step 3: Update the search service**

In `backend/internal/usecase/search/service.go`:
- Import `herb`.
- Add `HerbReader` interface and a `herbReader` field.
- Add `Herbs []herb.Herb` to `Result`.
- Update `NewService` to take the third reader.
- In `Search`, after fetching healers, fetch herbs and set `Result.Herbs`.

- [ ] **Step 4: Update the search handler DTO**

In `backend/internal/adapter/http/search_handler.go`:
- Remove `Ingredients` from `remedyMatchDTO` (and its mapping).
- Add:

```go
type herbMatchDTO struct {
	ID             int64  `json:"id"`
	NameThai       string `json:"nameThai"`
	NameEnglish    string `json:"nameEnglish"`
	ScientificName string `json:"scientificName"`
}
```

- Add `Herbs []herbMatchDTO json:"herbs"` to `searchResponseDTO` and populate it from `result.Herbs`.

- [ ] **Step 5: Update main wiring**

In `cmd/api/main.go`:

```go
	searchHandler := httpapi.NewSearchHandler(
		search.NewService(remedyRepo, repository.NewHealer(queries), repository.NewHerb(queries)),
	)
```

- [ ] **Step 6: Run tests + build**

Run: `cd backend && go build ./... && go test ./internal/usecase/search/ ./internal/adapter/http/ -v`
Expected: PASS.

- [ ] **Step 7: Full backend test sweep + commit**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...`
Expected: PASS.

```bash
git add backend/internal/usecase/search backend/internal/adapter/http/search_handler.go backend/cmd/api/main.go
git commit -m "feat(search): add herb result group, drop ingredients from remedy match"
```

---

## Task 7: Seed rework — real herbs + remedy_herb links

**Files:**
- Modify: `backend/cmd/seed/generate.go`
- Modify: `backend/cmd/seed/main.go`
- Test: `backend/cmd/seed/generate_test.go` (update)

**Interfaces:**
- `generate.go` produces herb `CreateParams` from a curated pool and produces herb references for a remedy.
- `randomRemedy` no longer sets `Ingredients` (that field is gone). Add `pickHerbRefs(r *rand.Rand, herbIDs []int64) []remedy.HerbRef`.

- [ ] **Step 1: Update the generator test**

In `backend/cmd/seed/generate_test.go`:
- Remove the `rm.Ingredients` assertion from `TestRandomRemedy`.
- Add a curated-herb test:

```go
func TestHerbPool(t *testing.T) {
	require.NotEmpty(t, herbSeedPool)
	require.NotEmpty(t, herbSeedPool[0].NameThai)
}

func TestPickHerbRefs(t *testing.T) {
	refs := pickHerbRefs(newRand(), []int64{1, 2, 3, 4, 5})
	require.GreaterOrEqual(t, len(refs), 1)
	for _, ref := range refs {
		require.NotZero(t, ref.HerbID)
	}
}
```

(`newRand()` already exists in this test file. Add `require` import if missing — the current file uses the std `testing` asserts; either add testify or keep std-style asserts to match the file. Match the file's existing style.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./cmd/seed/ -run 'TestHerbPool|TestPickHerbRefs|TestRandomRemedy' -v`
Expected: FAIL — `herbSeedPool` / `pickHerbRefs` undefined; `TestRandomRemedy` fails to compile if it still references `Ingredients`.

- [ ] **Step 3: Update generate.go**

- Replace the free-text `herbPool []string` usage with a curated struct pool:

```go
// herbSeed is one curated herb for the demo.
type herbSeed struct {
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
}

var herbSeedPool = []herbSeed{
	{"ฟ้าทะลายโจร", "Andrographis", "Andrographis paniculata", "แก้ไข้ เจ็บคอ"},
	{"ขมิ้นชัน", "Turmeric", "Curcuma longa", "แก้ท้องอืด สมานแผล"},
	{"ไพล", "Cassumunar ginger", "Zingiber cassumunar", "แก้ปวดเมื่อย"},
	{"กระชายดำ", "Black galingale", "Kaempferia parviflora", "บำรุงกำลัง"},
	{"บอระเพ็ด", "Tinospora", "Tinospora crispa", "แก้ไข้ เจริญอาหาร"},
	{"ขิง", "Ginger", "Zingiber officinale", "ขับลม แก้คลื่นไส้"},
	{"ตะไคร้", "Lemongrass", "Cymbopogon citratus", "ขับลม แก้ท้องอืด"},
	{"ว่านหางจระเข้", "Aloe vera", "Aloe vera", "สมานแผล แก้ร้อนใน"},
	{"รางจืด", "Blue trumpet vine", "Thunbergia laurifolia", "ถอนพิษ"},
	{"ย่านาง", "Bamboo grass", "Tiliacora triandra", "ลดไข้ บำรุง"},
	{"มะขามป้อม", "Indian gooseberry", "Phyllanthus emblica", "แก้ไอ ขับเสมหะ"},
	{"เพชรสังฆาต", "Veldt grape", "Cissus quadrangularis", "แก้ริดสีดวง"},
}

// randomAmount returns a Thai amount string for a herb link.
func randomAmount(r *rand.Rand) string {
	units := []string{"1 กำมือ", "2 กำมือ", "1 ช้อนโต๊ะ", "ครึ่งกิโลกรัม", "3 หัว", "1 กอบ"}
	return pick(r, units)
}

// pickHerbRefs picks 2..4 distinct herb ids with a random amount each.
func pickHerbRefs(r *rand.Rand, herbIDs []int64) []remedy.HerbRef {
	n := 2 + r.Intn(3)
	if n > len(herbIDs) {
		n = len(herbIDs)
	}
	perm := r.Perm(len(herbIDs))
	refs := make([]remedy.HerbRef, 0, n)
	for i := 0; i < n; i++ {
		refs = append(refs, remedy.HerbRef{HerbID: herbIDs[perm[i]], Amount: randomAmount(r)})
	}
	return refs
}
```

- In `randomRemedy`, delete the `Ingredients:` field. Keep the rest. (The remedy still gets `Symptoms`, `PreparationMethod`, `Usage`, `Note`.)

- [ ] **Step 4: Update main.go seeding loop**

In `backend/cmd/seed/main.go`:
- After districts are loaded and before creating healers, create the herbs and collect their ids:

```go
	herbRepo := repository.NewHerb(queries)
	herbIDs := make([]int64, 0, len(herbSeedPool))
	for _, hs := range herbSeedPool {
		h, err := herbRepo.Create(ctx, herb.CreateParams{
			NameThai: hs.NameThai, NameEnglish: hs.NameEnglish,
			ScientificName: hs.ScientificName, Properties: hs.Properties,
			Description: "สมุนไพรพื้นบ้าน",
		})
		if err != nil {
			return err
		}
		herbIDs = append(herbIDs, h.ID)
	}
```

- Change `remedyRepo` construction to `repository.NewRemedy(pool)` (the pool is already available in `run`).
- When building each remedy, set `Herbs: pickHerbRefs(rng, herbIDs)` in the `remedy.CreateParams` produced by `randomRemedy` — either add a field after the call:

```go
		rp := randomRemedy(rng, h.ID)
		rp.Herbs = pickHerbRefs(rng, herbIDs)
		rm, err := remedyRepo.Create(ctx, rp)
```

- Add `-reset` truncation to include the new tables: change the TRUNCATE to `TRUNCATE photo, treatment_case, remedy_herb, remedy, herb, healer RESTART IDENTITY CASCADE`.
- Add a herb photo or two (optional): attach a placeholder photo to the first few herbs using `photo.OwnerHerb`.
- Add imports for `herb`.

- [ ] **Step 5: Run generator tests + build**

Run: `cd backend && go build ./... && go test ./cmd/seed/ -v`
Expected: PASS.

- [ ] **Step 6: Reseed against a fresh DB and verify**

```bash
cd backend && docker compose up -d && sleep 4
DATABASE_URL='postgres://folk:folk@localhost:5432/folk_medicine?sslmode=disable' JWT_SECRET=dev PHOTO_STORAGE_DIR=./storage/photo go run ./cmd/seed -reset
docker compose exec -T postgres psql -U folk -d folk_medicine -c "SELECT (SELECT count(*) FROM herb) herbs, (SELECT count(*) FROM remedy_herb) links;"
docker compose down
```

Expected: `herbs` = 12, `links` > 0.

- [ ] **Step 7: Commit**

```bash
git add backend/cmd/seed
git commit -m "feat(seed): seed real herbs and remedy-herb links"
```

---

## Task 8: Frontend types + API client + staff queries

**Files:**
- Modify: `src/lib/api-types.ts`, `src/lib/api.ts`, `src/lib/staff-queries.ts`
- Test: `src/lib/api-types` has no test; add a small type-usage in later component tests.

**Interfaces:**
- New types:

```ts
export interface Herb {
  id: number;
  nameThai: string;
  nameEnglish: string;
  scientificName: string;
  properties: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemedyHerb {
  herbId: number;
  nameThai: string;
  nameEnglish: string;
  amount: string;
}

export interface HerbSearchResult {
  id: number;
  nameThai: string;
  nameEnglish: string;
  scientificName: string;
}
```

- `Remedy`: remove `ingredients: string;`, add `herbs: RemedyHerb[];`.
- `RemedySearchResult`: remove `ingredients: string;`.
- `SearchResponse`: add `herbs: HerbSearchResult[];`.

- [ ] **Step 1: Update `src/lib/api-types.ts`** with the above (add `Herb`, `RemedyHerb`, `HerbSearchResult`; edit `Remedy`, `RemedySearchResult`, `SearchResponse`).

- [ ] **Step 2: Add API client functions** in `src/lib/api.ts`:

```ts
export async function listHerbs(): Promise<Herb[]> {
  return getJson<Herb[]>("/herbs");
}

export async function getHerb(id: number): Promise<Herb | null> {
  return getOrNull<Herb>(`/herbs/${id}`);
}

export async function listRemediesByHerb(herbId: number): Promise<Remedy[]> {
  return getJson<Remedy[]>(`/herbs/${herbId}/remedies`);
}

export async function listRecentRemedies(limit = 6): Promise<Remedy[]> {
  return getJson<Remedy[]>(`/remedies?limit=${limit}`);
}

export async function listRecentCases(limit = 6): Promise<TreatmentCase[]> {
  return getJson<TreatmentCase[]>(`/treatment-cases?limit=${limit}`);
}
```

Add `Herb` to the type import list.

- [ ] **Step 3: Add staff herb queries** in `src/lib/staff-queries.ts`:

```ts
export const herbListKey = ["herbs"] as const;

export async function fetchHerbs(): Promise<Herb[]> {
  const res = await fetch(`/api/v1/herbs`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load herbs");
  return (await res.json()) as Herb[];
}

export async function createHerb(input: HerbInput): Promise<void> {
  const res = await fetch("/bff/herbs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create herb");
}

export async function updateHerb(id: number, input: HerbInput): Promise<void> {
  const res = await fetch(`/bff/herbs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update herb");
}

export async function deleteHerb(id: number): Promise<void> {
  const res = await fetch(`/bff/herbs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete herb");
}
```

Add imports for `Herb` and `HerbInput` (from `@/lib/herb-schema`, created in Task 10).

- [ ] **Step 4: Typecheck + commit**

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit` (or `pnpm build` at the end of Task 10 — for now `tsc --noEmit` may error until `herb-schema` exists; if so, defer this commit's typecheck to Task 10 and just commit the type/client additions).

```bash
git add frontend/src/lib/api-types.ts frontend/src/lib/api.ts frontend/src/lib/staff-queries.ts
git commit -m "feat(frontend): herb types, api client, and staff queries"
```

---

## Task 9: Frontend public — home rework, herb pages, remedy detail, search group

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/herbs/page.tsx`, `src/app/herbs/[herbId]/page.tsx`
- Create: `src/app/remedies/page.tsx`, `src/app/treatment-cases/page.tsx`
- Modify: `src/app/remedies/[remedyId]/page.tsx`
- Modify: `src/app/search/page.tsx`

**Interfaces:** consumes `listHerbs`, `getHerb`, `listRemediesByHerb`, `listRecentRemedies`, `listRecentCases`, `getFirstProvince`, `listDistricts`, `getRemedy`, `getHealer` from `@/lib/api`.

- [ ] **Step 1: Rework the home page** `src/app/page.tsx`:

```tsx
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { formatThaiDate } from "@/lib/format";
import { listHerbs, listRecentCases, listRecentRemedies } from "@/lib/api";

export default async function HomePage() {
  const [herbs, remedies, cases] = await Promise.all([
    listHerbs(),
    listRecentRemedies(6),
    listRecentCases(6),
  ]);

  return (
    <section className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-bold">ตำรายาหมอพื้นบ้าน ยโสธร</h1>
        <p className="mb-4 text-stone-500">ค้นหาสมุนไพรและตำรับยา (search herbs and remedies)</p>
        <SearchBox />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">สมุนไพร (Herbs)</h2>
          <Link href="/herbs" className="text-sm text-stone-600 underline">see all →</Link>
        </div>
        {herbs.length === 0 ? (
          <EmptyState message="No herbs yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {herbs.slice(0, 6).map((h) => (
              <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">ตำรับยา (Remedies)</h2>
          <Link href="/remedies" className="text-sm text-stone-600 underline">see all →</Link>
        </div>
        {remedies.length === 0 ? (
          <EmptyState message="No remedies yet." />
        ) : (
          <div className="grid gap-3">
            {remedies.map((r) => (
              <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">เคสการรักษา (Cases)</h2>
          <Link href="/treatment-cases" className="text-sm text-stone-600 underline">see all →</Link>
        </div>
        {cases.length === 0 ? (
          <EmptyState message="No cases yet." />
        ) : (
          <ul className="grid gap-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <Link href={`/remedies/${c.remedyId}`} className="text-sm text-stone-700 hover:underline">
                  {formatThaiDate(c.treatedOn)} · {c.symptoms || "—"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-stone-500">
        <Link href="/districts" className="underline">เลือกตามอำเภอ (browse by district) →</Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Add a `/districts` index page** (the home no longer lists districts, but the secondary link points here). Create `src/app/districts/page.tsx`:

```tsx
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function DistrictsPage() {
  const province = await getFirstProvince();
  if (!province) return <EmptyState message="No province data yet." />;
  const districts = await listDistricts(province.id);
  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold">{province.nameThai}</h1>
      <p className="mb-6 text-stone-500">Choose a district (อำเภอ) to see its healers.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {districts.map((d) => (
          <RecordCard key={d.id} href={`/districts/${d.id}`} title={d.nameThai} subtitle={d.nameEnglish} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/app/herbs/page.tsx`** (all herbs):

```tsx
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listHerbs } from "@/lib/api";

export default async function HerbsPage() {
  const herbs = await listHerbs();
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "สมุนไพร" }]} />
      <h1 className="mb-4 text-2xl font-bold">สมุนไพร (Herbs)</h1>
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {herbs.map((h) => (
            <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create `src/app/herbs/[herbId]/page.tsx`** (profile + remedies using it):

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DefinitionList } from "@/components/DefinitionList";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getHerb, listRemediesByHerb } from "@/lib/api";

export default async function HerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id);

  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "สมุนไพร", href: "/herbs" }, { label: herb.nameThai }]} />
      <h1 className="text-2xl font-bold">{herb.nameThai}</h1>
      {herb.nameEnglish ? <p className="mt-1 text-stone-600">{herb.nameEnglish}</p> : null}
      <div className="mt-4">
        <DefinitionList
          items={[
            { term: "ชื่อวิทยาศาสตร์", value: herb.scientificName },
            { term: "สรรพคุณ", value: herb.properties },
            { term: "รายละเอียด", value: herb.description },
          ]}
        />
      </div>

      <h2 className="mb-3 mt-8 text-xl font-semibold">ตำรับยาที่ใช้สมุนไพรนี้ (Remedies using this herb)</h2>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies use this herb yet." />
      ) : (
        <div className="grid gap-3">
          {remedies.map((r) => (
            <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Create `src/app/remedies/page.tsx`** and `src/app/treatment-cases/page.tsx`:

`remedies/page.tsx`:

```tsx
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listRecentRemedies } from "@/lib/api";

export default async function RemediesPage() {
  const remedies = await listRecentRemedies(50);
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "ตำรับยา" }]} />
      <h1 className="mb-4 text-2xl font-bold">ตำรับยา (Remedies)</h1>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="grid gap-3">
          {remedies.map((r) => (
            <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}
    </section>
  );
}
```

`treatment-cases/page.tsx`:

```tsx
import Link from "next/link";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { listRecentCases } from "@/lib/api";

export default async function TreatmentCasesPage() {
  const cases = await listRecentCases(50);
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "เคสการรักษา" }]} />
      <h1 className="mb-4 text-2xl font-bold">เคสการรักษา (Cases)</h1>
      {cases.length === 0 ? (
        <EmptyState message="No cases yet." />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <p className="mt-1">{c.symptoms}</p>
              <Link href={`/remedies/${c.remedyId}`} className="text-sm text-stone-700 underline">
                ดูตำรับยา (view remedy) →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Rework the remedy detail page** `src/app/remedies/[remedyId]/page.tsx` — replace the `ตัวยา` free-text line with a linked herb list, and show the healer as context:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DefinitionList } from "@/components/DefinitionList";
import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { getRemedy, listCasesByRemedy } from "@/lib/api";

export default async function RemedyPage({ params }: { params: Promise<{ remedyId: string }> }) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();
  const cases = await listCasesByRemedy(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Healer", href: `/healers/${remedy.healerId}` },
          { label: remedy.name },
        ]}
      />
      <h1 className="mb-4 text-2xl font-bold">{remedy.name}</h1>

      <h2 className="mb-2 text-lg font-semibold">ตัวยา (Herbs)</h2>
      {remedy.herbs.length === 0 ? (
        <p className="text-stone-500">—</p>
      ) : (
        <ul className="mb-6 grid gap-2">
          {remedy.herbs.map((h) => (
            <li key={h.herbId}>
              <Link href={`/herbs/${h.herbId}`} className="text-stone-800 underline">
                {h.nameThai}
              </Link>
              {h.amount ? <span className="text-stone-500"> · {h.amount}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <DefinitionList
        items={[
          { term: "สรรพคุณ", value: remedy.symptoms },
          { term: "วิธีปรุง", value: remedy.preparationMethod },
          { term: "วิธีใช้", value: remedy.usage },
          { term: "หมายเหตุ", value: remedy.note },
        ]}
      />

      <h2 className="mb-3 mt-8 text-xl font-semibold">Treatment cases (เคสการรักษา)</h2>
      {cases.length === 0 ? (
        <EmptyState message="No treatment cases recorded for this remedy yet." />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <DefinitionList
                items={[
                  { term: "อาการ", value: c.symptoms },
                  { term: "ผลการรักษา", value: c.result },
                  { term: "หมายเหตุ", value: c.note },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Add the herb group to search** `src/app/search/page.tsx` — after the healers block, add:

```tsx
      {result !== null && result.herbs.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">สมุนไพร (Herbs)</h2>
          <div className="grid gap-3">
            {result.herbs.map((h) => (
              <RecordCard
                key={h.id}
                href={`/herbs/${h.id}`}
                title={h.nameThai}
                subtitle={h.nameEnglish || h.scientificName}
              />
            ))}
          </div>
        </div>
      ) : null}
```

Also update the `empty` computation to include herbs:

```tsx
  const empty =
    result !== null &&
    result.remedies.length === 0 &&
    result.healers.length === 0 &&
    result.herbs.length === 0;
```

- [ ] **Step 8: Build to verify + commit**

Run: `cd frontend && pnpm lint && pnpm build`
Expected: clean build (this compiles types too; requires Task 8 done).

```bash
git add frontend/src/app/page.tsx frontend/src/app/districts/page.tsx frontend/src/app/herbs frontend/src/app/remedies/page.tsx frontend/src/app/treatment-cases frontend/src/app/remedies/[remedyId]/page.tsx frontend/src/app/search/page.tsx
git commit -m "feat(frontend): remedy/herb-first home, herb pages, remedy detail rework"
```

---

## Task 10: Frontend staff — herb CRUD + herb picker in remedy form

**Files:**
- Create: `src/lib/herb-schema.ts`
- Create: `src/components/HerbForm.tsx` (+ `.test.tsx`)
- Create: `src/components/HerbAdminList.tsx`
- Create: `src/components/HerbPicker.tsx` (+ `.test.tsx`)
- Create: `src/app/staff/herbs/page.tsx`, `new/page.tsx`, `[herbId]/edit/page.tsx`
- Create: `src/app/bff/herbs/route.ts`, `src/app/bff/herbs/[herbId]/route.ts`
- Modify: `src/lib/remedy-schema.ts`, `src/components/RemedyForm.tsx`
- Modify: `src/app/staff/layout.tsx` (or the staff dashboard) to link to `/staff/herbs`

**Interfaces:**
- `herbSchema` (zod) → `HerbInput { nameThai; nameEnglish; scientificName; properties; description }`.
- `remedySchema` drops `ingredients`, adds `herbs: { herbId: number; amount: string }[]`.
- `HerbPicker` props: `{ value: {herbId:number;amount:string}[]; onChange: (v) => void }`; loads herb options via `fetchHerbs`.

- [ ] **Step 1: Write the herb schema** `src/lib/herb-schema.ts`:

```ts
import { z } from "zod";

export const herbSchema = z.object({
  nameThai: z.string().min(1, "Thai name is required"),
  nameEnglish: z.string(),
  scientificName: z.string(),
  properties: z.string(),
  description: z.string(),
});

export type HerbInput = z.infer<typeof herbSchema>;
```

- [ ] **Step 2: Write the failing HerbForm test** `src/components/HerbForm.test.tsx` (mirror `RemedyForm.test.tsx`):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { HerbForm } from "./HerbForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HerbForm (create)", () => {
  it("requires the Thai name", async () => {
    renderWithClient(<HerbForm />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/thai name is required/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/components/HerbForm.test.tsx`
Expected: FAIL — `HerbForm` not found.

- [ ] **Step 4: Write `HerbForm.tsx`** (mirror `HealerForm.tsx`, fields = herb):

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Herb } from "@/lib/api-types";
import { herbSchema, type HerbInput } from "@/lib/herb-schema";
import { createHerb, herbListKey, updateHerb } from "@/lib/staff-queries";

export function HerbForm({ herb }: { herb?: Herb }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HerbInput>({
    resolver: zodResolver(herbSchema),
    defaultValues: {
      nameThai: herb?.nameThai ?? "",
      nameEnglish: herb?.nameEnglish ?? "",
      scientificName: herb?.scientificName ?? "",
      properties: herb?.properties ?? "",
      description: herb?.description ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: HerbInput) => (herb ? updateHerb(herb.id, values) : createHerb(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: herbListKey });
      router.push("/staff/herbs");
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="nameThai" className="text-sm font-medium">ชื่อไทย (Thai name)</label>
        <input id="nameThai" className={field} {...register("nameThai")} />
        {errors.nameThai ? <p className="text-sm text-red-600">{errors.nameThai.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="nameEnglish" className="text-sm font-medium">English name</label>
        <input id="nameEnglish" className={field} {...register("nameEnglish")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="scientificName" className="text-sm font-medium">ชื่อวิทยาศาสตร์ (Scientific name)</label>
        <input id="scientificName" className={field} {...register("scientificName")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="properties" className="text-sm font-medium">สรรพคุณ (Properties)</label>
        <textarea id="properties" rows={3} className={field} {...register("properties")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">รายละเอียด (Description)</label>
        <textarea id="description" rows={3} className={field} {...register("description")} />
      </div>
      {save.isError ? <p className="text-sm text-red-600">Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={() => router.push("/staff/herbs")} className="rounded border border-stone-300 px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/components/HerbForm.test.tsx`
Expected: PASS.

- [ ] **Step 6: Write `HerbAdminList.tsx`** (mirror `HealerAdminList.tsx`, no districtId; links to new/edit; delete surfaces 409 as "herb is used by remedies"):

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteHerb, fetchHerbs, herbListKey } from "@/lib/staff-queries";

export function HerbAdminList() {
  const queryClient = useQueryClient();
  const { data: herbs, isLoading, isError } = useQuery({ queryKey: herbListKey, queryFn: fetchHerbs });
  const remove = useMutation({
    mutationFn: deleteHerb,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: herbListKey }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load herbs.</p>;

  return (
    <div className="space-y-4">
      {remove.isError ? <p className="text-red-600">Could not delete. This herb may still be used by remedies.</p> : null}
      <Link href="/staff/herbs/new" className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white">+ New herb</Link>
      {!herbs || herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {herbs.map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{h.nameThai}</p>
                {h.nameEnglish ? <p className="text-sm text-stone-500">{h.nameEnglish}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/staff/herbs/${h.id}/edit`} className="text-stone-700 underline">Edit</Link>
                <button type="button" onClick={() => remove.mutate(h.id)} disabled={remove.isPending} className="text-red-600 underline disabled:opacity-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write the staff herb pages**

`src/app/staff/herbs/page.tsx`:

```tsx
import { HerbAdminList } from "@/components/HerbAdminList";

export default function StaffHerbsPage() {
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Herbs (สมุนไพร)</h1>
      <HerbAdminList />
    </section>
  );
}
```

`src/app/staff/herbs/new/page.tsx`:

```tsx
import { HerbForm } from "@/components/HerbForm";

export default function NewHerbPage() {
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New herb</h1>
      <HerbForm />
    </section>
  );
}
```

`src/app/staff/herbs/[herbId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { HerbForm } from "@/components/HerbForm";
import { PhotoManager } from "@/components/PhotoManager";
import { getHerb } from "@/lib/api";

export default async function EditHerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const herb = await getHerb(id);
  if (!herb) notFound();
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit herb</h1>
      <HerbForm herb={herb} />
      <div className="mt-8">
        <PhotoManager ownerType="herb" ownerId={herb.id} />
      </div>
    </section>
  );
}
```

> `PhotoManager` accepts `ownerType: string` (confirm from its props). The backend now accepts `"herb"` (Task 1). If `PhotoManager`'s prop type is a union, add `"herb"` to it.

- [ ] **Step 8: Write the BFF herb routes** (mirror `bff/healers`):

`src/app/bff/herbs/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("POST", "/herbs", token, body);
  return NextResponse.json(data ?? {}, { status });
}
```

`src/app/bff/herbs/[herbId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function PUT(request: Request, { params }: { params: Promise<{ herbId: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const { herbId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/herbs/${herbId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ herbId: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const { herbId } = await params;
  const { status, data } = await bffForward("DELETE", `/herbs/${herbId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 9: Update the remedy schema + form for the herb picker**

- `src/lib/remedy-schema.ts`:

```ts
import { z } from "zod";

export const remedySchema = z.object({
  name: z.string().min(1, "Name is required"),
  symptoms: z.string(),
  preparationMethod: z.string(),
  usage: z.string(),
  note: z.string(),
  herbs: z.array(z.object({ herbId: z.number().int().positive(), amount: z.string() })),
});

export type RemedyInput = z.infer<typeof remedySchema>;
```

- Write the failing `HerbPicker.test.tsx` (renders options from a stubbed `fetchHerbs`, lets you add a herb row):

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/staff-queries", () => ({
  fetchHerbs: vi.fn(async () => [{ id: 1, nameThai: "ขิง", nameEnglish: "Ginger", scientificName: "", properties: "", description: "", createdAt: "", updatedAt: "" }]),
}));

import { HerbPicker } from "./HerbPicker";

afterEach(() => vi.clearAllMocks());

describe("HerbPicker", () => {
  it("shows the herb options", async () => {
    render(<HerbPicker value={[]} onChange={() => {}} />);
    expect(await screen.findByText(/ขิง/)).toBeInTheDocument();
  });
});
```

- Implement `src/components/HerbPicker.tsx` — a controlled list of {herbId, amount} rows with a select of herbs and an amount input, plus add/remove. Uses TanStack Query `useQuery` to load herbs:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchHerbs, herbListKey } from "@/lib/staff-queries";

type Link = { herbId: number; amount: string };

export function HerbPicker({ value, onChange }: { value: Link[]; onChange: (v: Link[]) => void }) {
  const { data: herbs } = useQuery({ queryKey: herbListKey, queryFn: fetchHerbs });

  const setRow = (i: number, patch: Partial<Link>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => onChange([...value, { herbId: herbs?.[0]?.id ?? 0, amount: "" }]);
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">ตัวยา (Herbs)</p>
      {value.map((row, i) => (
        <div key={i} className="flex gap-2">
          <select
            className="rounded border border-stone-300 p-2"
            value={row.herbId}
            onChange={(e) => setRow(i, { herbId: Number(e.target.value) })}
          >
            {(herbs ?? []).map((h) => (
              <option key={h.id} value={h.id}>{h.nameThai}</option>
            ))}
          </select>
          <input
            className="flex-1 rounded border border-stone-300 p-2"
            placeholder="ปริมาณ (amount)"
            value={row.amount}
            onChange={(e) => setRow(i, { amount: e.target.value })}
          />
          <button type="button" onClick={() => removeRow(i)} className="text-red-600 underline text-sm">remove</button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="rounded border border-stone-300 px-3 py-1 text-sm">+ add herb</button>
    </div>
  );
}
```

- Update `src/components/RemedyForm.tsx`:
  - Remove the ingredients `<textarea>`.
  - Manage `herbs` via `useState` (or `useController`) seeded from `remedy?.herbs?.map(h => ({herbId: h.herbId, amount: h.amount})) ?? []`, render `<HerbPicker value={herbs} onChange={setHerbs} />`, and include `herbs` in the mutation payload:

```tsx
  const [herbs, setHerbs] = useState<{ herbId: number; amount: string }[]>(
    remedy?.herbs?.map((h) => ({ herbId: h.herbId, amount: h.amount })) ?? [],
  );
  // in onSubmit / mutationFn, pass { ...values, herbs } (and healerId on create)
```

  Keep the rest (name/symptoms/preparation/usage/note) unchanged. `createRemedy`/`updateRemedy` payloads now carry `herbs`.

- [ ] **Step 10: Add a staff dashboard link to Herbs**

In `src/app/staff/layout.tsx` (or the staff dashboard page), add a nav link `<Link href="/staff/herbs">Herbs</Link>` next to the existing staff nav.

- [ ] **Step 11: Run the full frontend suite + build**

Run: `cd frontend && pnpm lint && pnpm vitest run && pnpm build`
Expected: all tests pass, build clean.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/lib/herb-schema.ts frontend/src/lib/remedy-schema.ts frontend/src/components/HerbForm.tsx frontend/src/components/HerbForm.test.tsx frontend/src/components/HerbAdminList.tsx frontend/src/components/HerbPicker.tsx frontend/src/components/HerbPicker.test.tsx frontend/src/components/RemedyForm.tsx frontend/src/app/staff/herbs frontend/src/app/bff/herbs frontend/src/app/staff/layout.tsx
git commit -m "feat(frontend): staff herb CRUD and remedy herb picker"
```

---

## Task 11: End-to-end verification, docs, reseed

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Full stack up + reseed**

```bash
cd /home/foo/thai-folk-medicine && docker compose up -d --build
docker compose --profile seed run --rm seed -reset
```

Expected: seed logs herbs + remedies + links; no errors.

- [ ] **Step 2: Smoke-check the API + pages**

```bash
docker compose exec -T postgres psql -U folk -d folk_medicine -c "SELECT (SELECT count(*) FROM herb) herbs, (SELECT count(*) FROM remedy_herb) links;"
curl -s -o /dev/null -w "home %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "herbs %{http_code}\n" http://localhost:3000/herbs
```

Expected: herbs = 12, links > 0, both pages 200. Optionally open a herb profile and confirm remedies list.

- [ ] **Step 3: Update `CONTEXT.md`**

Add a "Plan 10 — herb + remedy focus" section describing: the herb aggregate + `remedy_herb` link, `ingredients` dropped, new endpoints (`/herbs`, `/herbs/{id}/remedies`, `/remedies`, `/treatment-cases`), search herb group, the remedy/herb-first home, staff herb CRUD + herb picker, photo owner type `herb`, and the reseed step. Update the domain-model line to `Herb ↔ Remedy (many-to-many)` and the backend/frontend layout trees to include the new files.

- [ ] **Step 4: Final full test sweep**

```bash
cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...
cd ../frontend && pnpm lint && pnpm vitest run && pnpm build
```

Expected: all green.

- [ ] **Step 5: Commit + tear down**

```bash
git add CONTEXT.md
git commit -m "docs: record herb + remedy focus (Plan 10)"
cd /home/foo/thai-folk-medicine && docker compose down
```

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- Herb entity (rich fields) → Tasks 1–3. ✓
- `remedy_herb` join + drop `ingredients` → Task 4. ✓
- Remedy write owns links transactionally → Task 4 Step 8. ✓
- Recent-list endpoints for home → Task 5. ✓
- Search herb group + herb-name match + drop ingredients → Tasks 4 (query) + 6. ✓
- Photo owner type `herb` → Task 1 Step 3. ✓
- Public home (search → Herbs → Remedies → Cases + district link) → Task 9 Step 1. ✓
- `/herbs`, `/herbs/[id]`, `/remedies`, `/treatment-cases`, remedy detail rework, district demotion → Task 9. ✓
- Staff herb CRUD + herb picker → Task 10. ✓
- Seed rework + reseed → Tasks 7 + 11. ✓
- Events for herb → Task 3 Step 4. ✓

**Type consistency:** `herb.Herb`/`CreateParams`/`UpdateParams`, `remedy.HerbRef`/`HerbLink`, DTO JSON keys (`herbs`, `herbId`, `nameThai`, …), and frontend `Herb`/`RemedyHerb`/`HerbSearchResult` are used identically across tasks. `NewRemedy(pool)` is introduced in Task 4 and consumed in Tasks 5–7 wiring. `ListRecent`/`ListByHerb` are added to the `remedy.Repository` interface (Tasks 4–5) before use.

**Placeholder scan:** No TBD/TODO; every code step has real content. Steps that must match existing test helpers explicitly say to read the sibling test file first (helper names are environment-specific and cannot be invented safely).

# Search by Symptom or Herb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one public search box that finds remedies (by name, symptoms, ingredients) and healers (by name, specialty, biography, sub-district), matching Thai text well.

**Architecture:** Postgres `pg_trgm` trigram matching (language-agnostic, good for Thai) behind a new `usecase/search` service that composes two Postgres repository search methods, exposed at `GET /api/v1/search`. The Next.js frontend adds a server-rendered `/search` page plus a header search box.

**Tech Stack:** Go 1.26.5, Gin, sqlc (pgx/v5), golang-migrate, testcontainers-go; Next.js App Router, TypeScript, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-search-symptom-herb-design.md`

## Global Constraints

- **TDD mandatory:** failing test → confirm fail → minimal code → confirm pass → refactor.
- **Clean Architecture:** dependency rule `domain ← usecase ← adapter/platform`. Search is read-only — it publishes **no** events.
- **Full-English route + parameter names:** route is `/api/v1/search`, query parameter is `searchTerm`.
- **Consumer-defined interfaces:** the search reader interfaces live in `usecase/search`, NOT on the aggregate `Repository` interfaces (this keeps existing repo fakes untouched). This is a deliberate refinement of the spec's "add to Repository interface" wording.
- **Minimum term length is 2 runes**, measured with `utf8.RuneCountInString` (NOT `len`, which counts bytes — a single Thai character is 3 bytes).
- **Module path:** `github.com/willywotz/thai-folk-medicine/backend`.
- **Backend tests need** `TESTCONTAINERS_RYUK_DISABLED=true` on this host.
- Go style: uber-go. TS/HTML/CSS style: Google.

---

## File Structure

**Backend**
- `backend/migrations/000008_add_search_index.up.sql` / `.down.sql` — create — pg_trgm extension + GIN trigram indexes.
- `backend/internal/adapter/repository/query/remedy.sql` — modify — add `SearchRemedy`.
- `backend/internal/adapter/repository/query/healer.sql` — modify — add `SearchHealer`.
- `backend/internal/adapter/repository/db/*` — regenerate via `sqlc generate`.
- `backend/internal/domain/remedy/remedy.go` — modify — add `SearchResult` type.
- `backend/internal/adapter/repository/remedy_repository.go` — modify — add `Search` method.
- `backend/internal/adapter/repository/healer_repository.go` — modify — add `Search` method.
- `backend/internal/adapter/repository/search_repository_test.go` — create — integration tests.
- `backend/internal/usecase/search/service.go` — create — reader interfaces + `Service`.
- `backend/internal/usecase/search/service_test.go` — create — unit tests with fakes.
- `backend/internal/adapter/http/search_handler.go` — create — handler + DTOs + route.
- `backend/internal/adapter/http/search_handler_test.go` — create — handler tests.
- `backend/cmd/api/main.go` — modify — wire the search handler.

**Frontend**
- `frontend/src/lib/api-types.ts` — modify — add search result types.
- `frontend/src/lib/api.ts` — modify — add `search()`.
- `frontend/src/lib/api.test.ts` — modify — add `search()` test.
- `frontend/src/components/SearchBox.tsx` — create — the search form.
- `frontend/src/components/SearchBox.test.tsx` — create — component test.
- `frontend/src/app/search/page.tsx` — create — results page (RSC).
- `frontend/src/app/layout.tsx` — modify — mount the header search box.

---

### Task 1: Postgres trigram search (migration + queries + repository)

**Files:**
- Create: `backend/migrations/000008_add_search_index.up.sql`, `backend/migrations/000008_add_search_index.down.sql`
- Modify: `backend/internal/adapter/repository/query/remedy.sql`, `backend/internal/adapter/repository/query/healer.sql`
- Modify: `backend/internal/domain/remedy/remedy.go` (add `SearchResult`)
- Modify: `backend/internal/adapter/repository/remedy_repository.go`, `backend/internal/adapter/repository/healer_repository.go`
- Regenerate: `backend/internal/adapter/repository/db/*` (`sqlc generate`)
- Test: `backend/internal/adapter/repository/search_repository_test.go`

**Interfaces:**
- Produces:
  - `remedy.SearchResult{ ID int64; Name, Symptoms, Ingredients string; HealerID int64; HealerFullName string }`
  - `func (r *Remedy) Search(ctx context.Context, term string) ([]remedy.SearchResult, error)`
  - `func (r *Healer) Search(ctx context.Context, term string) ([]healer.Healer, error)`

- [ ] **Step 1: Write the migration files**

`backend/migrations/000008_add_search_index.up.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX remedy_name_trgm ON remedy USING gin (name gin_trgm_ops);
CREATE INDEX remedy_symptoms_trgm ON remedy USING gin (symptoms gin_trgm_ops);
CREATE INDEX remedy_ingredients_trgm ON remedy USING gin (ingredients gin_trgm_ops);
CREATE INDEX healer_full_name_trgm ON healer USING gin (full_name gin_trgm_ops);
CREATE INDEX healer_specialty_trgm ON healer USING gin (specialty gin_trgm_ops);
CREATE INDEX healer_biography_trgm ON healer USING gin (biography gin_trgm_ops);
CREATE INDEX healer_sub_district_trgm ON healer USING gin (sub_district gin_trgm_ops);
```

`backend/migrations/000008_add_search_index.down.sql`:

```sql
DROP INDEX IF EXISTS healer_sub_district_trgm;
DROP INDEX IF EXISTS healer_biography_trgm;
DROP INDEX IF EXISTS healer_specialty_trgm;
DROP INDEX IF EXISTS healer_full_name_trgm;
DROP INDEX IF EXISTS remedy_ingredients_trgm;
DROP INDEX IF EXISTS remedy_symptoms_trgm;
DROP INDEX IF EXISTS remedy_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
```

- [ ] **Step 2: Add the sqlc queries**

Append to `backend/internal/adapter/repository/query/remedy.sql`:

```sql
-- name: SearchRemedy :many
SELECT r.id, r.name, r.symptoms, r.ingredients, r.healer_id, h.full_name AS healer_full_name
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE r.name ILIKE '%' || @search_term::text || '%'
   OR r.symptoms ILIKE '%' || @search_term::text || '%'
   OR r.ingredients ILIKE '%' || @search_term::text || '%'
ORDER BY GREATEST(
    similarity(r.name, @search_term::text),
    similarity(r.symptoms, @search_term::text),
    similarity(r.ingredients, @search_term::text)
) DESC, r.name;
```

Append to `backend/internal/adapter/repository/query/healer.sql`:

```sql
-- name: SearchHealer :many
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE full_name ILIKE '%' || @search_term::text || '%'
   OR specialty ILIKE '%' || @search_term::text || '%'
   OR biography ILIKE '%' || @search_term::text || '%'
   OR sub_district ILIKE '%' || @search_term::text || '%'
ORDER BY GREATEST(
    similarity(full_name, @search_term::text),
    similarity(specialty, @search_term::text),
    similarity(biography, @search_term::text),
    similarity(sub_district, @search_term::text)
) DESC, full_name;
```

Note: `@search_term::text` reused in each query compiles to a single Go parameter `SearchTerm string`.

- [ ] **Step 3: Regenerate sqlc code**

Run (from `backend/`): `sqlc generate`
Expected: `internal/adapter/repository/db/remedy.sql.go` gains `SearchRemedy` + `SearchRemedyRow`; `healer.sql.go` gains `SearchHealer` returning `[]Healer`. No errors.

- [ ] **Step 4: Add the `SearchResult` domain type**

In `backend/internal/domain/remedy/remedy.go`, after the `Remedy` struct:

```go
// SearchResult is a remedy match with its healer's name, for search listings.
type SearchResult struct {
	ID             int64
	Name           string
	Symptoms       string
	Ingredients    string
	HealerID       int64
	HealerFullName string
}
```

- [ ] **Step 5: Write the failing integration test**

Create `backend/internal/adapter/repository/search_repository_test.go`:

```go
package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

func TestSearchRemedyMatchesThaiSubstring(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerID := makeHealer(t, ctx, NewHealer(queries), districtID)
	remedyRepo := NewRemedy(queries)
	_, err := remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาแก้ไข้", Symptoms: "ไข้สูง", Ingredients: "ฟ้าทะลายโจร",
	})
	require.NoError(t, err)
	_, err = remedyRepo.Create(ctx, remedy.CreateParams{
		HealerID: healerID, Name: "ยาแก้ปวด", Symptoms: "ปวดหัว", Ingredients: "ขิง",
	})
	require.NoError(t, err)

	got, err := remedyRepo.Search(ctx, "ฟ้าทะลายโจร")

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "ยาแก้ไข้", got[0].Name)
	assert.Equal(t, "หมอทดสอบ", got[0].HealerFullName)
}

func TestSearchHealerMatchesSpecialty(t *testing.T) {
	ctx, queries := newTestPool(t)
	districtID := firstDistrictID(t, ctx, NewLocation(queries))
	healerRepo := NewHealer(queries)
	makeHealer(t, ctx, healerRepo, districtID) // "หมอทดสอบ", empty specialty

	got, err := healerRepo.Search(ctx, "หมอทดสอบ")

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "หมอทดสอบ", got[0].FullName)
}

func TestSearchRemedyNoMatchReturnsEmpty(t *testing.T) {
	ctx, queries := newTestPool(t)
	got, err := NewRemedy(queries).Search(ctx, "ไม่มีอยู่จริง")
	require.NoError(t, err)
	assert.Empty(t, got)
}
```

- [ ] **Step 6: Run the test to confirm it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestSearch -v`
Expected: FAIL — `Search` is not defined on `*Remedy` / `*Healer`.

- [ ] **Step 7: Implement the repository `Search` methods**

In `backend/internal/adapter/repository/remedy_repository.go`, add:

```go
// Search returns remedies whose name, symptoms, or ingredients match the term.
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
			Ingredients:    row.Ingredients,
			HealerID:       row.HealerID,
			HealerFullName: row.HealerFullName,
		})
	}
	return result, nil
}
```

In `backend/internal/adapter/repository/healer_repository.go`, add:

```go
// Search returns healers whose name, specialty, biography, or sub-district match the term.
func (r *Healer) Search(ctx context.Context, term string) ([]healer.Healer, error) {
	rows, err := r.q.SearchHealer(ctx, term)
	if err != nil {
		return nil, err
	}
	result := make([]healer.Healer, 0, len(rows))
	for _, row := range rows {
		result = append(result, toHealer(row))
	}
	return result, nil
}
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run TestSearch -v`
Expected: PASS (all three).

- [ ] **Step 9: Run build/format/vet**

Run: `cd backend && gofmt -l . && go vet ./... && go build ./...`
Expected: no output from gofmt, no vet errors, clean build.

- [ ] **Step 10: Commit**

```bash
git add backend/migrations backend/internal/adapter/repository backend/internal/domain/remedy/remedy.go
git commit -m "feat(search): add pg_trgm search migration, queries, and repositories"
```

---

### Task 2: Search use case service

**Files:**
- Create: `backend/internal/usecase/search/service.go`
- Test: `backend/internal/usecase/search/service_test.go`

**Interfaces:**
- Consumes: `remedy.SearchResult`, `healer.Healer` (Task 1).
- Produces:
  - `search.RemedyReader interface { Search(ctx context.Context, term string) ([]remedy.SearchResult, error) }`
  - `search.HealerReader interface { Search(ctx context.Context, term string) ([]healer.Healer, error) }`
  - `search.Result{ Remedies []remedy.SearchResult; Healers []healer.Healer }`
  - `search.ErrTermTooShort` (exported error)
  - `func NewService(remedyReader RemedyReader, healerReader HealerReader) *Service`
  - `func (s *Service) Search(ctx context.Context, term string) (Result, error)`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/usecase/search/service_test.go`:

```go
package search

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

type fakeRemedyReader struct {
	term string
	out  []remedy.SearchResult
}

func (f *fakeRemedyReader) Search(_ context.Context, term string) ([]remedy.SearchResult, error) {
	f.term = term
	return f.out, nil
}

type fakeHealerReader struct {
	out []healer.Healer
}

func (f *fakeHealerReader) Search(context.Context, string) ([]healer.Healer, error) {
	return f.out, nil
}

func TestSearchCombinesBothReaders(t *testing.T) {
	rr := &fakeRemedyReader{out: []remedy.SearchResult{{ID: 1, Name: "ยา"}}}
	hr := &fakeHealerReader{out: []healer.Healer{{ID: 2, FullName: "หมอ"}}}
	service := NewService(rr, hr)

	got, err := service.Search(context.Background(), "  ยา  ")

	require.NoError(t, err)
	assert.Equal(t, "ยา", rr.term) // trimmed before the query
	require.Len(t, got.Remedies, 1)
	require.Len(t, got.Healers, 1)
	assert.Equal(t, int64(1), got.Remedies[0].ID)
	assert.Equal(t, int64(2), got.Healers[0].ID)
}

func TestSearchRejectsShortTerm(t *testing.T) {
	service := NewService(&fakeRemedyReader{}, &fakeHealerReader{})

	_, err := service.Search(context.Background(), "ก") // 1 rune

	assert.ErrorIs(t, err, ErrTermTooShort)
}
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd backend && go test ./internal/usecase/search/ -v`
Expected: FAIL — package `search` has no `NewService`.

- [ ] **Step 3: Implement the service**

Create `backend/internal/usecase/search/service.go`:

```go
// Package search composes remedy and healer text search into one result.
package search

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// ErrTermTooShort means the search term has fewer than two characters.
var ErrTermTooShort = errors.New("search term too short")

// RemedyReader searches remedies by free text.
type RemedyReader interface {
	Search(ctx context.Context, term string) ([]remedy.SearchResult, error)
}

// HealerReader searches healers by free text.
type HealerReader interface {
	Search(ctx context.Context, term string) ([]healer.Healer, error)
}

// Result holds the remedy and healer matches for one search.
type Result struct {
	Remedies []remedy.SearchResult
	Healers  []healer.Healer
}

// Service runs a search across remedies and healers.
type Service struct {
	remedyReader RemedyReader
	healerReader HealerReader
}

// NewService builds the search service.
func NewService(remedyReader RemedyReader, healerReader HealerReader) *Service {
	return &Service{remedyReader: remedyReader, healerReader: healerReader}
}

// Search returns remedy and healer matches for a term of at least two runes.
func (s *Service) Search(ctx context.Context, term string) (Result, error) {
	term = strings.TrimSpace(term)
	if utf8.RuneCountInString(term) < 2 {
		return Result{}, ErrTermTooShort
	}
	remedies, err := s.remedyReader.Search(ctx, term)
	if err != nil {
		return Result{}, err
	}
	healers, err := s.healerReader.Search(ctx, term)
	if err != nil {
		return Result{}, err
	}
	return Result{Remedies: remedies, Healers: healers}, nil
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd backend && go test ./internal/usecase/search/ -v`
Expected: PASS (both).

- [ ] **Step 5: Format/vet/build**

Run: `cd backend && gofmt -l . && go vet ./... && go build ./...`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/usecase/search
git commit -m "feat(search): add search use-case service"
```

---

### Task 3: HTTP search endpoint + wiring

**Files:**
- Create: `backend/internal/adapter/http/search_handler.go`
- Test: `backend/internal/adapter/http/search_handler_test.go`
- Modify: `backend/cmd/api/main.go`

**Interfaces:**
- Consumes: `search.NewService`, `search.ErrTermTooShort`, `search.Result`, `repository.NewRemedy`, `repository.NewHealer`.
- Produces:
  - `func NewSearchHandler(service *search.Service) *SearchHandler`
  - route `GET /api/v1/search?searchTerm=<q>`
  - JSON body `{ "remedies": [{id,name,symptoms,ingredients,healerId,healerFullName}], "healers": [{id,fullName,specialty,subDistrict,districtId}] }`

- [ ] **Step 1: Write the failing handler test**

Create `backend/internal/adapter/http/search_handler_test.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

type stubRemedyReader struct{ out []remedy.SearchResult }

func (s stubRemedyReader) Search(context.Context, string) ([]remedy.SearchResult, error) {
	return s.out, nil
}

type stubHealerReader struct{ out []healer.Healer }

func (s stubHealerReader) Search(context.Context, string) ([]healer.Healer, error) {
	return s.out, nil
}

func newSearchRouter(rr search.RemedyReader, hr search.HealerReader) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	NewSearchHandler(search.NewService(rr, hr)).RegisterRoutes(public, protected)
	return r
}

func TestSearchEndpointReturnsMatches(t *testing.T) {
	r := newSearchRouter(
		stubRemedyReader{out: []remedy.SearchResult{{ID: 1, Name: "ยาแก้ไข้", HealerID: 2, HealerFullName: "หมอ"}}},
		stubHealerReader{out: []healer.Healer{{ID: 2, FullName: "หมอ", DistrictID: 3}}},
	)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ยา", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Remedies []struct {
			ID             int64  `json:"id"`
			Name           string `json:"name"`
			HealerFullName string `json:"healerFullName"`
		} `json:"remedies"`
		Healers []struct {
			ID         int64 `json:"id"`
			DistrictID int64 `json:"districtId"`
		} `json:"healers"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Remedies, 1)
	assert.Equal(t, "หมอ", body.Remedies[0].HealerFullName)
	require.Len(t, body.Healers, 1)
	assert.Equal(t, int64(3), body.Healers[0].DistrictID)
}

func TestSearchEndpointRejectsShortTerm(t *testing.T) {
	r := newSearchRouter(stubRemedyReader{}, stubHealerReader{})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ก", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
```

Note: add `"context"` to the import block (used by the stubs).

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd backend && go test ./internal/adapter/http/ -run TestSearchEndpoint -v`
Expected: FAIL — `NewSearchHandler` undefined.

- [ ] **Step 3: Implement the handler**

Create `backend/internal/adapter/http/search_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

// SearchHandler serves the public search endpoint.
type SearchHandler struct {
	service *search.Service
}

// NewSearchHandler builds the search handler.
func NewSearchHandler(service *search.Service) *SearchHandler {
	return &SearchHandler{service: service}
}

// RegisterRoutes mounts the public search route.
func (h *SearchHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.GET("/search", h.Search)
}

type remedyMatchDTO struct {
	ID             int64  `json:"id"`
	Name           string `json:"name"`
	Symptoms       string `json:"symptoms"`
	Ingredients    string `json:"ingredients"`
	HealerID       int64  `json:"healerId"`
	HealerFullName string `json:"healerFullName"`
}

type healerMatchDTO struct {
	ID          int64  `json:"id"`
	FullName    string `json:"fullName"`
	Specialty   string `json:"specialty"`
	SubDistrict string `json:"subDistrict"`
	DistrictID  int64  `json:"districtId"`
}

type searchResponseDTO struct {
	Remedies []remedyMatchDTO `json:"remedies"`
	Healers  []healerMatchDTO `json:"healers"`
}

func toRemedyMatchDTO(r remedy.SearchResult) remedyMatchDTO {
	return remedyMatchDTO{
		ID:             r.ID,
		Name:           r.Name,
		Symptoms:       r.Symptoms,
		Ingredients:    r.Ingredients,
		HealerID:       r.HealerID,
		HealerFullName: r.HealerFullName,
	}
}

func toHealerMatchDTO(h healer.Healer) healerMatchDTO {
	return healerMatchDTO{
		ID:          h.ID,
		FullName:    h.FullName,
		Specialty:   h.Specialty,
		SubDistrict: h.SubDistrict,
		DistrictID:  h.DistrictID,
	}
}

// Search handles GET /api/v1/search.
func (h *SearchHandler) Search(c *gin.Context) {
	result, err := h.service.Search(c.Request.Context(), c.Query("searchTerm"))
	if err != nil {
		if errors.Is(err, search.ErrTermTooShort) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "search term must be at least two characters"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot run search"})
		return
	}
	out := searchResponseDTO{
		Remedies: make([]remedyMatchDTO, 0, len(result.Remedies)),
		Healers:  make([]healerMatchDTO, 0, len(result.Healers)),
	}
	for _, r := range result.Remedies {
		out.Remedies = append(out.Remedies, toRemedyMatchDTO(r))
	}
	for _, hh := range result.Healers {
		out.Healers = append(out.Healers, toHealerMatchDTO(hh))
	}
	c.JSON(http.StatusOK, out)
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd backend && go test ./internal/adapter/http/ -run TestSearchEndpoint -v`
Expected: PASS (both).

- [ ] **Step 5: Wire the handler in main**

In `backend/cmd/api/main.go`, add the import `"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"`, then near the other handler construction (after `photoHandler`):

```go
	searchHandler := httpapi.NewSearchHandler(
		search.NewService(repository.NewRemedy(queries), repository.NewHealer(queries)),
	)
```

Add `searchHandler` to the `httpapi.NewRouter(...)` argument list:

```go
	router := httpapi.NewRouter(authMiddleware, authHandler, locationHandler, healerHandler, remedyHandler, treatmentCaseHandler, photoHandler, searchHandler)
```

- [ ] **Step 6: Full backend gate**

Run: `cd backend && gofmt -l . && go vet ./... && go build ./... && go mod tidy`
Expected: clean, no diff to go.mod/go.sum.
Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/adapter/http/search_handler.go backend/internal/adapter/http/search_handler_test.go backend/cmd/api/main.go
git commit -m "feat(search): add GET /api/v1/search endpoint and wire it"
```

---

### Task 4: Frontend search client

**Files:**
- Modify: `frontend/src/lib/api-types.ts`, `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `RemedySearchResult { id; name; symptoms; ingredients; healerId; healerFullName }`
  - `HealerSearchResult { id; fullName; specialty; subDistrict; districtId }`
  - `SearchResponse { remedies: RemedySearchResult[]; healers: HealerSearchResult[] }`
  - `search(term: string): Promise<SearchResponse>`

- [ ] **Step 1: Add the result types**

Append to `frontend/src/lib/api-types.ts`:

```ts
export interface RemedySearchResult {
  id: number;
  name: string;
  symptoms: string;
  ingredients: string;
  healerId: number;
  healerFullName: string;
}

export interface HealerSearchResult {
  id: number;
  fullName: string;
  specialty: string;
  subDistrict: string;
  districtId: number;
}

export interface SearchResponse {
  remedies: RemedySearchResult[];
  healers: HealerSearchResult[];
}
```

- [ ] **Step 2: Write the failing client test**

Append to `frontend/src/lib/api.test.ts` (add `search` to the import from `./api`):

```ts
describe("search", () => {
  it("encodes the term and returns the parsed body", async () => {
    const captured: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        captured.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ remedies: [{ id: 1, name: "ยา" }], healers: [] }),
        };
      }) as unknown as typeof fetch,
    );

    const got = await search("ฟ้า ทะลาย");

    expect(captured[0]).toContain("/search?searchTerm=");
    expect(captured[0]).toContain(encodeURIComponent("ฟ้า ทะลาย"));
    expect(got.remedies).toHaveLength(1);
    expect(got.healers).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd frontend && pnpm test src/lib/api.test.ts`
Expected: FAIL — `search` is not exported.

- [ ] **Step 4: Implement `search()`**

In `frontend/src/lib/api.ts`, add `SearchResponse` to the type import, then add:

```ts
export async function search(term: string): Promise<SearchResponse> {
  return getJson<SearchResponse>(`/search?searchTerm=${encodeURIComponent(term)}`);
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd frontend && pnpm test src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api-types.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(search): add frontend search client and types"
```

---

### Task 5: Frontend search box + results page

**Files:**
- Create: `frontend/src/components/SearchBox.tsx`
- Test: `frontend/src/components/SearchBox.test.tsx`
- Create: `frontend/src/app/search/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `search()`, `RemedySearchResult`, `HealerSearchResult` (Task 4), `RecordCard`, `EmptyState`, `ApiError`.
- Produces: `SearchBox` component; route `/search`.

- [ ] **Step 1: Write the failing SearchBox test**

Create `frontend/src/components/SearchBox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("submits the term to /search via GET", () => {
    render(<SearchBox />);
    const input = screen.getByRole("searchbox");
    const form = input.closest("form");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(input).toHaveAttribute("name", "searchTerm");
  });

  it("shows the current term as the default value", () => {
    render(<SearchBox defaultValue="ไข้" />);
    expect(screen.getByRole("searchbox")).toHaveValue("ไข้");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd frontend && pnpm test src/components/SearchBox.test.tsx`
Expected: FAIL — cannot find `./SearchBox`.

- [ ] **Step 3: Implement SearchBox**

Create `frontend/src/components/SearchBox.tsx`:

```tsx
export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form method="get" action="/search" className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        defaultValue={defaultValue}
        placeholder="ค้นหาอาการหรือสมุนไพร (search symptom or herb)"
        aria-label="Search symptom or herb"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white"
      >
        ค้นหา
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && pnpm test src/components/SearchBox.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the results page**

Create `frontend/src/app/search/page.tsx`:

```tsx
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { ApiError, search } from "@/lib/api";
import type { SearchResponse } from "@/lib/api-types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ searchTerm?: string }>;
}) {
  const { searchTerm } = await searchParams;
  const term = (searchTerm ?? "").trim();

  let result: SearchResponse | null = null;
  let tooShort = false;
  if (term.length >= 2) {
    try {
      result = await search(term);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        tooShort = true;
      } else {
        throw err;
      }
    }
  } else if (term.length === 1) {
    tooShort = true;
  }

  const hasResult = result !== null;
  const empty =
    hasResult && result.remedies.length === 0 && result.healers.length === 0;

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">ค้นหา (Search)</h1>
      <SearchBox defaultValue={term} />

      {tooShort ? (
        <p className="mt-4 text-sm text-stone-500">
          พิมพ์อย่างน้อย 2 ตัวอักษร (type at least two characters).
        </p>
      ) : null}

      {empty ? <div className="mt-6"><EmptyState message="No matches found." /></div> : null}

      {hasResult && result.remedies.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-xl font-semibold">ตำรับยา (Remedies)</h2>
          <div className="grid gap-3">
            {result.remedies.map((r) => (
              <RecordCard
                key={r.id}
                href={`/remedies/${r.id}`}
                title={r.name}
                subtitle={`${r.symptoms} · ${r.healerFullName}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasResult && result.healers.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">หมอพื้นบ้าน (Healers)</h2>
          <div className="grid gap-3">
            {result.healers.map((h) => (
              <RecordCard
                key={h.id}
                href={`/healers/${h.id}`}
                title={h.fullName}
                subtitle={h.specialty}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 6: Mount the search box in the header**

In `frontend/src/app/layout.tsx`, import the component (`import { SearchBox } from "@/components/SearchBox";`) and add it inside the header container, right after the `<p>` tagline:

```tsx
              <div className="mt-3">
                <SearchBox />
              </div>
```

- [ ] **Step 7: Run the frontend gate**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all tests pass; lint clean; build succeeds (type-check passes; `/search` shown as a route).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/SearchBox.tsx frontend/src/components/SearchBox.test.tsx frontend/src/app/search/page.tsx frontend/src/app/layout.tsx
git commit -m "feat(search): add search box and results page"
```

---

## Final integration (orchestrator, after all tasks)

- [ ] Run the full backend suite: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...` — PASS.
- [ ] Run the full frontend gate: `cd frontend && pnpm test && pnpm lint && pnpm build` — clean.
- [ ] Manual smoke via docker compose: `docker compose up --build`, open `http://localhost:3000`, search a seeded herb (e.g. `ฟ้าทะลายโจร`) and a healer name; confirm both groups render and links work.
- [ ] Update `CONTEXT.md` (new endpoint `GET /api/v1/search`, the `/search` page, the pg_trgm migration) and commit.
- [ ] Merge `feat/search-symptom-herb` into `main` with `--no-ff`.

---

## Self-Review Notes

- **Spec coverage:** pg_trgm migration (Task 1), searched fields for remedy+healer (Task 1 queries), consumer-defined reader interfaces + short-term guard (Task 2), `GET /api/v1/search?searchTerm=` with 400/200 semantics (Task 3), `/search` RSC page + header box + `lib/api.search` (Tasks 4–5), error handling (Task 3 handler + Task 5 page try/catch), testing at every layer. All spec sections map to a task.
- **Min-length guard** lives in the use case (rune count) and is surfaced as HTTP 400; the page also guards a 1-char term client-side to avoid a needless round trip.
- **Deviation from spec:** search reader interfaces are defined in `usecase/search` (consumer side), not added to the aggregate `Repository` interfaces — this avoids breaking existing repo fakes and is more idiomatic. Noted in Global Constraints.

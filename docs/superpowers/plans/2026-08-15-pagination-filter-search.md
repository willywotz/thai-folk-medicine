# Pagination, Filters & Merged Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add numbered pagination, filters (remedy by herb/district/symptom, herb by name), and a single merged relevance-ranked search list across the public read surface.

**Architecture:** A pure-Go `listing` kernel (`Params`, `Page[T]`) threads through every list use case and repo. sqlc queries gain `LIMIT/OFFSET` + optional `sqlc.narg` filters, each paired with a `Count` query. Search becomes one SQL `UNION ALL` ranked by trigram `similarity`. The frontend is SSR/RSC: filters and page travel in the URL via a native GET form + a server `<Pagination>` component — zero new client JS.

**Tech Stack:** Go 1.26 (Gin, pgx, sqlc v1.31.1, golang-migrate, testcontainers-go), Next.js 16 App Router + TypeScript + Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-15-pagination-filter-search-design.md`

## Global Constraints

- Clean Architecture: `domain ← usecase ← adapter/platform`. The `listing` kernel lives in `domain` and imports only stdlib.
- Event-driven: reads publish no events. No task in this plan touches the event bus.
- 15-Factor: no new env vars, no new backing service. Page-size caps are Go constants.
- REST route names full-English under `/api/v1`. No new routes — existing list routes gain query params only.
- TDD mandatory: failing test → confirm fail → minimal code → confirm pass. Commit per task.
- Uniform envelope: `{ items, page, pageSize, total, totalPages }`. `page` 1-indexed, `<1`→1. `pageSize` default 12 (grids) / 20 (search), cap 48. `totalPages = max(1, ceil(total/pageSize))`. `page` beyond range → 200 + empty `items`.
- Backend tests on this host need `TESTCONTAINERS_RYUK_DISABLED=true`.
- After editing any `internal/adapter/repository/query/*.sql`, run `sqlc generate` (v1.31.1) before building.
- Go style: uber-go. TS/component style: Google. American English names, no `xxxList` plurals.

---

### Task 1: Pagination kernel (`internal/domain/listing`)

**Files:**
- Create: `backend/internal/domain/listing/listing.go`
- Test: `backend/internal/domain/listing/listing_test.go`

**Interfaces:**
- Produces:
  - `listing.Params{ Limit, Offset int }`
  - `listing.Page[T any]{ Items []T; Total int }`
  - `listing.FromPageSize(page, pageSize, defaultSize int) Params` — clamps `page>=1`, `pageSize` in `1..48` (default `defaultSize`), returns `Limit/Offset`.
  - `listing.TotalPages(total, pageSize int) int` — `max(1, ceil(total/pageSize))`.

- [ ] **Step 1: Write the failing test**

```go
package listing

import "testing"

func TestFromPageSize(t *testing.T) {
	cases := []struct {
		name                     string
		page, pageSize, def      int
		wantLimit, wantOffset    int
	}{
		{"defaults", 0, 0, 12, 12, 0},
		{"page two", 2, 12, 12, 12, 12},
		{"negative page clamps to one", -3, 12, 12, 12, 0},
		{"pageSize capped at 48", 1, 500, 12, 48, 0},
		{"pageSize below one uses default", 1, 0, 20, 20, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := FromPageSize(c.page, c.pageSize, c.def)
			if p.Limit != c.wantLimit || p.Offset != c.wantOffset {
				t.Fatalf("got {%d,%d} want {%d,%d}", p.Limit, p.Offset, c.wantLimit, c.wantOffset)
			}
		})
	}
}

func TestTotalPages(t *testing.T) {
	for _, c := range []struct{ total, size, want int }{
		{0, 12, 1}, {12, 12, 1}, {13, 12, 2}, {146, 12, 13},
	} {
		if got := TotalPages(c.total, c.size); got != c.want {
			t.Fatalf("TotalPages(%d,%d)=%d want %d", c.total, c.size, got, c.want)
		}
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/domain/listing/`
Expected: FAIL (package/functions undefined).

- [ ] **Step 3: Write minimal implementation**

```go
// Package listing holds the pagination kernel shared by every list use case.
package listing

const maxPageSize = 48

// Params is an offset window into a result set.
type Params struct {
	Limit  int
	Offset int
}

// Page is one page of results plus the total matching count.
type Page[T any] struct {
	Items []T
	Total int
}

// FromPageSize converts a 1-indexed page and a page size into a Params window.
func FromPageSize(page, pageSize, defaultSize int) Params {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return Params{Limit: pageSize, Offset: (page - 1) * pageSize}
}

// TotalPages returns the page count for a total and page size, never below one.
func TotalPages(total, pageSize int) int {
	if total <= 0 || pageSize <= 0 {
		return 1
	}
	return (total + pageSize - 1) / pageSize
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && go test ./internal/domain/listing/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/domain/listing/
git commit -m "feat(backend): add listing pagination kernel"
```

---

### Task 2: HTTP page-param parsing + envelope DTO

**Files:**
- Modify: `backend/internal/adapter/http/helpers.go`
- Test: `backend/internal/adapter/http/helpers_test.go` (create if absent)

**Interfaces:**
- Consumes: `listing.Params`, `listing.TotalPages` (Task 1).
- Produces:
  - `parsePageParams(c *gin.Context, defaultSize int) (params listing.Params, page, pageSize int)`
  - `pageDTO[T any]{ Items []T `json:"items"`; Page int `json:"page"`; PageSize int `json:"pageSize"`; Total int `json:"total"`; TotalPages int `json:"totalPages"` }`
  - `newPageDTO[T any](items []T, page, pageSize, total int) pageDTO[T]` — fills `Items` (never nil), `TotalPages`.
  - `optionalInt64Query(c, key) *int64` and `trimmedQuery(c, key) string` — filter param helpers.

- [ ] **Step 1: Write the failing test**

```go
func TestParsePageParams(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/x?page=2&pageSize=100", nil)
	p, page, size := parsePageParams(c, 12)
	if page != 2 || size != 48 || p.Offset != 48 || p.Limit != 48 {
		t.Fatalf("got page=%d size=%d params=%+v", page, size, p)
	}
}

func TestNewPageDTO_NilItemsAndTotalPages(t *testing.T) {
	dto := newPageDTO[int](nil, 1, 12, 0)
	if dto.Items == nil || dto.TotalPages != 1 {
		t.Fatalf("got %+v", dto)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/ -run 'ParsePageParams|NewPageDTO'`
Expected: FAIL (undefined).

- [ ] **Step 3: Write minimal implementation** (append to `helpers.go`)

```go
func parsePageParams(c *gin.Context, defaultSize int) (listing.Params, int, int) {
	page, _ := strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(c.Query("pageSize"))
	params := listing.FromPageSize(page, size, defaultSize)
	return params, page, params.Limit
}

type pageDTO[T any] struct {
	Items      []T `json:"items"`
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

func newPageDTO[T any](items []T, page, pageSize, total int) pageDTO[T] {
	if items == nil {
		items = make([]T, 0)
	}
	return pageDTO[T]{
		Items: items, Page: page, PageSize: pageSize,
		Total: total, TotalPages: listing.TotalPages(total, pageSize),
	}
}

func optionalInt64Query(c *gin.Context, key string) *int64 {
	raw := c.Query(key)
	if raw == "" {
		return nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

func trimmedQuery(c *gin.Context, key string) string {
	return strings.TrimSpace(c.Query(key))
}
```

Add `listing`, `strconv`, `strings` imports as needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && go test ./internal/adapter/http/ -run 'ParsePageParams|NewPageDTO'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/adapter/http/helpers.go backend/internal/adapter/http/helpers_test.go
git commit -m "feat(backend): add page-param parsing and paginated envelope DTO"
```

---

### Task 3: Remedy paginated list with herb/district/symptom filters (flagship)

This is the reference implementation. Later entity tasks reuse this exact repo/service/handler shape.

**Files:**
- Modify: `backend/internal/adapter/repository/query/remedy.sql` (+ `ListRemedyPage`, `CountRemedyPage`)
- Regenerate: `backend/internal/adapter/repository/db/` (via `sqlc generate`)
- Modify: `backend/internal/domain/remedy/remedy.go` (add `ListQuery`, repo method)
- Modify: `backend/internal/adapter/repository/remedy_repository.go`
- Modify: `backend/internal/usecase/remedy_service.go`
- Modify: `backend/internal/adapter/http/remedy_handler.go`
- Test: `backend/internal/adapter/repository/remedy_repository_test.go`, `backend/internal/adapter/http/remedy_handler_test.go`

**Interfaces:**
- Consumes: `listing.Params`, `listing.Page` (Task 1); `parsePageParams`, `newPageDTO`, `optionalInt64Query`, `trimmedQuery` (Task 2).
- Produces:
  - `remedy.ListQuery{ Page listing.Params; HerbID *int64; DistrictID *int64; Symptom string }`
  - `remedy.Repository.ListPage(ctx, q ListQuery) (listing.Page[Remedy], error)`
  - `RemedyService.ListPage(ctx, q remedy.ListQuery) (listing.Page[remedy.Remedy], error)`

- [ ] **Step 1: Write the failing repository test**

```go
func TestRemedyRepository_ListPage_FilterByHerbAndDistrict(t *testing.T) {
	ctx := context.Background()
	pool := newTestPool(t) // existing helper in this test file
	repo := NewRemedy(pool)
	// seed: 2 healers in different districts, 3 remedies, herb link on one — reuse existing seed helpers.
	seedRemedyFixtures(t, ctx, pool) // add this helper alongside existing seeders

	page, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 10, Offset: 0}})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 3 || len(page.Items) != 3 {
		t.Fatalf("no filter: total=%d items=%d", page.Total, len(page.Items))
	}

	herbID := seededHerbID
	filtered, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 10}, HerbID: &herbID})
	if err != nil {
		t.Fatal(err)
	}
	if filtered.Total != 1 || len(filtered.Items) != 1 {
		t.Fatalf("herb filter: total=%d items=%d", filtered.Total, len(filtered.Items))
	}
}

func TestRemedyRepository_ListPage_OffsetWindow(t *testing.T) {
	ctx := context.Background()
	pool := newTestPool(t)
	repo := NewRemedy(pool)
	seedRemedyFixtures(t, ctx, pool)
	page2, err := repo.ListPage(ctx, remedy.ListQuery{Page: listing.Params{Limit: 2, Offset: 2}})
	if err != nil {
		t.Fatal(err)
	}
	if page2.Total != 3 || len(page2.Items) != 1 {
		t.Fatalf("window: total=%d items=%d", page2.Total, len(page2.Items))
	}
}
```

> Follow the existing `remedy_repository_test.go` setup helpers for pool + seeding; add `seedRemedyFixtures` returning stable ids (`seededHerbID`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run RemedyRepository_ListPage`
Expected: FAIL (`ListPage` undefined).

- [ ] **Step 3a: Add the sqlc queries** to `remedy.sql`

```sql
-- name: ListRemedyPage :many
SELECT r.id, r.healer_id, r.name, r.symptoms, r.preparation_method, r.usage, r.note, r.created_at, r.updated_at
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE (sqlc.narg('herb_id')::bigint IS NULL
       OR EXISTS (SELECT 1 FROM remedy_herb rh
                  WHERE rh.remedy_id = r.id AND rh.herb_id = sqlc.narg('herb_id')::bigint))
  AND (sqlc.narg('district_id')::bigint IS NULL OR h.district_id = sqlc.narg('district_id')::bigint)
  AND (sqlc.narg('symptom')::text IS NULL OR r.symptoms ILIKE '%' || sqlc.narg('symptom')::text || '%')
ORDER BY r.created_at DESC, r.id DESC
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountRemedyPage :one
SELECT COUNT(*)
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE (sqlc.narg('herb_id')::bigint IS NULL
       OR EXISTS (SELECT 1 FROM remedy_herb rh
                  WHERE rh.remedy_id = r.id AND rh.herb_id = sqlc.narg('herb_id')::bigint))
  AND (sqlc.narg('district_id')::bigint IS NULL OR h.district_id = sqlc.narg('district_id')::bigint)
  AND (sqlc.narg('symptom')::text IS NULL OR r.symptoms ILIKE '%' || sqlc.narg('symptom')::text || '%');
```

Run: `cd backend && sqlc generate`

- [ ] **Step 3b: Add the domain type + interface method** in `remedy.go`

```go
// ListQuery selects and pages remedies for public browse.
type ListQuery struct {
	Page       listing.Params
	HerbID     *int64
	DistrictID *int64
	Symptom    string
}
```
Add to `Repository`: `ListPage(ctx context.Context, q ListQuery) (listing.Page[Remedy], error)`
Import `.../internal/domain/listing`.

- [ ] **Step 3c: Implement the repo method** in `remedy_repository.go`

```go
// ListPage returns one page of remedies matching the optional filters.
func (r *Remedy) ListPage(ctx context.Context, q remedy.ListQuery) (listing.Page[remedy.Remedy], error) {
	symptom := pgtype.Text{}
	if q.Symptom != "" {
		symptom = pgtype.Text{String: q.Symptom, Valid: true}
	}
	rows, err := r.q.ListRemedyPage(ctx, db.ListRemedyPageParams{
		HerbID:     optInt64(q.HerbID),
		DistrictID: optInt64(q.DistrictID),
		Symptom:    symptom,
		PageLimit:  int32(q.Page.Limit),
		PageOffset: int32(q.Page.Offset),
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	total, err := r.q.CountRemedyPage(ctx, db.CountRemedyPageParams{
		HerbID: optInt64(q.HerbID), DistrictID: optInt64(q.DistrictID), Symptom: symptom,
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	items := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		items = append(items, toRemedy(row))
	}
	return listing.Page[remedy.Remedy]{Items: items, Total: int(total)}, nil
}
```

Add a small helper (same file or `helpers`): `func optInt64(p *int64) pgtype.Int8 { if p == nil { return pgtype.Int8{} }; return pgtype.Int8{Int64: *p, Valid: true} }`. (Confirm the sqlc-generated nullable type names — `pgtype.Int8`/`pgtype.Text` — and match them; adjust field types if sqlc emits `*int64`.)

- [ ] **Step 3d: Implement the service method** in `remedy_service.go`

```go
// ListPage returns one paginated, filtered page of remedies.
func (s *RemedyService) ListPage(ctx context.Context, q remedy.ListQuery) (listing.Page[remedy.Remedy], error) {
	return s.repo.ListPage(ctx, q)
}
```

- [ ] **Step 4a: Run repo tests**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run RemedyRepository_ListPage`
Expected: PASS.

- [ ] **Step 5a: Write the failing handler test** in `remedy_handler_test.go`

```go
func TestRemedyHandler_ListPage_Envelope(t *testing.T) {
	repo := &stubRemedyRepo{page: listing.Page[remedy.Remedy]{
		Items: []remedy.Remedy{{ID: 1, Name: "ยาแก้ไข้"}}, Total: 1,
	}}
	router := newRemedyRouter(repo)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/remedies?page=1&pageSize=12&herbId=3", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d", rec.Code)
	}
	var body struct {
		Items      []map[string]any `json:"items"`
		Total      int              `json:"total"`
		TotalPages int              `json:"totalPages"`
	}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if len(body.Items) != 1 || body.Total != 1 || body.TotalPages != 1 {
		t.Fatalf("envelope %+v", body)
	}
	if repo.gotQuery.HerbID == nil || *repo.gotQuery.HerbID != 3 {
		t.Fatalf("herb filter not wired: %+v", repo.gotQuery)
	}
}
```
Extend `stubRemedyRepo` with `page listing.Page[remedy.Remedy]`, `gotQuery remedy.ListQuery`, and a `ListPage` method recording `gotQuery` and returning `page`.

- [ ] **Step 5b: Rewrite the handler** `ListRecent` → `ListPage` in `remedy_handler.go`

```go
// ListPage handles GET /api/v1/remedies?page&pageSize&herbId&districtId&symptom.
func (h *RemedyHandler) ListPage(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListPage(c.Request.Context(), remedy.ListQuery{
		Page:       params,
		HerbID:     optionalInt64Query(c, "herbId"),
		DistrictID: optionalInt64Query(c, "districtId"),
		Symptom:    trimmedQuery(c, "symptom"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies"})
		return
	}
	out := make([]remedyDTO, 0, len(result.Items))
	for _, r := range result.Items {
		out = append(out, toRemedyDTO(r))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}
```
In `RegisterRoutes`, change `public.GET("/remedies", h.ListRecent)` → `public.GET("/remedies", h.ListPage)`. Remove the old `ListRecent` handler and `parseLimit` if now unused. Remove `RemedyService.ListRecent` + `Repository.ListRecent` + `ListRecentRemedy` sql only after Task 10 confirms no caller — track with a compile check; simplest is to leave `ListRecent` until Task 10 then delete. **Decision: delete `ListRecent` now and let the home page adopt `ListPage` in Task 10.**

- [ ] **Step 6: Run handler + full backend build**

Run: `cd backend && go test ./internal/adapter/http/ -run RemedyHandler && go build ./...`
Expected: PASS / builds.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/domain/remedy backend/internal/usecase/remedy_service.go \
  backend/internal/adapter/repository backend/internal/adapter/http/remedy_handler.go \
  backend/internal/adapter/http/remedy_handler_test.go
git commit -m "feat(backend): paginate and filter remedies by herb, district, symptom"
```

---

### Task 4: Herb paginated list with name/property filter

**Files:**
- Modify: `backend/internal/adapter/repository/query/herb.sql` (+ `ListHerbPage`, `CountHerbPage`) → `sqlc generate`
- Modify: `backend/internal/domain/herb/herb.go`, `backend/internal/adapter/repository/herb_repository.go`, `backend/internal/usecase/herb_service.go`, `backend/internal/adapter/http/herb_handler.go`
- Test: herb repo + handler tests

**Interfaces:**
- Produces: `herb.ListQuery{ Page listing.Params; Query string }`; `herb.Repository.ListPage(ctx, q) (listing.Page[Herb], error)`; `HerbService.ListPage`.

- [ ] **Step 1: Failing repo test** — assert `ListPage` with `Query:"ขิง"` returns only herbs whose Thai/English name or property matches, and `Total` reflects the filter; assert an offset window. Model on Task 3 Step 1.

- [ ] **Step 2: Run — Expected FAIL.**
Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run HerbRepository_ListPage`

- [ ] **Step 3a: sqlc queries** (herb.sql)

```sql
-- name: ListHerbPage :many
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE (sqlc.narg('query')::text IS NULL
       OR name_thai ILIKE '%' || sqlc.narg('query')::text || '%'
       OR name_english ILIKE '%' || sqlc.narg('query')::text || '%'
       OR properties ILIKE '%' || sqlc.narg('query')::text || '%')
ORDER BY name_thai
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountHerbPage :one
SELECT COUNT(*) FROM herb
WHERE (sqlc.narg('query')::text IS NULL
       OR name_thai ILIKE '%' || sqlc.narg('query')::text || '%'
       OR name_english ILIKE '%' || sqlc.narg('query')::text || '%'
       OR properties ILIKE '%' || sqlc.narg('query')::text || '%');
```
(Match the real herb column names from `herb.sql`; adjust if `properties`/`description` differ.) Run `sqlc generate`.

- [ ] **Step 3b–3d:** Add `herb.ListQuery` + `Repository.ListPage`; implement repo `ListPage` (pattern identical to Task 3 Step 3c, single `query` text filter); add `HerbService.ListPage`.

- [ ] **Step 4: Run repo test — Expected PASS.**

- [ ] **Step 5: Handler** — replace `HerbHandler.List` body to parse `parsePageParams(c, 12)` + `trimmedQuery(c,"query")`, call `ListPage`, emit `newPageDTO(herbDTOs, page, pageSize, total)`. Route string `"/herbs"` unchanged. Add a handler test mirroring Task 3 Step 5a (assert envelope + `query` wiring).

- [ ] **Step 6: Run — Expected PASS.**
Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/http/ -run HerbHandler && go build ./...`

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(backend): paginate herbs with name/property filter"
```

---

### Task 5: Paginate the remaining list endpoints (cases, healers-by-district, nested remedy/case lists)

Each below is the same 5-step TDD cycle as Task 3, page-only (no filters). Do them as one task with one commit; each gets a failing repo test asserting `Total` + offset window, then handler envelope.

**Files:** `treatment_case.sql`, `healer.sql`, `remedy.sql` (add page variants of `ListRemedyByHealer`, `ListRemedyByHerb`), their repos, services, handlers, and tests. Run `sqlc generate` after the SQL edits.

**Endpoints + new methods:**

| Route | New sqlc `:many` + `:one COUNT` | Domain method |
|---|---|---|
| `GET /treatment-cases` | `ListRecentCasePage` / `CountCasePage` | `TreatmentCaseRepository.ListPage(ctx, listing.Params)` |
| `GET /districts/{id}/healers` | `ListHealerByDistrictPage` / `CountHealerByDistrict` | `HealerRepository.ListByDistrictPage(ctx, districtID int64, p listing.Params)` |
| `GET /herbs/{id}/remedies` | `ListRemedyByHerbPage` / `CountRemedyByHerb` | `RemedyRepository.ListByHerbPage(ctx, herbID int64, p listing.Params)` |
| `GET /healers/{id}/remedies` | `ListRemedyByHealerPage` / `CountRemedyByHealer` | `RemedyRepository.ListByHealerPage(ctx, healerID int64, p listing.Params)` |
| `GET /remedies/{id}/treatment-cases` | `ListCaseByRemedyPage` / `CountCaseByRemedy` | `TreatmentCaseRepository.ListByRemedyPage(ctx, remedyID int64, p listing.Params)` |

Each `:many` follows: `SELECT … WHERE <scope> ORDER BY <existing order> LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset')`; each COUNT mirrors the scope. Repo methods return `listing.Page[T]` (items loop + count, as Task 3 Step 3c). Services expose `ListPage`/`ListByXPage`. Handlers parse `parsePageParams(c, 12)` and emit `newPageDTO`. Remove the now-dead `ListRecent`/plain-list methods and their sql/service/handler once the route is switched.

- [ ] **Step 1:** Write one failing repo test per method (Total + offset window). Run: `TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/` → FAIL.
- [ ] **Step 2:** Add all sqlc queries above; `sqlc generate`.
- [ ] **Step 3:** Add domain methods, repo impls, service methods.
- [ ] **Step 4:** Run repo tests → PASS.
- [ ] **Step 5:** Switch handlers to paginated envelope; add handler envelope tests.
- [ ] **Step 6:** Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./... && go build ./...` → PASS.
- [ ] **Step 7: Commit**

```bash
git commit -am "feat(backend): paginate cases, district healers, and nested remedy/case lists"
```

---

### Task 6: Merged, ranked, paginated search

**Files:**
- Modify: `backend/internal/adapter/repository/query/` — new `search.sql` with `SearchAll`, `CountSearchAll` → `sqlc generate`
- Create: `backend/internal/adapter/repository/search_repository.go` (+ test)
- Modify: `backend/internal/usecase/search/service.go` (+ test)
- Modify: `backend/internal/adapter/http/search_handler.go` (+ test)
- Modify: wiring in `cmd/api` / router builder that constructs the search service

**Interfaces:**
- Produces:
  - `search.Hit{ Type string; ID int64; Title string; Subtitle string; Score float64 }`
  - `search.Reader interface { SearchAll(ctx, term string, p listing.Params) (listing.Page[Hit], error) }`
  - `search.Service.Search(ctx, term string, p listing.Params) (listing.Page[Hit], error)` (replaces the three-reader `Search`)

- [ ] **Step 1: Write the failing repo test**

```go
func TestSearchRepository_SearchAll_RanksAndPaginates(t *testing.T) {
	ctx := context.Background()
	pool := newTestPool(t)
	seedSearchFixtures(t, ctx, pool) // a remedy, a healer, a herb all matching "ขิง"
	repo := NewSearch(newQueries(pool))
	page, err := repo.SearchAll(ctx, "ขิง", listing.Params{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total < 2 || len(page.Items) != 2 {
		t.Fatalf("total=%d items=%d", page.Total, len(page.Items))
	}
	if page.Items[0].Score < page.Items[1].Score {
		t.Fatalf("not ordered by score desc: %+v", page.Items)
	}
}
```

- [ ] **Step 2: Run — Expected FAIL.**
Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/ -run SearchRepository_SearchAll`

- [ ] **Step 3a: sqlc queries** (`search.sql`)

```sql
-- name: SearchAll :many
WITH hits AS (
  SELECT 'remedy'::text AS type, r.id, r.name AS title, r.symptoms AS subtitle,
         GREATEST(similarity(r.name, @search_term::text), similarity(r.symptoms, @search_term::text),
                  COALESCE(max(similarity(hb.name_thai, @search_term::text)), 0))::real AS score
  FROM remedy r
  LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
  LEFT JOIN herb hb ON hb.id = rh.herb_id
  GROUP BY r.id, r.name, r.symptoms
  UNION ALL
  SELECT 'healer'::text, h.id, h.full_name, h.sub_district,
         GREATEST(similarity(h.full_name, @search_term::text), similarity(h.specialty, @search_term::text))::real
  FROM healer h
  UNION ALL
  SELECT 'herb'::text, hb.id, hb.name_thai, hb.name_english,
         GREATEST(similarity(hb.name_thai, @search_term::text), similarity(hb.name_english, @search_term::text),
                  similarity(hb.scientific_name, @search_term::text))::real
  FROM herb hb
)
SELECT type, id, title, subtitle, score FROM hits
WHERE score > 0
ORDER BY score DESC, type, id
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountSearchAll :one
WITH hits AS ( /* identical CTE body as above */ )
SELECT COUNT(*) FROM hits WHERE score > 0;
```
(Confirm real column names: healer `full_name`,`specialty`,`sub_district`; herb `name_thai`,`name_english`,`scientific_name`.) Run `sqlc generate`.

- [ ] **Step 3b: Implement `search_repository.go`**

```go
// SearchAll returns one merged, score-ordered page of remedy/healer/herb hits.
func (r *Search) SearchAll(ctx context.Context, term string, p listing.Params) (listing.Page[search.Hit], error) {
	rows, err := r.q.SearchAll(ctx, db.SearchAllParams{
		SearchTerm: term, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[search.Hit]{}, err
	}
	total, err := r.q.CountSearchAll(ctx, term)
	if err != nil {
		return listing.Page[search.Hit]{}, err
	}
	items := make([]search.Hit, 0, len(rows))
	for _, row := range rows {
		items = append(items, search.Hit{
			Type: row.Type, ID: row.ID, Title: row.Title,
			Subtitle: row.Subtitle, Score: float64(row.Score),
		})
	}
	return listing.Page[search.Hit]{Items: items, Total: int(total)}, nil
}
```
Add `NewSearch(q *db.Queries) *Search`. Add the `// withinlazy: cross-type trigram scores are uncalibrated; add per-type weight multipliers here if merged ordering needs tuning.` comment above the CTE construction / repo method.

- [ ] **Step 3c: Rewrite `search/service.go`** to hold one `Reader`, keep the `ErrTermTooShort` guard, delegate to `SearchAll`:

```go
func (s *Service) Search(ctx context.Context, term string, p listing.Params) (listing.Page[Hit], error) {
	term = strings.TrimSpace(term)
	if utf8.RuneCountInString(term) < 2 {
		return listing.Page[Hit]{}, ErrTermTooShort
	}
	return s.reader.SearchAll(ctx, term, p)
}
```
Delete the three-reader fields/interfaces (`RemedyReader`/`HealerReader`/`HerbReader`) and the old `Result` type.

- [ ] **Step 3d: Update wiring** where `search.NewService(...)` is called (grep `search.NewService`) to pass the new `Search` repo.

- [ ] **Step 4: Run repo + service tests — Expected PASS.**

- [ ] **Step 5: Rewrite the search handler**

```go
type searchHitDTO struct {
	Type     string  `json:"type"`
	ID       int64   `json:"id"`
	Title    string  `json:"title"`
	Subtitle string  `json:"subtitle"`
	Score    float64 `json:"score"`
}

func (h *SearchHandler) Search(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 20)
	result, err := h.service.Search(c.Request.Context(), c.Query("searchTerm"), params)
	if err != nil {
		if errors.Is(err, search.ErrTermTooShort) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "search term must be at least two characters"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot run search"})
		return
	}
	out := make([]searchHitDTO, 0, len(result.Items))
	for _, hit := range result.Items {
		out = append(out, searchHitDTO{hit.Type, hit.ID, hit.Title, hit.Subtitle, hit.Score})
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}
```
Update `search_handler_test.go`: short term → 400; a seeded/stubbed term → envelope with merged `items` carrying `type`.

- [ ] **Step 6: Run — Expected PASS + build.**
Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./... && go build ./...`

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(backend): merged, ranked, paginated search across remedies, healers, herbs"
```

---

### Task 7: Frontend API client — `Page<T>`, `SearchHit`, paginated functions

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts` (or wherever `Remedy`/`Herb` types live)
- Test: `frontend/src/lib/api.test.ts` (extend existing)

**Interfaces:**
- Produces:
  - `type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }`
  - `type SearchHit = { type: "remedy" | "healer" | "herb"; id: number; title: string; subtitle: string; score: number }`
  - `listRemedies(opts?: { page?; pageSize?; herbId?; districtId?; symptom? }): Promise<Page<Remedy>>`
  - `listHerbs(opts?: { page?; pageSize?; query? }): Promise<Page<Herb>>`
  - `listTreatmentCases(opts?: { page?; pageSize? }): Promise<Page<TreatmentCase>>`
  - `listHealersByDistrict(districtId, opts?)`, `listRemediesByHerb(herbId, opts?)`, `listRemediesByHealer(healerId, opts?)`, `listCasesByRemedy(remedyId, opts?)` — all return `Page<T>`.
  - `search(term, opts?: { page?; pageSize? }): Promise<Page<SearchHit>>`

- [ ] **Step 1: Failing test**

```ts
it("listRemedies builds a paginated, filtered query and returns a Page", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 1 }),
      { status: 200 }));
  const res = await listRemedies({ page: 2, herbId: 3, symptom: "ไข้" });
  const url = (spy.mock.calls[0][0] as string);
  expect(url).toContain("/remedies?");
  expect(url).toContain("page=2");
  expect(url).toContain("herbId=3");
  expect(url).toContain("symptom=");
  expect(res.totalPages).toBe(1);
});
```

- [ ] **Step 2: Run — Expected FAIL.** Run: `cd frontend && pnpm test src/lib/api.test.ts`

- [ ] **Step 3: Implement.** Add a `buildQuery(opts)` that appends only defined params, then:

```ts
export async function listRemedies(opts: RemedyListOptions = {}): Promise<Page<Remedy>> {
  return getJson<Page<Remedy>>(`/remedies${buildQuery(opts)}`);
}
```
Replace `listRecentRemedies`/`listRecentCases` with `listRemedies`/`listTreatmentCases`. Give the nested + search functions the same treatment.

- [ ] **Step 4: Run — Expected PASS.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): Page<T> envelope and paginated/filtered api client"
```

---

### Task 8: `<Pagination>` server component

**Files:**
- Create: `frontend/src/components/Pagination.tsx`
- Test: `frontend/src/components/Pagination.test.tsx`

**Interfaces:**
- Consumes: nothing app-specific.
- Produces: `Pagination({ page, totalPages, searchParams, basePath }: { page: number; totalPages: number; searchParams: Record<string,string|undefined>; basePath: string })` — renders `<a>`/`<Link>` whose href sets `page` while preserving other params; Prev disabled at 1, Next disabled at `totalPages`; renders nothing when `totalPages <= 1`.

- [ ] **Step 1: Failing test**

```tsx
it("preserves other params and links to the next page", () => {
  render(<Pagination page={2} totalPages={5} basePath="/remedies"
    searchParams={{ herbId: "3", page: "2" }} />);
  const next = screen.getByRole("link", { name: /next/i });
  expect(next.getAttribute("href")).toBe("/remedies?herbId=3&page=3");
});

it("renders nothing for a single page", () => {
  const { container } = render(<Pagination page={1} totalPages={1} basePath="/x" searchParams={{}} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run — Expected FAIL.** Run: `cd frontend && pnpm test src/components/Pagination.test.tsx`

- [ ] **Step 3: Implement** a `hrefFor(targetPage)` that clones `searchParams`, sets `page`, and `URLSearchParams`-encodes; render a windowed range + Prev/Next using `next/link`. Return `null` when `totalPages <= 1`.

- [ ] **Step 4: Run — Expected PASS.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): add server Pagination component"
```

---

### Task 9: `<Filters>` component (native GET form)

**Files:**
- Create: `frontend/src/components/Filters.tsx`
- Test: `frontend/src/components/Filters.test.tsx`

**Interfaces:**
- Produces: `Filters({ action, fields, values }: { action: string; fields: FilterField[]; values: Record<string,string|undefined> })` where `FilterField` is a discriminated union: `{ kind: "select"; name; label; options: {value;label}[] }` | `{ kind: "text"; name; label; placeholder? }`. Renders a `<form method="get" action={action}>` with each field pre-filled from `values`, a submit button, and a "clear" link to `action`.

- [ ] **Step 1: Failing test** — assert the form has `method="get"`, a `<select name="herbId">` whose current option is selected from `values`, a text input pre-filled, and a clear link to `action`.

- [ ] **Step 2: Run — Expected FAIL.**

- [ ] **Step 3: Implement.** No client JS; native form. `page` is intentionally omitted so a new filter submit resets to page 1.

- [ ] **Step 4: Run — Expected PASS.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): add native GET-form Filters component"
```

---

### Task 10: Wire public pages to pagination, filters, and merged search

**Files:**
- Modify: `frontend/src/app/page.tsx` (home strips → `listRemedies({pageSize:6})`, `listTreatmentCases({pageSize:6})`, read `.items`)
- Modify: `frontend/src/app/herbs/page.tsx`, `frontend/src/app/remedies/page.tsx`, `frontend/src/app/treatment-cases/page.tsx`, `frontend/src/app/search/page.tsx`
- Modify: nested list renderers — `frontend/src/app/herbs/[herbId]/…`, `frontend/src/app/healers/[healerId]/…`, `frontend/src/app/remedies/[remedyId]/…` (whichever render the paginated child lists)
- Test: page-level tests where they already exist; otherwise rely on component tests + a build.

**Interfaces:**
- Consumes: Task 7 api functions, Task 8 `<Pagination>`, Task 9 `<Filters>`.

- [ ] **Step 1:** For `/remedies`: read `searchParams` for `page`, `herbId`, `districtId`, `symptom`; fetch herb + district option lists for `<Filters>`; call `listRemedies({...})`; render `<Filters>` + grid over `page.items` + `<Pagination page={page.page} totalPages={page.totalPages} basePath="/remedies" searchParams={sp} />`. Photo covers now map over `page.items` only.

- [ ] **Step 2:** For `/herbs` (query filter), `/treatment-cases` (page only), and each nested list: same pattern, appropriate `<Filters>` (herbs get a single `query` text field; cases/nested get none).

- [ ] **Step 3:** For `/search`: read `searchTerm` + `page`; call `search(term, { page })`; render one merged list where each row shows a `type` badge and links to `/remedies/{id}` | `/healers/{id}` | `/herbs/{id}` from `hit.type`; add `<Pagination basePath="/search" searchParams={{ searchTerm, page }} />`.

- [ ] **Step 4: Run the frontend gates**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all PASS/clean.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): paginate and filter public pages; merged search list"
```

---

### Task 11: End-to-end verification + docs

**Files:**
- Modify: `CONTEXT.md` (API contract: envelope + per-endpoint params + merged search shape)
- Modify: `HANDOFF.md` "Known gotchas" if a new one emerged (e.g. `pageSize` cap constant)

- [ ] **Step 1: Full backend + frontend suites**

Run:
```bash
cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./... && go build ./...
cd ../frontend && pnpm test && pnpm lint && pnpm build
```
Expected: all green.

- [ ] **Step 2: Manual smoke via docker**

```bash
docker compose up --build -d
docker compose --profile seed run --build --rm seed -reset
```
Visit `http://localhost:3000/remedies?page=2`, apply a herb filter, apply a district filter, type a symptom; visit `/herbs?query=ขิง`; run a `/search?searchTerm=…` and page through the merged list. Confirm URLs carry state and back/forward work.

- [ ] **Step 3: Update `CONTEXT.md`** with the envelope, the per-endpoint query params, and the `SearchHit` shape. Note reads remain event-free.

- [ ] **Step 4: Commit**

```bash
git add CONTEXT.md HANDOFF.md
git commit -m "docs: record pagination/filter/merged-search API contract"
```

- [ ] **Step 5: Merge to main** (after review)

```bash
git checkout main && git merge --no-ff feat/pagination-filter-search
```

---

## Self-Review notes

- **Spec coverage:** envelope + params (Tasks 1,2), remedy filters (3), herb filter (4), remaining pagination + nested lists (5), merged search (6), frontend client/components/pages (7–10), docs (11). All spec sections mapped.
- **Type consistency:** `listing.Params`/`Page[T]`, `remedy.ListQuery`/`herb.ListQuery`, `RemedyRepository.ListPage`/`ListByHerbPage`/`ListByHealerPage`, `search.Hit`/`Reader.SearchAll`, `Page<T>`/`SearchHit`, `newPageDTO`/`parsePageParams` used identically across tasks.
- **Open confirmations for the implementer** (resolve by reading the real file, not guessing): exact sqlc nullable Go types (`pgtype.Int8`/`pgtype.Text` vs `*int64`/`*string`); real herb/healer column names; the exact file that calls `search.NewService`; whether page-level frontend tests exist per route.

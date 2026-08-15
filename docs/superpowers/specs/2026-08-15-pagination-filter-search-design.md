# Pagination, Filters & Search — Public Zone Design

Date: 2026-08-15
Status: Approved for planning
Scope: One big-bang increment. Adds pagination, filtering, and a merged search
result to the public read surface of the Thai folk-medicine app.

## Goal

The public browse pages render every row at once and the search page returns
three unbounded groups. As the data grows (already ~146 remedies, ~280 cases,
~50 healers per province) this does not scale and gives visitors no way to
narrow results. This increment adds three capabilities as one coherent system:

1. **Pagination** — numbered pages (`?page=N`) on every public list and on
   search, with a uniform response envelope.
2. **Filters** — narrow remedies by herb, district, or symptom text; narrow
   herbs by name/property.
3. **Merged search** — one relevance-ranked, paginated list mixing remedies,
   healers, and herbs, each row tagged with its type.

Non-goals: cursor/infinite pagination, faceted filter counts, per-type search
weight tuning, a photo batch endpoint, GraphQL. See "Deferred".

## Constraints

- **Clean Architecture**: dependency rule `domain ← usecase ← adapter/platform`
  is preserved. The new pagination kernel lives in `domain`; it carries no
  framework code.
- **Event-driven**: only writes publish domain events. Pagination, filters, and
  search are reads — they touch no event code. This is deliberate and correct.
- **15-Factor**: no new config, no new backing service. Page-size caps are
  compile-time constants, not env.
- **Full-English REST route names** under `/api/v1`. No new endpoints beyond the
  existing route set — existing list routes gain query parameters.
- **TDD mandatory**: every layer is built failing-test-first.

## 1. API contract — uniform `Page[T]` envelope

Every list endpoint returns the same envelope:

```jsonc
{
  "items": [ /* T[] */ ],
  "page": 2,
  "pageSize": 12,
  "total": 146,
  "totalPages": 13
}
```

Query parameters, applied by a shared parser:

| Param      | Rule |
|------------|------|
| `page`     | 1-indexed. Non-numeric or `< 1` → `1`. |
| `pageSize` | Default `12` (card grids) / `20` (search). Capped at `48`. Non-numeric or `< 1` → default. |

Derived: `totalPages = max(1, ceil(total / pageSize))`. A `page` beyond
`totalPages` returns the correct metadata with an empty `items` array (not an
error).

### Endpoints (all `/api/v1`, existing routes — params added)

| Endpoint | New params |
|----------|-----------|
| `GET /remedies` | `page, pageSize, herbId, districtId, symptom` — replaces today's `?limit`; the home strip reads page-1 `items` |
| `GET /treatment-cases` | `page, pageSize` — replaces `?limit` |
| `GET /herbs` | `page, pageSize, query` (name/property substring) |
| `GET /districts/{id}/healers` | `page, pageSize` (the path district *is* the healer district filter) |
| `GET /herbs/{id}/remedies` | `page, pageSize` |
| `GET /healers/{id}/remedies` | `page, pageSize` |
| `GET /remedies/{id}/treatment-cases` | `page, pageSize` |
| `GET /search` | `page, pageSize` — now returns merged `Page[SearchHit]` |

Filters are optional and combine as **AND**. The remedy `districtId` filter
joins `remedy → healer → district`. `GET /districts` (the province's district
list) stays unpaginated — it is a small fixed set.

### Search hit shape

```jsonc
{ "type": "remedy" | "healer" | "herb", "id": 12, "title": "…", "subtitle": "…", "score": 0.42 }
```

`title`/`subtitle` per type: remedy → name / symptoms; healer → fullName /
sub-district; herb → nameThai / nameEnglish. The frontend renders `type` as a
badge and links to the matching detail page.

## 2. Backend design (Clean Architecture)

### 2.1 Pagination kernel — `internal/domain/listing`

```go
package listing

// Params is an offset window into a result set.
type Params struct {
	Limit  int
	Offset int
}

// Page is one page of results plus the unfiltered-by-page total.
type Page[T any] struct {
	Items []T
	Total int
}
```

Pure Go generics, no imports beyond stdlib. `domain` may depend on it.

### 2.2 Use cases

Each `List*` method takes a params struct embedding `listing.Params` and returns
`listing.Page[T]`. Example:

```go
type ListParams struct {
	Page       listing.Params
	HerbID     *int64  // nil = no herb filter
	DistrictID *int64  // nil = no district filter
	Symptom    string  // "" = no symptom filter
}

func (s *RemedyService) List(ctx context.Context, p ListParams) (listing.Page[Remedy], error)
```

`ListRecent` (home strips) is **removed**; the home page calls the paginated
`List`/`ListByRecency` with `pageSize=6` and reads `items`. This keeps a single
list path per entity.

### 2.3 Repositories / sqlc

Each list query gains `LIMIT/OFFSET` plus, where filtered, optional predicates
via `sqlc.narg`:

```sql
-- name: ListRemedies :many
SELECT r.*, ...
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE (sqlc.narg('herb_id')::bigint IS NULL
        OR EXISTS (SELECT 1 FROM remedy_herb rh
                   WHERE rh.remedy_id = r.id AND rh.herb_id = sqlc.narg('herb_id')))
  AND (sqlc.narg('district_id')::bigint IS NULL OR h.district_id = sqlc.narg('district_id'))
  AND (sqlc.narg('symptom')::text IS NULL OR r.symptoms ILIKE '%' || sqlc.narg('symptom') || '%')
GROUP BY r.id
ORDER BY r.created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountRemedies :one  (same WHERE, no LIMIT/OFFSET)
```

Each paginated list gets a matching `Count*` query with the identical `WHERE`.
Symptom and herb-name filters reuse the existing `pg_trgm` GIN indexes
(migrations `000008`–`000010`); `ILIKE '%term%'` is index-assisted by trigram.
No new migration is expected. Regenerate with `sqlc generate` (v1.31.1) after
editing `query/*.sql`.

The remedy list stays transactional/read-consistent through the existing
pgx-pool repo; count + page are two queries against the same pool (acceptable —
no cross-request consistency guarantee is promised).

### 2.4 Search — one merged union query

Replace the three-query search service with a single SQL statement that unions a
common shape per entity and ranks by trigram `similarity()`:

```sql
-- name: SearchAll :many
WITH hits AS (
  SELECT 'remedy' AS type, r.id, r.name AS title, r.symptoms AS subtitle,
         GREATEST(similarity(r.name, @term), similarity(r.symptoms, @term),
                  COALESCE(max(similarity(hb.name_thai, @term)), 0)) AS score
  FROM remedy r
  LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
  LEFT JOIN herb hb ON hb.id = rh.herb_id
  GROUP BY r.id
  UNION ALL
  SELECT 'healer', h.id, h.full_name, h.sub_district,
         GREATEST(similarity(h.full_name, @term), similarity(h.specialty, @term))
  FROM healer h
  UNION ALL
  SELECT 'herb', hb.id, hb.name_thai, hb.name_english,
         GREATEST(similarity(hb.name_thai, @term), similarity(hb.name_english, @term),
                  similarity(hb.scientific_name, @term))
  FROM herb hb
)
SELECT * FROM hits WHERE score > 0
ORDER BY score DESC, type, id
LIMIT @limit OFFSET @offset;

-- name: CountSearchAll :one  -- COUNT(*) over the same CTE, score > 0
```

`ORDER BY score DESC, type, id` — `type, id` is a stable tiebreak so pagination
is deterministic across pages.

**Ranking ceiling (accepted).** Trigram `similarity` is not calibrated across
entity types — a herb-name match and a remedy-symptom match are not on the same
scale — so the merged order is "reasonable, not perfect". This is accepted for
this increment. Mark in code:

```go
// withinlazy: cross-type trigram scores are uncalibrated; add per-type
// weight multipliers here if merged ordering needs tuning.
```

The `search.ErrTermTooShort` guard (min 2 runes via `utf8.RuneCountInString`) is
unchanged and runs before the query.

### 2.5 HTTP adapter

- `helpers.go` gains `parsePage(c *gin.Context, defaultSize int) listing.Params`
  — parses/clamps/caps `page`+`pageSize`, returns `Limit/Offset`.
- Handlers parse optional filter params (`herbId`, `districtId` → `*int64`;
  `symptom`, `query` → `string`), call the use case, and map
  `listing.Page[T]` → a `pageDTO[T]{ Items, Page, PageSize, Total, TotalPages }`.
- A shared `toPageDTO(items, params, total)` helper computes `page`, `pageSize`,
  `totalPages` from `Offset`, `Limit`, and `Total`.

No router changes — routes already exist; only handler bodies and DTOs change.

## 3. Frontend design (Next.js RSC / SSR)

No new client-side data fetching. Filters and paging travel through the URL, so
every state is server-rendered and shareable.

### 3.1 API client — `lib/api.ts`

- Add `Page<T>` and `SearchHit` types.
- List functions take an options object `{ page?, pageSize?, herbId?, districtId?, symptom?, query? }`
  and return `Page<T>`; they build the query string and call the existing
  `getJson`. `listRecentRemedies`/`listRecentCases` are replaced by the paginated
  functions (home passes `pageSize: 6`).
- `search(term, { page, pageSize })` returns `Page<SearchHit>`.

### 3.2 Components

- **`<Pagination>`** (server component). Props: `page`, `totalPages`,
  `searchParams` (current params). Renders `<Link>`s that rewrite only `page`
  while preserving all other params: `‹ Prev  1 2 … N  Next ›`. A windowed range
  around the current page; disabled Prev/Next at the ends.
- **`<Filters>`** (native `<form method="get">`, no client JS). Slots:
  - herb `<select>` (options from `listHerbs`, unpaginated small set)
  - district `<select>` (options from the province's districts)
  - symptom / `query` `<input type="text">`
  Submitting navigates to the same page with the chosen params in the URL; the
  RSC re-renders. A "clear" link resets to the bare path. Only the filters
  relevant to a given page are rendered.

Native GET form is chosen over a client component deliberately — it is the
platform feature that already does this (ladder rung 4), needs zero JS, and
degrades perfectly.

### 3.3 Pages

Each public list page (`/herbs`, `/remedies`, `/treatment-cases`, and the
per-entity nested lists) and `/search`:

1. reads `searchParams` (async in Next 16) for `page`/`pageSize`/filters,
2. calls the paginated api function,
3. renders `<Filters>` (where applicable) + the card grid + `<Pagination>`.

The N+1 cover-photo fetch per item is **mitigated** (now bounded by `pageSize`)
but not refactored — see Deferred.

`/search` renders a single merged list; each row shows a type badge and links to
`/remedies/{id}`, `/healers/{id}`, or `/herbs/{id}`.

## 4. Edge cases

| Case | Behaviour |
|------|-----------|
| `page` negative / non-numeric | clamp to 1 |
| `pageSize` over cap / non-numeric | cap 48 / default |
| `page` beyond `totalPages` | 200, correct metadata, `items: []` |
| empty result set | `total: 0`, `totalPages: 1`, `items: []` |
| filter matches nothing | empty page (as above) |
| search term < 2 runes | 400 (unchanged) |
| unknown `herbId`/`districtId` | valid filter, empty result |

## 5. Testing (TDD)

- **Repo (testcontainers, real Postgres):** offset windows, `Count*` matches
  filtered set, each filter (herbId, districtId, symptom, herb query), merged
  search ordering + count + pagination boundary.
  Host quirk: `TESTCONTAINERS_RYUK_DISABLED=true`.
- **Use case:** params → `listing.Page` mapping, filter pass-through, nil-filter
  vs set-filter branches.
- **Handler:** param parse/clamp/cap, envelope shape, filter query wiring, search
  DTO, short-term 400.
- **Frontend (Vitest + RTL):** `<Pagination>` link targets preserve params and
  window correctly; `<Filters>` form emits the right query; each page renders
  grid + pagination from a mocked `Page<T>`.
- `pnpm lint` and `pnpm build` (type-check) stay clean.

## 6. Deferred (add when the ceiling is hit)

- Cursor / infinite / "load more" pagination — add if row counts reach the
  thousands or deep-offset scans get slow.
- Per-type search weight tuning — add if merged ordering feels wrong in use.
- Faceted filter counts ("Herbs (12)") — add when filters need affordance.
- Photo batch endpoint (`GET /photos?ownerType=&ownerId=1,2,3`) to kill the N+1
  — add when page render latency shows it.
- `/districts` pagination — add when a province exceeds ~30 districts.

## 7. Files touched (indicative)

Backend:
- new `internal/domain/listing/listing.go`
- `internal/usecase/{remedy,herb,treatmentcase,healer}/…` list methods + params
- `internal/usecase/search/service.go` (union query path)
- `internal/adapter/repository/query/*.sql` (+ `Count*`, `SearchAll`) → `sqlc generate`
- `internal/adapter/repository/*_repo.go`
- `internal/adapter/http/{remedy,herb,treatment_case,healer,search}_handler.go`,
  `helpers.go` (+ `parsePage`, `pageDTO`, `toPageDTO`)

Frontend:
- `src/lib/api.ts`
- new `src/components/Pagination.tsx`, `src/components/Filters.tsx`
- `src/app/{herbs,remedies,treatment-cases,search}/page.tsx`,
  `src/app/herbs/[id]`, `src/app/healers/[id]`, `src/app/remedies/[id]` nested
  lists, `src/app/page.tsx` (home strips)

Docs: `CONTEXT.md` (API contract + envelope), and this spec.

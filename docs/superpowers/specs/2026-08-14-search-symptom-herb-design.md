# Design — Search by Symptom or Herb

## Purpose

Let the public find folk-medicine records by typing a symptom or a herb (or a
healer name). One search box returns matching **remedies** and **healers**.
The match must work well with Thai text.

## Why not standard full-text search

Postgres `to_tsvector`/`tsquery` segment text into words by spaces and
language dictionaries. Thai writes without spaces between words, so the default
full-text search matches Thai poorly.

The design uses the **`pg_trgm`** extension instead. It matches on character
trigrams, so it is language-agnostic and good for Thai. It gives fuzzy,
typo-tolerant matching and ranks results with `similarity()`. A GIN trigram
index makes substring lookup fast.

## Searched fields

- **Remedy:** `name`, `symptoms`, `ingredients`
- **Healer:** `full_name`, `specialty`, `biography`, `sub_district`

## Backend (Clean Architecture)

Search reads two aggregates. Each aggregate owns its own search. A thin use
case composes them. Search is read only, so it publishes no events.

### Domain

- Add `Search(ctx, term string) ([]SearchResult, error)` to
  `remedy.Repository`. `SearchResult` holds the remedy fields plus `HealerID`
  and `HealerFullName`, so the UI can show context and link to the healer.
- Add `Search(ctx, term string) ([]Healer, error)` to `healer.Repository`.

### Usecase (`usecase/search`)

- New `Service` with `Search(ctx, term) (Result, error)`.
- `Result { Remedies []remedy.SearchResult; Healers []healer.Healer }`.
- Depends only on `remedy.Repository` and `healer.Repository`.
- Guard: trim the term; if it is shorter than 2 characters, return a domain
  validation error (short terms make trigram noise).

### Repository (Postgres, sqlc)

- `SearchRemedy`: select remedy columns, join `healer` for `healer_full_name`,
  filter with `ILIKE '%' || $1 || '%'` across the three remedy columns, order by
  the greatest `similarity()` across those columns, descending.
- `SearchHealer`: same pattern over the four healer columns.
- The term is always a bound parameter (no SQL injection).

### Migration

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX remedy_name_trgm        ON remedy USING gin (name gin_trgm_ops);
CREATE INDEX remedy_symptoms_trgm    ON remedy USING gin (symptoms gin_trgm_ops);
CREATE INDEX remedy_ingredients_trgm ON remedy USING gin (ingredients gin_trgm_ops);
CREATE INDEX healer_full_name_trgm   ON healer USING gin (full_name gin_trgm_ops);
CREATE INDEX healer_specialty_trgm   ON healer USING gin (specialty gin_trgm_ops);
CREATE INDEX healer_biography_trgm   ON healer USING gin (biography gin_trgm_ops);
CREATE INDEX healer_sub_district_trgm ON healer USING gin (sub_district gin_trgm_ops);
```

## HTTP endpoint

- `GET /api/v1/search?searchTerm=<q>` — public. Full-English route and
  parameter names, per project rule.
- Validation: trim `searchTerm`. Empty or shorter than 2 characters → `400`
  with a clear message. No matches → `200` with empty arrays.
- Response:

```json
{
  "remedies": [
    { "id": 1, "name": "...", "symptoms": "...", "ingredients": "...",
      "healerId": 2, "healerFullName": "..." }
  ],
  "healers": [
    { "id": 2, "fullName": "...", "specialty": "...", "subDistrict": "...",
      "districtId": 3 }
  ]
}
```

## Frontend (Next.js, RSC)

- New public route `/search`. A search box is a plain
  `<form method="get" action="/search">` with `input name="searchTerm"`. No
  client JavaScript; the server component renders the results.
- Results in two labelled groups — remedies and healers — reusing
  `RecordCard`. Remedy cards link to `/remedies/{id}`; healer cards link to
  `/healers/{id}`.
- Empty term → show only the box. No matches → `EmptyState`.
- Add a small search box to the site header, so search is reachable from every
  page.
- `lib/api.ts` gets a `search(term)` function that reads through the existing
  `/api` proxy (public read path — no BFF or JWT needed).

## Error handling

- Backend: empty/short term → 400; database error → 500, following the existing
  handler error pattern.
- Frontend: if the API call fails, the server component shows `EmptyState` with
  an error message, consistent with the other pages.

## Testing (TDD, mandatory)

- **Repository (testcontainers):** seed remedies and healers; assert Thai and
  English substring matches, ranking order, and that non-matches are excluded.
- **Usecase:** fake repositories; assert composition and the short-term guard.
- **Handler:** 400 on a short term; 200 response shape on hits and misses.
- **Frontend:** Vitest for the `search()` client and for the results page
  (hits, no hits, both groups).

## Out of scope

- Filters (by district, by field). Search is one free-text box.
- Pagination. Result counts are small at current scale; add later if needed.
- Highlighting matched terms in results.

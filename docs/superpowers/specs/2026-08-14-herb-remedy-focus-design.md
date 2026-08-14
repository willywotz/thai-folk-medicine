# Herb + Remedy Focus — Design Spec

Date: 2026-08-14
Status: Approved (brainstorming)

## 1. Purpose

The app changes its focus. Today the public browse starts from a place:
district → healer → remedy → case. This is place-first.

The new focus is the medicine, not the place. The public must find remedies and
herbs first. A herb becomes a real record. A user can read a herb profile and see
every remedy that uses that herb.

Healers and districts stay. They give attribution ("who recorded this remedy, and
where"). They move to a lower level. They are no longer the first thing the public
sees.

## 2. Decisions (from brainstorming)

1. **Scope:** add a Herb entity AND make the public site remedy/herb-first ("Both").
2. **Healer / district:** keep them as context. A remedy still belongs to a healer
   in a district. Healer and district pages still work. They are demoted, not deleted.
3. **Ingredients:** go fully structured. Remove the free-text `ingredients` field on
   a remedy. A remedy links to herbs through a join table with an amount per herb.
4. **Herb fields (rich):** Thai name, English name, scientific (Latin) name,
   properties, description, and a photo.
5. **Public home:** a search box at the top, then three sections in this order —
   Herbs (a grid with photos), recent Remedies, recent Cases. Each section has a
   "see all →" link.
6. **Old data:** reseed. The data is demo/seed data and the app is not deployed. The
   migration drops the `ingredients` column. The seed command rebuilds herbs and
   remedy–herb links.

## 3. Architecture rule

Keep every project rule:
- Clean Architecture: `domain ← usecase ← adapter / platform`.
- 15-Factor and event-driven (every write publishes a domain event).
- Full English names for API routes, all under `/api/v1`.
- TDD for every unit.

The Herb aggregate copies the shape of the existing aggregates (healer, remedy,
treatment case): domain entity + repository interface + events, a use-case service,
a Postgres repository with sqlc queries, and HTTP handlers with DTOs.

## 4. Data model

### 4.1 New table `herb`

| column          | type        | note                          |
|-----------------|-------------|-------------------------------|
| id              | bigint PK   | identity                      |
| name_thai       | text        | required                      |
| name_english    | text        | default ''                    |
| scientific_name | text        | default '' (Latin name)       |
| properties      | text        | default '' (medicinal use)    |
| description     | text        | default ''                    |
| created_at      | timestamptz | default now()                 |
| updated_at      | timestamptz | default now()                 |

### 4.2 New join table `remedy_herb`

| column    | type      | note                              |
|-----------|-----------|-----------------------------------|
| remedy_id | bigint FK | → remedy(id)                      |
| herb_id   | bigint FK | → herb(id)                        |
| amount    | text      | default '' (e.g. "2 กำมือ")       |
| position  | int       | default 0 (keeps a stable order)  |

Primary key `(remedy_id, herb_id)`. Index on `herb_id` for "remedies that use this
herb". A herb that is still linked to a remedy cannot be deleted (maps the FK
violation to `ErrReferenced`, the same pattern as healer and remedy).

### 4.3 Changed table `remedy`

- Drop the `ingredients` column.
- A remedy's ingredients are now its linked herbs (with amounts).

### 4.4 Photo owner type

Add `"herb"` to the valid photo owner types (`healer | remedy | case | herb`). A herb
can have one photo, the same way other records do.

### 4.5 Migrations

- `000009_create_herb`
- `000010_create_remedy_herb` — creates the join table and drops `remedy.ingredients`.
- `000011_update_search_index` — the current search index (migration `000008`) uses
  `remedy.ingredients`. Rebuild it without that column. Add a trigram index on herb
  names so a search can match a herb.

## 5. Backend

### 5.1 Domain

- `domain/herb`: `Herb` entity, `CreateParams`, `UpdateParams`, `Repository`
  interface, events `herb.created` / `herb.updated` / `herb.deleted`, and
  `ErrReferenced`.
- `domain/remedy`: replace `Ingredients string` with a herb-link list.
  - On write: `Herbs []HerbRef` where `HerbRef = { HerbID int64; Amount string }`.
  - On read: a richer list that also carries the herb Thai/English name for display.

### 5.2 Use case

- `HerbService`: create, read, list, update, delete. Publishes the herb events.
- `RemedyService`: create and update now also write the `remedy_herb` links. The
  repository writes the remedy and its links in one transaction (the remedy aggregate
  owns its links).

### 5.3 Repository (sqlc)

- Herb queries: create, get by id, list, update, delete.
- Remedy–herb queries: replace the links of a remedy, list herbs of a remedy, list
  remedies of a herb.
- Recent queries: list recent remedies, list recent treatment cases (for the home
  page and the "see all" pages).

### 5.4 HTTP routes (all full English, under `/api/v1`)

Public (read):
- `GET /api/v1/herbs` — list herbs (for the home grid and `/herbs`).
- `GET /api/v1/herbs/{herbId}` — one herb profile.
- `GET /api/v1/herbs/{herbId}/remedies` — remedies that use the herb.
- `GET /api/v1/remedies` — recent remedies (limit query), for home + "see all".
- `GET /api/v1/treatment-cases` — recent cases (limit query), for home + "see all".

Staff (write, behind JWT):
- `POST /api/v1/herbs`
- `PUT /api/v1/herbs/{herbId}`
- `DELETE /api/v1/herbs/{herbId}`

Remedy write DTOs change: the request carries a herb list (`herbId` + `amount`)
instead of an `ingredients` string. The remedy read DTO returns the linked herbs.

### 5.5 Events

`cmd/api` subscribes the audit handler to `herb.created`, `herb.updated`, and
`herb.deleted`, the same way it does for the other aggregates.

## 6. Public frontend (Next.js)

### 6.1 Home page (`/`)

- Search box at the top (reuse `SearchBox`).
- **Herbs** section: a grid of herb cards (photo + Thai/English name). "See all →"
  goes to `/herbs`.
- **Remedies** section: recent remedies. "See all →" goes to `/remedies`.
- **Cases** section: recent treatment cases. "See all →" goes to a case list.
- A small secondary link "browse by district (อำเภอ)" keeps the old place-first path.

### 6.2 New / changed pages

- `/herbs` — all herbs.
- `/herbs/[herbId]` — herb profile: names, scientific name, properties, description,
  photo, and the list of remedies that use it.
- `/remedies` — recent / all remedies.
- `/treatment-cases` — recent / all cases (the "see all →" target of the home Cases
  section).
- Remedy detail page: show the structured herb list (each herb links to its profile,
  with the amount) in place of the old free text. Still show "recorded by healer X ·
  district Y" as context.
- `/districts` pages stay, reached from the secondary link, not the home hero.

### 6.3 Search

Add a **Herbs** result group to the search page. The backend search matches herb
names as well as remedy fields.

## 7. Staff admin

- New Herb admin at `/staff/herbs`: list, create, edit, delete. Form covers the rich
  fields and a photo upload.
- Remedy form: replace the ingredients textarea with a **herb picker** — choose one or
  more herbs and set an amount for each.

## 8. Seed

- `cmd/seed`: turn the herb name pool into real `herb` rows with the rich fields. Link
  each remedy to two to four herbs through `remedy_herb`, with a random amount. Give a
  few herbs a placeholder photo.
- After the migration drops `ingredients`, run `docker compose --profile seed run --rm
  seed -reset` to rebuild the demo data.

## 9. Out of scope (add later)

- Herb categories or tags.
- Herb–symptom links (which herb treats which symptom) as structured data.
- Amount as a structured quantity + unit (kept as free text for now).
- Search filters (by district, by field) and pagination — already deferred.

## 10. Test plan

- Backend: unit tests for the herb use case and repository (testcontainers), and for
  the changed remedy write (herb links written and read back). Search test covers a
  herb-name match.
- Frontend: Vitest for the herb schema, the herb admin form and list, the herb picker
  in the remedy form, and the new home sections.

## 11. Suggested build order (for the plan)

1. Backend Herb aggregate (table, domain, sqlc, repo, use case, events, CRUD routes).
2. `remedy_herb` join + remedy write/read rework + drop `ingredients` + search-index
   migration.
3. Recent-list endpoints (`GET /remedies`, `GET /treatment-cases`).
4. Public frontend: home sections, `/herbs`, herb profile, remedy detail rework,
   district demotion.
5. Search: herb group on the search page + backend herb matching.
6. Staff admin: herb CRUD + herb picker in the remedy form.
7. Seed rework + reseed.

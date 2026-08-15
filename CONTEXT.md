# CONTEXT

This project is a web app. It keeps Thai folk-medicine records (ตำรายาหมอพื้นบ้าน)
for one province. It groups all data by district (อำเภอ). The app saves the
knowledge of local healers, and it shows the knowledge to the public.

First province: **Yasothon** (ยโสธร). The design allows more provinces later.

## Architecture

- **Backend:** Go API (`backend/`), Clean Architecture, 15-Factor, event-driven.
- **Frontend:** Next.js (`frontend/`), App Router, public browse (server-rendered).
- **Database:** PostgreSQL.

Dependencies point inward: `domain` ← `usecase` ← `adapter` / `platform`.
Gin, pgx, and sqlc code stay only in the outer layers.

## Domain model

`Province (1) → District (1) → Healer (1) → Remedy (1) → Case`.
`Herb ↔ Remedy` is many-to-many through `remedy_herb` (with a per-link amount); a
remedy's ingredients ARE its linked herbs (the free-text `ingredients` field is gone).
Photos attach to healer, remedy, case, or herb. Staff log in to write; the public reads.
Patient data in a case holds only age and sex (PDPA-safe).

## Backend layout

```
backend/
├── cmd/api/main.go                     # server start: config → migrate → wire → run
├── cmd/seed/                           # demo-data command: generated healers/remedies/cases/photos
├── internal/
│   ├── domain/
│   │   ├── location/                   # Province, District, Repository interface
│   │   ├── healer/                     # Healer entity, events, ErrReferenced
│   │   ├── remedy/                     # Remedy entity + HerbRef/HerbLink, events, ErrReferenced
│   │   ├── herb/                        # Herb entity (rich: names, scientific, properties), events
│   │   ├── treatmentcase/              # TreatmentCase entity, events (age+sex only)
│   │   ├── staff/                      # Staff (login) entity, Repository
│   │   ├── photo/                      # Photo entity, Store port, events
│   │   └── event/                      # pure Event port (EventName)
│   ├── usecase/                        # Location/Healer/Remedy/TreatmentCase/Auth/Photo services
│   ├── adapter/
│   │   ├── http/                       # Gin router (public + JWT-protected groups), handlers
│   │   └── repository/                 # Postgres repo + sqlc-generated db/
│   └── platform/
│       ├── config/                     # env config (caarlos0/env)
│       ├── database/                   # pgx pool + golang-migrate
│       ├── eventbus/                   # in-process event bus (slog audit)
│       ├── token/                      # JWT manager (golang-jwt, HS256)
│       └── photostore/                 # local-disk photo Store (S3 later)
├── migrations/                         # SQL + Yasothon seed
└── sqlc.yaml
```

## Tech stack

- **Backend:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, caarlos0/env, log/slog,
  testify, testcontainers-go.
- **Frontend:** Next.js App Router + TypeScript, Tailwind. Public browse = server-rendered.
  Staff admin = shadcn/ui + TanStack Query + react-hook-form + zod, with a **BFF** layer
  (`/bff/*` route handlers) that turns the httpOnly `session` cookie into a `Bearer`
  header for the Go API. (Auth is Server-Action-free: BFF route handlers + TanStack Query.)
- **Auth:** golang-jwt (HS256) + bcrypt, one staff type. Token kept in an httpOnly cookie.

## Frontend layout (`frontend/`)

```
frontend/
├── next.config.ts                      # /api/* proxy → Go API (INTERNAL_API_URL)
├── src/
│   ├── proxy.ts                        # route guard: /staff/* needs session cookie (Next 16 middleware)
│   ├── app/
│   │   ├── page.tsx                    # public home: Yasothon districts
│   │   ├── districts/ healers/ remedies/   # public browse pages
│   │   ├── login/                      # staff login
│   │   ├── staff/                      # guarded: six flat sections — dashboard, provinces (+districts CRUD), healers, remedies, cases, herbs
│   │   ├── bff/session/                # POST login / DELETE logout (sets httpOnly cookie)
│   │   ├── bff/healers/                # POST / [healerId] PUT·DELETE (cookie → Bearer → Go)
│   │   └── layout.tsx                  # Thai font shell (Noto Sans Thai) + TanStack Query Providers
│   ├── components/                     # public: RecordCard, Breadcrumb, …; staff shell: StaffNavLink, StaffPageHeader, staff-ui (brand class tokens); staff CRUD: HealerAdminList, HealerForm, LogoutButton
│   │   └── ui/                         # shadcn/ui primitives
│   └── lib/                            # api.ts, api-types.ts, format.ts, session.ts, bff-forward.ts, staff-queries.ts, *-schema.ts
└── vitest.config.ts                    # Vitest + RTL (jsdom)
```

## Current state — Plan 1 + Plan 2 + Plan 3 + Plan 4 (backend) + Plan 5 (public frontend) done

**Plan 1 — backend foundation + location browse (public read):**
- Config from environment; `GET /health`.
- Postgres pool + migrations; seed = 1 province (Yasothon) + 9 districts.
- `GET /api/v1/provinces`
- `GET /api/v1/provinces/{provinceId}/districts`
- `GET /api/v1/districts/{districtId}` (public; 404 if the district is unknown)

**Plan 2 — healer + in-process event bus:**
- Event port (`domain/event`) + in-process bus (`platform/eventbus`); an audit
  handler logs each event.
- Healer aggregate: domain, migration `000003_create_healer`, sqlc queries, repository.
- Healer use case validates input and publishes `healer.created` / `healer.updated` /
  `healer.deleted` after each successful write.
- Endpoints:
  - `GET /api/v1/districts/{districtId}/healers` (public)
  - `GET /api/v1/healers/{healerId}` (public)
  - `POST` / `PUT /api/v1/healers/{healerId}` / `DELETE /api/v1/healers/{healerId}` (staff write)

**Plan 3 — remedy + treatment case:**
- Remedy aggregate (belongs to a healer): domain, migration `000004_create_remedy`,
  sqlc, repository, use case (events `remedy.created/updated/deleted`).
  - `GET /api/v1/healers/{healerId}/remedies`, `GET /api/v1/remedies/{remedyId}` (public)
  - `POST` / `PUT` / `DELETE /api/v1/remedies/{remedyId}` (staff write)
- Treatment Case aggregate (belongs to remedy + healer): domain, migration
  `000005_create_treatment_case`, sqlc, repository, use case (events
  `treatmentcase.created/updated/deleted`). Patient data = **age + sex only** (PDPA-safe).
  `treatedOn` is an ISO date string (`2006-01-02`) at the API.
  - `GET /api/v1/remedies/{remedyId}/treatment-cases`, `GET /api/v1/treatment-cases/{treatmentCaseId}` (public)
  - `POST` / `PUT` / `DELETE /api/v1/treatment-cases/{treatmentCaseId}` (staff write)
- Deleting a referenced healer or remedy returns **409** (domain `ErrReferenced`,
  from a shared FK-violation helper), not 500.

**Plan 4 — auth (JWT) + photos:**
- Staff aggregate + `platform/token` JWT manager (HS256) + `AuthService` (bcrypt).
  - `POST /api/v1/authentication/login` → returns a JWT.
- **Every write route (healer/remedy/treatment-case/photo POST·PUT·DELETE) is now
  behind JWT middleware.** Public GET routes and login stay open. The Plan 2–3
  security gap is **closed**.
- First staff user: env bootstrap (`STAFF_ADMIN_USERNAME`/`STAFF_ADMIN_PASSWORD`),
  created only when the table is empty; no default password.
- Photo aggregate: `Store` port + local-disk store (path-traversal guarded),
  migration `000007_create_photo` (polymorphic owner: healer|remedy|case), repository,
  use case (events `photo.created`/`photo.deleted`).
  - `POST /api/v1/photos` (multipart upload, guarded), `DELETE /api/v1/photos/{photoId}` (guarded),
    `GET /api/v1/photos/{photoId}` (public — serves the image).

Full test suite green (unit + testcontainers integration). Whole-branch review: **SHIP**.

**The backend API is feature-complete.** New required env vars: `JWT_SECRET`,
`PHOTO_STORAGE_DIR` (default `./storage/photo`), `STAFF_ADMIN_USERNAME`,
`STAFF_ADMIN_PASSWORD`. Photo storage is local disk (`withinlazy`: not multi-instance
safe; swap the `photo.Store` for S3/MinIO before horizontal scaling).

**Plan 5 — public frontend (Next.js):**
- Server-rendered public browse: home (districts) → district (healers) → healer
  (remedies) → remedy (treatment cases). Thai typography, breadcrumbs, empty/not-found
  states. Photos render via `GET /api/v1/photos/{id}` through the `/api` proxy.
- Public browse is read-only; no login. Run: `cd frontend && INTERNAL_API_URL=http://localhost:8080 pnpm dev` (with the API up).
- The public header carries a "สำหรับเจ้าหน้าที่" (staff) link to `/staff`; the `proxy.ts`
  guard sends visitors without a session cookie on to `/login`, and sends logged-in
  visitors who hit `/login` on to `/staff`. The staff link uses `prefetch={false}` so each
  click revalidates against the guard with the current cookie (a prefetched auth-gated link
  otherwise caches the redirect from whichever auth state existed at prefetch time).
- `withinlazy`: no photo-gallery-by-owner (needs a backend `GET /{owner}/{id}/photos`
  endpoint). The staff district page shows the real district name via `GET /districts/{id}`.

**Plan 6 — staff admin (auth + healer management):**
- Staff log in at `/login`; the JWT is kept in an httpOnly `session` cookie set by the
  `/bff/session` route handler. `src/proxy.ts` guards `/staff/*`.
- Staff dashboard → pick a district → list/create/edit/delete healers. Writes go through
  `/bff/healers*` route handlers that attach the `Bearer` token server-side (the token
  never reaches the browser). TanStack Query drives the list + mutations; react-hook-form
  + zod validate the forms.
- `STAFF_ADMIN_USERNAME`/`STAFF_ADMIN_PASSWORD` (backend env) bootstrap the first login.
- Vitest + RTL cover schemas, the API/staff client, and every component/form.

**Plan 7 — staff admin for remedies + treatment cases:**
- Same BFF + TanStack Query + rhf/zod pattern, extended to the remaining record types.
- From the staff healer list → **Remedies** → list/create/edit/delete a healer's remedies
  (`/bff/remedies*`); a remedy → **Cases** → list/create/edit/delete its treatment cases
  (`/bff/treatment-cases*`). Case form uses native `<input type="date">` for `treatedOn`
  and a number input for patient age (coerced, ≥ 0).
- Deleting a remedy that still has cases surfaces a 409 error (no silent failure).

**Plan 8 — photo management (backend list + staff upload UI):**
- Backend: new public `GET /api/v1/photos?ownerType={healer|remedy|case}&ownerId={id}`
  (list photo metadata by owner; validates owner type; no object key leaked).
- Frontend: a `PhotoManager` (gallery + upload + delete) embedded on each staff **edit**
  page (healer / remedy / case). Upload is a multipart POST through `/bff/photos` (the
  BFF forwards the FormData with the Bearer token server-side — the token never reaches
  the browser); delete via `/bff/photos/{id}`. Images serve via public `GET /api/v1/photos/{id}`.
- Upload/delete failures (incl. the 10 MiB 413 cap) are surfaced. The `withinlazy`
  list-photos gap from Plan 5 is now closed.

**Plan 9 — search by symptom or herb:**
- Full-text search that works with **Thai**, using the Postgres **`pg_trgm`** extension
  (character trigrams — language-agnostic, no word segmentation) instead of `to_tsvector`,
  which cannot segment Thai. Migration `000008_add_search_index` adds the extension + GIN
  trigram indexes on the searched columns.
- Searches **remedies** (name, symptoms, ingredients) and **healers** (full name,
  specialty, biography, sub-district). `SearchRemedy` joins healer for `healer_full_name`;
  results rank by trigram `similarity()`.
- `usecase/search` composes two consumer-side reader interfaces (not added to the aggregate
  `Repository` interfaces); read-only (no events). Minimum term = **2 runes**
  (`utf8.RuneCountInString`, not byte length).
  - `GET /api/v1/search?searchTerm={q}` (public) → `{ remedies:[…], healers:[…] }`.
    Term shorter than 2 runes → **400**.
- Frontend: a `/search` server-rendered page with two result groups (remedies →
  `/remedies/{id}`, healers → `/healers/{id}`) and a `SearchBox` in the site header.

**Plan 10 — herb + remedy focus:**
- **Herb is now a first-class entity** (rich: Thai/English/scientific name, properties,
  description; photos via owner type `herb`). Migration `000009_create_herb`. Full aggregate
  (domain/usecase/repo/HTTP + `herb.created/updated/deleted` events), mirroring healer.
  - `GET /api/v1/herbs`, `GET /api/v1/herbs/{herbId}`, `GET /api/v1/herbs/{herbId}/remedies`
    (public); `POST`/`PUT`/`DELETE /api/v1/herbs...` (staff).
- **Remedies link to herbs** many-to-many via `remedy_herb(remedy_id, herb_id, amount,
  position)` (migration `000010`). The free-text `remedy.ingredients` column is **dropped**;
  ingredients ARE the linked herbs. The remedy repository writes a remedy + its links in one
  **transaction** (uses `NewRemedy(pool)`); a herb still linked to a remedy cannot be deleted
  (→ `herb.ErrReferenced`), deleting a remedy cascades its links.
- **Recent-list endpoints** for the home page: `GET /api/v1/remedies?limit=`,
  `GET /api/v1/treatment-cases?limit=` (public).
- **Search** gained a **herb** result group and now matches linked herb names (join).
  Remedy search ranks by trigram `similarity()`: `GROUP BY` the remedy (the herb join is
  one-to-many), then `ORDER BY GREATEST(similarity(name), similarity(symptoms),
  max(similarity(herb name_thai)), max(similarity(herb name_english))) DESC, name`.
- **Public site is remedy/herb-first:** home = search box → Herbs grid → recent Remedies →
  recent Cases (each "see all →"), plus a secondary "browse by district" link. New pages
  `/herbs`, `/herbs/{id}` (profile + remedies using it), `/remedies`, `/treatment-cases`,
  `/districts`. Remedy detail shows the linked herb list (name → `/herbs/{id}`, with amount)
  and keeps "recorded by healer · district" context.
- **Staff:** `/staff/herbs` CRUD (+ `bff/herbs*`); the remedy form uses a **herb picker**
  (herb + amount rows) instead of an ingredients textarea. Each row selects its herb with a
  searchable **Base UI `Combobox`** (`@base-ui/react`, already a dependency) — type to filter
  by Thai name; a new row still defaults to the first herb.
- **Seed:** `cmd/seed` seeds 12 curated herbs and links each remedy to 2–4 herbs.

**Plan 11 — pagination & merged search** (supersedes the `?limit=` recent
endpoints and the three-group search above):
- **Uniform paginated envelope.** Every public list endpoint now returns
  `{ items, page, pageSize, total, totalPages }`. Query params `page` (1-indexed, `<1`→1) and
  `pageSize` (default 12 for lists / 20 for search, capped at 48) are parsed by a shared
  helper; `totalPages = max(1, ceil(total/pageSize))`; a page past the end returns valid
  metadata with empty `items`. Kernel: `internal/domain/listing` (`Params{Limit,Offset}`,
  `Page[T]{Items,Total}`) — pure Go, imported by every list use case; each sqlc list query
  gained a matching `Count*` with an identical `WHERE`.
  - **Consumers must unwrap the envelope.** The staff admin `fetch*` helpers in
    `lib/staff-queries.ts` return `.items` via a shared `fetchList` that asks for
    `pageSize=48` (the max) so a whole list shows at once. `withinlazy:` add real staff
    pagination if any single list can exceed 48 rows. (`fetchPhotos` is exempt — the photo
    list endpoint returns a bare array, not the envelope.)
- **Endpoints** (all `/api/v1`, existing routes — `?page&pageSize` added; `?limit=` removed).
  Note: list *filters* (remedy by herb/district/symptom, herb by name) were designed and
  built, then **removed by decision** — only pagination remains on these lists:
  - `GET /remedies?page&pageSize` (recent order); `GET /herbs?page&pageSize` (name order);
  - `GET /treatment-cases?page&pageSize`; `GET /districts/{id}/healers?page&pageSize`;
    `GET /herbs/{id}/remedies`, `GET /healers/{id}/remedies`,
    `GET /remedies/{id}/treatment-cases` — all `?page&pageSize`.
- **Merged search.** `GET /api/v1/search?searchTerm&page&pageSize` now returns ONE
  relevance-ranked paginated list: `Page[SearchHit]` where
  `SearchHit = { type: "remedy"|"healer"|"herb", id, title, subtitle, score }`. Backed by a
  single SQL `UNION ALL` over the three entities ranked by trigram `similarity()` (`::real`
  score), `ORDER BY score DESC, type, id` (deterministic paging). Cross-type scores are
  uncalibrated (`withinlazy:` — add per-type weights if ordering needs tuning). The 2-rune
  minimum (`ErrTermTooShort` → 400) is unchanged.
- **Frontend (RSC/SSR, zero new client JS).** `lib/api.ts` list functions take
  `{page,pageSize}` and return `Page<T>`. New `<Pagination>` server component (URL `?page=`
  links that preserve other params). Every public list page reads `searchParams` and renders
  grid + pagination; `/search` renders the merged list with a per-row type badge linking to
  the matching detail page.
- **Reads publish no domain events** — pagination/search touch no event code, by design.

**The planned scope is complete:** backend API, public browse site (remedy/herb-first,
paginated), and full staff admin (healers, remedies, herbs, treatment cases, and photos) all
work end to end. Public search is one merged, ranked, paginated result list.

**Plan 12 — staff-zone redesign (frontend only, no API/behavior change):**
- The staff zone now uses the same brand palette as the public site (the `--brand`/`--ink`/
  `--line`/`--surface` tokens in `globals.css`) instead of raw `stone-*` greys.
- **Shell:** `staff/layout.tsx` is a sidebar (brand mark + `Records` nav: Districts, Herbs +
  logout), not a thin top bar. `StaffNavLink` (client, `usePathname`) marks the active
  section via `aria-current`; it matches by path prefix (Districts owns `/staff/districts`,
  `/staff/healers`, `/staff/remedies`).
- **`StaffPageHeader`** renders the shared page head: breadcrumb (reuses `Breadcrumb`) +
  eyebrow + serif title. Every staff list/form page passes `crumbs` built from ancestor names
  (list/new/edit pages fetch the parent via existing `getDistrict`/`getHealer`/`getRemedy` so
  the crumb links back up the District→Healer→Remedy→Case chain).
- **`staff-ui.ts`** holds the shared brand class strings (`staffCard`, `staffField`,
  `staffLabel`, `btnPrimary`, `btnGhost`, `iconBtn`, `iconBtnDanger`, `linkAction`) reused by
  all four admin lists and forms. Lists became branded rows (initial badge, count line, one
  primary `+ New`, icon Edit/Delete with `aria-label`, delete tinted red on hover only). Forms
  became a single branded surface panel with brand focus rings.
- Accessible names/labels and copy are unchanged, so the existing component/form tests still
  pass; `StaffNavLink` adds its own test. `withinlazy:` the `ui/` shadcn primitives map to the
  grayscale `--primary` tokens, so the staff zone styles with `--brand` tokens directly rather
  than adopting them.

**Plan 13 — staff workspace: entity sections, location CRUD, activity feed:**
(Spec `docs/superpowers/specs/2026-08-15-staff-workspace-sections-design.md`; plan
`docs/superpowers/plans/2026-08-15-staff-workspace-sections.md`. Domain model UNCHANGED —
District 1:n Healer stays.)
- **Six flat sections** replace the nested District→Healer→Remedy→Case drill-down. Sidebar:
  Dashboard `/staff`, Province `/staff/provinces`, Healer `/staff/healers`, Remedy
  `/staff/remedies`, Case `/staff/cases`, Herb `/staff/herbs`. The old
  `/staff/districts/**`, `/staff/healers/[id]/remedies/**`, `/staff/remedies/[id]/treatment-cases/**`
  routes are gone. Each list is flat + parent **filter**; each create/edit form has a parent
  **picker** (healer→district, remedy→healer, case→remedy). Parent name shown via a
  server-fetched lookup list passed to the client component.
- **Activity feed (event-driven read model).** The bus gained `SubscribeAll`; a
  `usecase/audit.Recorder` subscribes to every event and records `{event_name, payload}` to a
  new `event_log` table (migration `000011`). `GET /api/v1/activity?page&pageSize` (protected)
  returns the newest-first envelope; the dashboard's `ActivityFeed` maps `eventName`→verb +
  payload→title via `lib/activity-format.ts`. `withinlazy:` `event_log` is unpruned.
- **Dashboard** (`/staff`): six count tiles from `GET /api/v1/stats` (protected; new
  `StatsService` aggregating per-entity counts) + the activity feed. Both are client
  components hitting the **BFF** (`/bff/activity`, `/bff/stats`) because activity/stats are
  JWT-guarded.
- **Province & District CRUD.** `LocationService` gained a `Publisher`; province/district
  create/update/delete publish `province.*`/`district.*` events and record to `event_log`.
  Routes: `GET /provinces/:id` (public); `POST/PUT/DELETE /provinces`, `POST/PUT/DELETE
  /districts` (protected). Delete guards: province with districts → 409
  (`ErrProvinceReferenced`), district with healers → 409 (`ErrDistrictReferenced`), each with an
  FK backstop. Managed under the Province section (districts inline on the province detail page).
- **Flat `GET /api/v1/healers?districtId=&page&pageSize`** (public) added — the only entity
  that lacked a flat list. Remedy/Case flat lists reuse the existing `/remedies` /
  `/treatment-cases`; the staff filter branches to `/healers/{id}/remedies` etc. when a parent
  is selected. `withinlazy:` parent pickers load `pageSize=48` — a >48-parent province truncates.
- **Reassignment fix.** `PUT /remedies/:id` now persists `healer_id`, and `PUT
  /treatment-cases/:id` persists `remedy_id`+`healer_id`, so the new edit forms' parent pickers
  actually save (update validation now matches create).
- New frontend: `bff/{provinces,districts,activity,stats}` routes; `staff-queries` flat
  fetchers + province/district mutations; `DashboardStats`, `ActivityFeed`, `Province/District
  Form`+`AdminList`. Built TDD; full backend suite + `tsc`/`lint`/`vitest`/`build` green.
- **Polish:** each staff list has a client-side name `StaffSearch` (filters the loaded ≤48
  rows). Healer/Remedy lists show a parent-name column but no parent filter. Remedy/Case forms
  pick their parent via a searchable `EntityCombobox` (Base UI). `PhotoManager` (brand-restyled)
  renders inside each edit form (a sibling card — it has its own `<form>`, so not nested). Herb
  rows link to `/staff/herbs/{id}` listing remedies that use the herb. Province edit page also
  manages its districts.
- **Drill-in (hybrid nav):** healer rows link to `/staff/healers/{id}/remedies` and remedy rows
  to `/staff/remedies/{id}/treatment-cases` — scoped CRUD pages that reuse `RemedyAdminList`/
  `CaseAdminList` with an optional `healerId`/`remedyId` prop (scopes the fetch, hides the
  parent column, and its `+ New` link pre-selects the parent via `?healerId=`/`?remedyId=`,
  which the new-forms read as `defaultHealerId`/`defaultRemedyId`). The flat top-level sections
  remain.

## How to run

**Whole stack (Postgres + API + web) — from the repo root:**

```bash
docker compose up --build          # then open http://localhost:3000
```

`compose.yaml` is the **production** layer (`backend`/`frontend` build their Dockerfile
`production` target). `compose.override.yaml` (auto-merged by plain `docker compose`) is the
**development** layer: both services build their `development` target and declare
`develop.watch` rules. For hot reload while coding, use:

```bash
docker compose watch               # syncs source into the containers on change
```

The backend `development` stage runs `go run ./cmd/api`; a source change under `./backend`
triggers `sync+restart` (recompile on restart), and a `go.mod` change triggers a rebuild.
The frontend `development` stage runs `pnpm dev` (Next fast refresh via `sync`; lockfile /
`package.json` changes rebuild). `docker compose up` (no `watch`) still runs the dev images
but without file-watching; add `-f compose.yaml` to run the pure production images.

The root `docker-compose.yml` builds `backend/Dockerfile` (static Go binary) and
`frontend/Dockerfile` (Next.js standalone), starts Postgres, runs the migrations +
Yasothon seed, and bootstraps the admin from `STAFF_ADMIN_USERNAME`/`STAFF_ADMIN_PASSWORD`
(default `admin`/`change-me`). Only the frontend is published (`:3000`); it reaches the
API at `http://backend:8080` over the compose network. Override `JWT_SECRET` and the admin
creds via a root `.env`. To hit the API directly from the host, uncomment the backend
`ports:` block. Data persists in the `postgres_data` and `photo_data` volumes.

Load demo data into the running stack with the profile-gated one-shot `seed` service
(shares the `photo_data` volume, so seeded images are served by the stack):

```bash
docker compose --profile seed run --rm seed          # fill an empty DB
docker compose --profile seed run --rm seed -reset   # wipe demo tables + reseed
```

**Backend alone, for development:**

```bash
cd backend
cp .env.example .env             # then export the vars, or use a loader
docker compose up -d             # Postgres only (backend/docker-compose.yml)
go run ./cmd/api                 # starts on HTTP_PORT (default 8080)
go run ./cmd/seed                # fill an empty DB with generated demo data
go run ./cmd/seed -reset         # truncate demo tables, then reseed
```

`cmd/seed` writes ~50 healers, ~140 remedies, ~280 cases, and 5 placeholder photos
through the repository ports. It refuses to run when the `healer` table is not empty
(unless `-reset`), so it never doubles data and never runs in production unless invoked.
The Thai content is generated from curated pools in `cmd/seed/generate.go` with a fixed
random seed, so runs are reproducible.

Tests: `go test ./...` (backend), `pnpm test` (frontend).
Integration tests need Docker. On this host, set `TESTCONTAINERS_RYUK_DISABLED=true`
(local Docker config quirk, not a code issue).

## Docs

- Design spec: `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md`
- Plan 1: `docs/superpowers/plans/2026-08-13-backend-foundation-location.md`
- Plan 2: `docs/superpowers/plans/2026-08-13-healer-and-event-bus.md`
- Plan 3: `docs/superpowers/plans/2026-08-14-remedy-and-treatment-case.md`
- Plan 4: `docs/superpowers/plans/2026-08-14-auth-and-photos.md`
- Plan 5: `docs/superpowers/plans/2026-08-14-frontend-public-browse.md`
- Plan 6: `docs/superpowers/plans/2026-08-14-staff-admin-healer.md`
- Plan 7: `docs/superpowers/plans/2026-08-14-staff-admin-remedy-case.md`
- Plan 8: `docs/superpowers/plans/2026-08-14-photo-management.md`
- Plan 9: `docs/superpowers/plans/2026-08-14-search-symptom-herb.md`
- Plan 10: `docs/superpowers/plans/2026-08-14-herb-remedy-focus.md`
  (spec: `docs/superpowers/specs/2026-08-14-herb-remedy-focus-design.md`)
- Public zone redesign spec (view-layer only, not yet built):
  `docs/superpowers/specs/2026-08-15-public-zone-redesign-design.md`
  Direction "Modern Utility", province-neutral. Preview:
  https://claude.ai/code/artifact/fda8c118-958f-4b5b-82e8-300903933240
- Public zone redesign handoff (shipped + gotchas + future work):
  `docs/superpowers/handoffs/2026-08-15-public-zone-redesign-handoff.md`
- Public zone redesign plan (9 tasks, TDD):
  `docs/superpowers/plans/2026-08-15-public-zone-redesign.md`
  **Done** on branch `feat/public-zone-redesign` (built with agents, 10 commits).
  Direction "Modern Utility", province-neutral. New design tokens in `globals.css`
  (`--brand`, `--ink*`, `--surface*`, `--line`, `--caution`; light + dark) and a
  heading serif (Noto Serif Thai). New shared components: `SiteHeader`, `Chip`,
  `LinkRow`, `SectionHead`, `DetailHeader`, `ContentBlock`, `Callout`, `FactPanel`.
  Restyled every public page (home, search, herb, remedy, healer, district) plus the
  shared `Breadcrumb`/`EmptyState`/`not-found`. Province shows only as a facet
  (brand names no province; browse starts province → district). Verified in the
  browser with seeded data: light + dark themes and the province breadcrumb.
  Deferred (needs backend/API): a `getDistrict(id)` endpoint (the district page
  currently resolves via `listProvinces`+`listDistricts`), a province page route,
  herb photo/richer facts, healer stat counts. The staff zone was not restyled.

## Possible future work

- Swap the local-disk `photo.Store` for S3/MinIO before horizontal scaling.
- Staff roles (admin vs normal) if the team grows.
- End-to-end tests (Playwright) across the login → manage → browse flow.
- Search follow-ups: filter by district/field, pagination, and match highlighting
  (all deliberately out of scope for Plan 9).
- Possible backend follow-up: photo-gallery-by-owner endpoints (see the `withinlazy` notes).

**Carry-forward note:** `sqlc.yaml` points `schema:` at the whole `migrations/`
directory. As new entity migrations land, keep DML seed migrations free of
constructs the sqlc catalog cannot model.

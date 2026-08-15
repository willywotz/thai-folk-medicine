# Handoff — Thai Folk-Medicine Records

A web app that keeps the folk-medicine knowledge (ตำรายาหมอพื้นบ้าน) of local healers in
**Yasothon** province. The public reads it; staff maintain it. The app is now
**remedy/herb-focused**: people find herbs and remedies first, and healers/districts stay as
attribution context. The design allows more provinces later.

This document is the orientation for whoever picks the project up next. For the deeper
system description see `CONTEXT.md`; for the reasoning behind each increment see the specs
and plans under `docs/superpowers/`.

---

## Status

**The planned scope is complete and all merged to `main`.**

- Backend API (Go) — done.
- Public browse site (Next.js, server-rendered), remedy/herb-first — done.
- Staff admin (Next.js) — login + full CRUD for **provinces, districts,** healers, remedies,
  herbs, treatment cases, and photos — done. **Redesigned** into six flat entity sections
  (see the staff-zone overhaul below).
- **Pagination** on every public list endpoint (uniform `{items,page,pageSize,total,totalPages}`
  envelope) — done (**Plan 11**).
- **Public search** — one merged, relevance-ranked, **paginated** list across remedies +
  healers + herbs (Thai-friendly `pg_trgm`) — done (Plan 11).
- Demo-data seed command (`cmd/seed`) — done.
- Root compose runs the whole stack (prod images) and a **hot-reload dev workflow**
  (`docker compose watch`) — both verified end to end.
- **`GET /api/v1/districts/{districtId}`** (public, single district read) — done; the staff
  district page now shows the real district name.
- **Searchable herb picker** — the staff remedy form filters herbs by Thai name with a
  Base UI `Combobox` (no new dependency) — done.

### Latest — internationalization (th/en) + UX polish (merged to `main`)

Two-language support (**Thai default, English**) via the official Next.js App Router sub-path
standard, plus a batch of UX fixes. All merged to `main`.

**i18n (`feat/i18n-th-en`, merge `cd0b2b4`).** Spec/plan:
`docs/superpowers/specs/2026-08-16-i18n-th-en-design.md`,
`docs/superpowers/plans/2026-08-16-i18n-th-en.md`.

- All UI routes moved under `app/[lang]/` (`th`|`en`); `app/[lang]/layout.tsx` is the single
  root layout. `app/bff/*` API handlers stay at the root (a static segment beats `[lang]`).
- `src/proxy.ts` redirects a locale-less path to `/th`, then applies the staff auth guard to the
  locale-stripped path (keeping the prefix).
- `src/lib/i18n/`: `config` (locales, `defaultLocale = "th"`), typed dictionaries
  `dictionaries/{th,en}.ts` (`th` is the source of truth; `en: Dictionary` → a missing key is a
  **compile error**), `getDictionary()` (server, via `next/root-params`). Client components use
  `useT()`, which selects `{th,en}` by the locale from `I18nProvider` — **locale-only context**;
  the dict is imported client-side so its function-valued keys survive the RSC boundary. Never
  pass the dict object across the server→client prop boundary.
- Only UI **chrome** is translated (public + staff + login); record content shows as saved. The
  brand mark stays Thai in both locales. A `LanguageSwitcher` in the header swaps the locale.

**UX polish (small commits on `main`, newest first).**

- **Multi-province By-area fix** (`0a21aef`): home By-area chips linked to a bare `/districts`,
  which always showed the first province; chips now pass `?provinceId=<id>` and the districts
  page honors it (falls back to the first province, 404 on an unknown id).
- **Breadcrumbs everywhere**: every staff page is rooted at **Dashboard**, every public page at
  **Home** (`09afcae`, `e5a918f`, `6a5e043`).
- **Dedicated district create/edit pages** (merge `6b340fc`): districts were the last staff
  entity with an inline form; they now use `staff/provinces/[provinceId]/districts/new` +
  `.../[districtId]/edit`, matching every other entity. `DistrictForm` navigates instead of an
  `onDone` callback.
- **Pointer cursor** for all links/buttons/`role` controls via one `globals.css` base rule
  (`afc26c0`) — Tailwind v4 drops the default button pointer.
- Home **"Recent cases"** links to the full `/treatment-cases` listing (`902fa61`).

### Staff-zone overhaul (Plan 13, merge `2ddee03`)

The biggest increment since the previous handoff. Spec/plan:
`docs/superpowers/specs/2026-08-15-staff-workspace-sections-design.md` and
`docs/superpowers/plans/2026-08-15-staff-workspace-sections.md`. The **domain model is
unchanged** (Province 1→n District 1→n Healer 1→n Remedy 1→n Case; Herb n↔m Remedy). What
changed:

- **Brand-token redesign.** The staff zone now uses the public site's green brand tokens
  (`--brand`/`--ink`/`--line`/`--surface` in `globals.css`) via a shared `staff-ui.ts`, a
  sidebar shell (`StaffNavLink`), and `StaffPageHeader`. No more raw `stone-*` greys.
- **Six flat sections** replace the old District→Healer→Remedy→Case drill-down: Dashboard,
  Province, Healer, Remedy, Case, Herb (`/staff/{provinces,healers,remedies,cases,herbs}`).
  Each create/edit form picks its parent; the old nested routes were removed. **Hybrid nav:**
  a healer row also links to `/staff/healers/{id}/remedies` and a remedy row to
  `/staff/remedies/{id}/treatment-cases` (scoped CRUD; `+New` pre-selects the parent).
- **Province/District CRUD** with events + delete guards (province-with-districts → 409,
  district-with-healers → 409). `LocationService` gained a `Publisher`.
- **Activity feed (event-driven read model).** Bus gained `SubscribeAll`; a
  `usecase/audit.Recorder` persists every domain event to a new `event_log` table (migration
  `000011`). `GET /api/v1/activity` (protected) + the dashboard `ActivityFeed`. `GET
  /api/v1/stats` (protected) feeds the six dashboard count tiles.
- **Flat `GET /healers`** added (the only entity that lacked one). **Server-side pagination +
  name search** on the staff Healer/Remedy/Herb/Case lists: list endpoints gained an optional
  `?searchTerm=` (ILIKE over name fields; absent term leaves the public zone unchanged); the
  staff fetchers now return the `Page<T>` envelope at `STAFF_PAGE_SIZE=20` with a client
  `StaffPagination` control. Parent pickers are searchable ancestry comboboxes
  (`EntityCombobox`).
- **Photos on create + province/district photos.** `photo.ValidOwnerType` now also accepts
  `province`/`district` (generic owner store, no schema change). A new `PhotoInput` collects
  photos on create forms and uploads them after the record is saved (the `create*` mutations
  now return the created entity). List rows show the record's first photo via `RowAvatar`
  (`withinlazy:` one photo request per row — a cover-photo id on the list response would
  remove the N+1).
- **Reassignment fix:** `PUT /remedies/:id` now persists `healer_id` and `PUT
  /treatment-cases/:id` persists `remedy_id`+`healer_id`, so the edit forms' parent pickers
  actually save.

Earlier follow-ups (now on `main`, some superseded by the redesign): `GET /districts/{id}`
(merge `1c3142f`) and a staff pagination-envelope fix (`fetch*` helpers unwrap `.items`); the
searchable herb picker (merge `7a27187`). The staff `fetch*` helpers described there were
replaced by the paginated `fetchPage`/`Page<T>` fetchers in this increment.

**Nothing has been pushed to a remote.** There is no git remote configured. Everything
lives in local `main`. Add a remote and push when you are ready (that is an outward action
— get sign-off first).

Git branch model: each increment ("plan") is built on a `feat/*` branch and merged into
`main` with `--no-ff`. `main` is the integration branch. The most recent merges are
`feat/herb-picker-search` (searchable herb picker) and `feat/get-district-by-id`
(`GET /districts/{id}` + the staff pagination-envelope fix); before those, **Plan 11 —
pagination + merged search** (`feat/pagination-filter-search`), the **backend docker
hot-reload dev workflow** (`feat/docker-dev-hot-reload`), and Plan 10 — herb + remedy focus.

> **Note on Plan 11 scope:** list *filters* (remedy by herb/district/symptom, herb by
> name/property) and a native GET-form `<Filters>` component were fully designed, built,
> reviewed, and then **removed by decision** — only pagination and the merged search remain.
> If you want filters back, the design lives in
> `docs/superpowers/specs/2026-08-15-pagination-filter-search-design.md` and the build is in
> git history on the (deleted) branch.

---

## Run it

**Whole stack (Postgres + API + web):**

```bash
docker compose up --build      # from the repo root → http://localhost:3000
docker compose down            # stop (add -v to also drop the data volumes)
```

**Compose has two layers.** `compose.yaml` is the **production** layer (`backend`/`frontend`
build their Dockerfile `production` target). `compose.override.yaml` is auto-merged by plain
`docker compose` and is the **development** layer (both services build their `development`
target and declare `develop.watch` rules). So:

```bash
docker compose watch                 # hot-reload dev: syncs source into the containers
docker compose up                    # dev images, no file-watching
docker compose -f compose.yaml up    # pure production images (skip the override)
```

Under `docker compose watch`, a change under `./backend` triggers `sync+restart` — the
`development` stage runs `go run ./cmd/api`, so it recompiles on restart; a `go.mod` change
triggers a rebuild. The frontend uses Next fast refresh (`sync`); lockfile/`package.json`
changes rebuild. (Note: `docker compose up` currently runs the **dev** images because of the
override — add `-f compose.yaml` for production.)

Default admin login: `admin` / `change-me`. Override the secrets in a root `.env`:
`JWT_SECRET`, `STAFF_ADMIN_USERNAME`, `STAFF_ADMIN_PASSWORD`.

**Fill the demo data** (12 curated herbs, ~50 healers, ~146 remedies each linked to 2–4
herbs, ~280 cases, a few photos) via the profile-gated one-shot seed service:

```bash
docker compose --profile seed run --build --rm seed          # fill an empty DB
docker compose --profile seed run --build --rm seed -reset   # wipe demo tables + reseed
```

Only the frontend publishes a host port (`:3000`). The backend is reached internally at
`http://backend:8080`. To curl the API from the host, uncomment the `ports:` block under
`backend` in `docker-compose.yml`.

**Local dev (no containers for the apps):**

```bash
# backend (needs Postgres — backend/docker-compose.yml starts one)
cd backend && docker compose up -d
DATABASE_URL='postgres://folk:folk@localhost:5432/folk_medicine?sslmode=disable' \
JWT_SECRET=dev STAFF_ADMIN_USERNAME=admin STAFF_ADMIN_PASSWORD=dev go run ./cmd/api
go run ./cmd/seed              # (same env) fill the dev DB; add -reset to rebuild

# frontend (another terminal)
cd frontend && INTERNAL_API_URL=http://localhost:8080 pnpm dev   # http://localhost:3000
```

---

## Architecture

**Backend (`backend/`, Go 1.26.5)** — Clean Architecture, 15-Factor, event-driven.

```
cmd/api            main: load config → migrate → wire → run
cmd/seed           demo-data command (curated herbs + generated healers/remedies/cases)
internal/
  domain/          entities + interfaces, NO framework code (location, healer, remedy,
                   herb, treatmentcase, staff, photo, event)
  usecase/         application services; import only domain + stdlib (+ bcrypt); search/
  adapter/
    http/          Gin router (public + JWT-protected groups), handlers, DTOs
    repository/    Postgres repos + sqlc-generated db/
  platform/        config (env), database (pgx + golang-migrate), eventbus (in-process,
                   slog audit), token (JWT HS256), photostore (local disk)
migrations/        SQL + Yasothon seed (embedded)
```

Dependency rule: `domain` ← `usecase` ← `adapter`/`platform`. Every write publishes a
domain event through an in-process bus; an audit handler logs each one. **Reads publish no
events** (pagination and search are read-only).

**Pagination kernel:** `internal/domain/listing` (`Params{Limit,Offset}`, generic
`Page[T]{Items,Total}`) is a pure-Go shared kernel every list use case returns. Each sqlc
list query has a matching `Count*` with an identical `WHERE`; the HTTP layer wraps results in
the uniform `{items,page,pageSize,total,totalPages}` envelope (`newPageDTO`, `parsePageParams`
in `adapter/http/helpers.go`; `pageSize` default 12 / 20 for search, capped at 48). **Merged
search** is one SQL `UNION ALL` over remedy/healer/herb ranked by trigram `similarity()`
(`adapter/repository/query/search.sql`), returned as `Page[SearchHit]`.

**Domain model.** `Province → District → Healer → Remedy → Case`, plus **`Herb ↔ Remedy`
many-to-many** through `remedy_herb` (with a per-link `amount`). A remedy's ingredients ARE
its linked herbs — the old free-text `remedy.ingredients` column was dropped. A herb is a
rich record (Thai/English/scientific name, properties, description) with its own photos.

**Frontend (`frontend/`, Next.js App Router + TypeScript, Tailwind)**

- **Public pages** are React Server Components that read the Go API server-side. The home
  page leads with a search box, then **Herbs → Remedies → Cases** sections (each "see all
  →"), plus a secondary "browse by district" link. Pages: `/herbs`, `/herbs/{id}` (herb
  profile + remedies using it), `/remedies`, `/treatment-cases`, `/districts`, and the
  detail pages. A remedy page shows its linked herbs (name → `/herbs/{id}`, with amount) and
  keeps "recorded by healer · district" context. Every list page is **paginated** via a
  server `<Pagination>` component (URL `?page=` links that preserve other params). `/search`
  is **one merged, ranked list** — each row a type badge linking to the remedy/healer/herb
  detail page.
- **Staff pages** (`/staff/*`, guarded by `src/proxy.ts`) use TanStack Query +
  react-hook-form + zod + shadcn/ui. Includes `/staff/herbs` CRUD; the remedy form uses a
  **herb picker** (herb + amount rows).
- **Auth is a BFF pattern.** The JWT lives ONLY in an httpOnly `session` cookie. Login and
  every write go browser → a `/bff/*` route handler (reads the cookie, adds
  `Authorization: Bearer`) → the Go API. The token never reaches browser JavaScript.
  Public reads go through the `/api/*` proxy (`next.config.ts` → `INTERNAL_API_URL`).
  `src/proxy.ts` also redirects `/login` → `/staff` when already logged in.

The full API contract and the frontend file tree are in `CONTEXT.md`.

---

## Conventions (project rules — see `.claude/CLAUDE.md`)

- **TDD is mandatory:** failing test → confirm fail → minimal code → confirm pass →
  refactor. The whole codebase was built this way.
- **Branch for multi-step work;** never commit multi-task work straight to `main`.
- **Full English API route names**, all under `/api/v1`.
- **Clean Architecture, 15-Factor, event-driven** are hard requirements, not aspirations.
- Style guides live under `.claude/styles/` (uber-go for Go, Google for TS/HTML/CSS).
- `CONTEXT.md` is updated and committed at the end of each task.
- Deliberate corners are marked with `withinlazy:` comments naming the ceiling and the
  upgrade path — grep for them.
- Optional multi-agent workflow (`.claude/subagents.md`): say "implement with agents" and
  the main session orchestrates `builder`/`verifier` subagents. Plan 10 was built that way.

---

## Testing

- **Backend:** `cd backend && go test ./...` — unit tests plus repository/integration
  tests that spin real Postgres via **testcontainers-go** (needs Docker running).
- **Frontend:** `cd frontend && pnpm test` — Vitest + React Testing Library
  (schemas, the API/staff client, every component and form).
- `pnpm lint` and `pnpm build` (which type-checks) must stay clean.

**Host gotcha:** on this machine testcontainers needs `TESTCONTAINERS_RYUK_DISABLED=true`
(a local Docker config quirk, not a code issue):

```bash
cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...
```

**sqlc:** after changing any `internal/adapter/repository/query/*.sql`, regenerate with
`cd backend && sqlc generate` (sqlc v1.31.1) before building.

---

## Environment variables

**Backend:** `HTTP_PORT` (default 8080), `DATABASE_URL` (required), `JWT_SECRET`
(required), `PHOTO_STORAGE_DIR` (default `./storage/photo`), `STAFF_ADMIN_USERNAME`,
`STAFF_ADMIN_PASSWORD`, `STAFF_ADMIN_EMAIL` (default). If the admin username+password are
set and the staff table is empty, the first admin is created on startup. No default
password is baked into code.

**Frontend:** `INTERNAL_API_URL` (default `http://localhost:8080`). Used at runtime by
server components AND **baked at build time** into the `/api` proxy destination — see the
gotcha below.

---

## Known gotchas / non-obvious decisions

1. **`INTERNAL_API_URL` is baked at build time.** Next.js resolves the `/api` rewrite
   destination during `next build`, not at runtime. The frontend `Dockerfile` passes it as
   a build ARG (pointing at `http://backend:8080`). Change it via the compose build arg.
2. **The route guard is `src/proxy.ts`, not `middleware.ts`** (Next.js 16 rename; export
   `proxy`, `config.matcher`). It guards `/staff/*` (→ `/login` if no session) AND redirects
   `/login` → `/staff` when a session cookie is present.
3. **The public "staff" header link uses `prefetch={false}`.** A prefetched auth-gated link
   caches the guard's redirect from whichever auth state existed at prefetch time, so it
   could send a logged-in user to `/login`; disabling prefetch makes each click revalidate.
4. **The `cmd/seed` container image is built separately.** It is a profile-gated compose
   service, so `docker compose up --build` does NOT rebuild it. After any migration or seed
   change, run the seed with `--build` (`docker compose --profile seed run --build --rm
   seed`) or its embedded migrations/schema go stale and you get "no migration found for
   version N". `-reset` truncates `photo, treatment_case, remedy_herb, remedy, herb,
   healer`; it leaves old photo files on disk (`withinlazy`).
5. **`pnpm-workspace.yaml` carries `allowBuilds`.** Any Docker/CI `pnpm install
   --frozen-lockfile` must copy that file or pnpm 10+ fails with `ERR_PNPM_IGNORED_BUILDS`.
   The `Dockerfile` copies it in the deps stage.
6. **`treatedOn` is a date string `YYYY-MM-DD`** end to end (native `<input type="date">` ↔
   zod regex ↔ Go `time.Parse("2006-01-02")`); `formatThaiDate` pins UTC to avoid
   off-by-one.
7. **Photo storage is local disk** behind a `photo.Store` port (`withinlazy`) — not
   multi-instance safe; swap for S3/MinIO before scaling horizontally. Owner types are
   `healer | remedy | case | herb`.
8. **Delete conflicts return 409.** Deleting a healer/remedy/herb that still has children
   maps the Postgres FK violation to a domain `ErrReferenced`; the UI surfaces it. A remedy
   cascades its `remedy_herb` links on delete; a herb still linked to a remedy cannot be
   deleted.
9. **The remedy write is transactional.** `repository.NewRemedy(pool)` takes the pgx pool
   and writes the remedy + its `remedy_herb` rows in one transaction (Create/Update);
   `GetByID` loads the herb links after commit.
10. **Search uses `pg_trgm`, not `to_tsvector`** (Thai has no word spaces). Migrations
    `000008`–`000010` maintain the GIN trigram indexes. Minimum term is **2 runes**
    (`utf8.RuneCountInString`). Search is now **one merged, paginated list** (`SearchAll` in
    `query/search.sql`): a `UNION ALL` of remedy / healer / herb, each scored by
    `GREATEST(similarity(...))::real`, ordered `score DESC, type, id` (deterministic paging).
    Cross-type scores are **uncalibrated** (a herb-name match and a remedy-symptom match are
    not on the same scale) — `withinlazy:` in `search_repository.go` marks where to add
    per-type weights if the ordering needs tuning.
11. **Every public list returns the same envelope** `{items,page,pageSize,total,totalPages}`.
    `pageSize` defaults to 12 (20 for search), caps at 48; `page` past the end returns valid
    metadata with empty `items`. Each list SQL query has a paired `Count*` with an **identical
    `WHERE`** — if you add a scope/filter to a list query, add it to its count too or `total`
    disagrees with `items`. List *filters* were built then removed (see the Plan 11 note up
    top); only pagination remains.
12. **Compose has a prod layer and a dev layer.** `compose.yaml` = production (`production`
    build target). `compose.override.yaml` = development (`development` target + `develop.watch`)
    and is **auto-merged by plain `docker compose`** — so `docker compose up` runs the DEV
    images. Use `docker compose watch` for hot reload; `docker compose -f compose.yaml up` for
    pure production. The backend `development` stage runs `go run ./cmd/api` (recompiles on the
    watch `sync+restart`); `seed` is pinned to the `production` target.

---

## Future work (nothing blocking; all optional)

- **Herb categories/tags** and structured **herb ↔ symptom** links.
- **Amount as a structured quantity + unit** (kept as free text today).
- **List filters** — remedy by herb/district/symptom and herb by name/property were built and
  reviewed, then removed by decision; the spec + git history make re-adding them cheap.
- **Search follow-ups** — match highlighting, per-type score weighting (cross-type ranking is
  uncalibrated today), a type-facet on `/search`. (Pagination is done.)
- **S3 / MinIO** photo store to replace local disk before horizontal scaling.
- **Staff roles** (admin vs normal) if the team grows — one flat staff type today.
- **Playwright** end-to-end tests across login → manage → browse.
- **A second province** — the model supports it and the home By-area chips now reach each
  province's districts (`/districts?provinceId=`). Still missing: a public province **index**
  page (the By-area section-head "view all" link was removed since there is no such page).
- **i18n follow-ups** — record **content** is not localized (only chrome is; most entities store
  Thai-only text). No URL hreflang/SEO tags yet. Two trivial shared strings stay English in both
  locales by choice: `Pagination` "Loading…" and one nav `aria-label="Pagination"`.
- **Locale via `Accept-Language`** — `defaultLocale` is always `th` today; the proxy could pick
  a locale from the header on a locale-less request instead of always redirecting to `/th`.

---

## Where things live

- Design specs: `docs/superpowers/specs/` (original design + search + herb/remedy focus).
- Plans (one per increment): `docs/superpowers/plans/` — backend foundation, healer + events,
  remedy + case, auth + photos, public frontend, staff healer admin, staff remedy/case admin,
  photo management, search by symptom/herb, **herb + remedy focus** (Plan 10),
  **pagination + merged search** (Plan 11, `2026-08-15-pagination-filter-search.md`), the
  **staff-zone overhaul** (Plan 13), and **th/en i18n** (`2026-08-16-i18n-th-en.md`).
- SDD ledgers / per-task reports: `.superpowers/sdd/` (git-ignored scratch).
- System reference: `CONTEXT.md`.
- Project rules and agent config: `.claude/`.

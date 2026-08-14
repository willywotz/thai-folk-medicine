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
- Staff admin (Next.js) — login + full CRUD for healers, remedies, herbs, treatment cases,
  and photos — done.
- Public search (remedies + healers + herbs, Thai-friendly `pg_trgm`) — done.
- Demo-data seed command (`cmd/seed`) — done.
- Root `docker-compose.yml` runs the whole stack and is verified end to end.

**Nothing has been pushed to a remote.** There is no git remote configured. Everything
lives in local `main`. Add a remote and push when you are ready (that is an outward action
— get sign-off first).

Git branch model: each increment ("plan") is built on a `feat/*` branch and merged into
`main` with `--no-ff`. `main` is the integration branch. The most recent merges are the demo
seed, the public staff link, and **Plan 10 — herb + remedy focus** (`feat/herb-catalog`,
left un-deleted).

---

## Run it

**Whole stack (Postgres + API + web):**

```bash
docker compose up --build      # from the repo root → http://localhost:3000
docker compose down            # stop (add -v to also drop the data volumes)
```

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
domain event through an in-process bus; an audit handler logs each one.

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
  keeps "recorded by healer · district" context. `/search` has three result groups.
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
    `000008`–`000010` maintain the GIN trigram indexes. Search covers remedies (name,
    symptoms, and **linked herb names** via join), healers, and herbs. Minimum term is **2
    runes** (`utf8.RuneCountInString`). NOTE: remedy-search **relevance ranking was
    simplified** from trigram `similarity()` to `ILIKE … ORDER BY name` when the herb join
    was added — restoring ranking is a deferred follow-up.

---

## Future work (nothing blocking; all optional)

- **Restore remedy-search ranking** (`similarity()`-based) alongside the herb-name join.
- **Herb categories/tags** and structured **herb ↔ symptom** links.
- **Amount as a structured quantity + unit** (kept as free text today).
- **Search follow-ups** — filter by district/field, pagination, match highlighting.
- **`GET /districts/{id}`** so staff breadcrumbs can show the district name.
- **S3 / MinIO** photo store to replace local disk before horizontal scaling.
- **Staff roles** (admin vs normal) if the team grows — one flat staff type today.
- **Playwright** end-to-end tests across login → manage → browse.
- **A second province** — the data model already supports it; seed more rows.

---

## Where things live

- Design specs: `docs/superpowers/specs/` (original design + search + herb/remedy focus).
- Plans (one per increment): `docs/superpowers/plans/` — backend foundation, healer + events,
  remedy + case, auth + photos, public frontend, staff healer admin, staff remedy/case admin,
  photo management, search by symptom/herb, and **herb + remedy focus** (Plan 10).
- SDD ledgers / per-task reports: `.superpowers/sdd/` (git-ignored scratch).
- System reference: `CONTEXT.md`.
- Project rules and agent config: `.claude/`.

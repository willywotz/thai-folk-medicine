# Handoff — Thai Folk-Medicine Records

A web app that keeps the folk-medicine knowledge (ตำรายาหมอพื้นบ้าน) of local healers in
**Yasothon** province, grouped by district. The public reads it; staff maintain it. The
design allows more provinces later.

This document is the orientation for whoever picks the project up next. For the deeper
system description see `CONTEXT.md`; for the reasoning behind each increment see the specs
and plans under `docs/superpowers/`.

---

## Status

**The planned scope is complete and all merged to `main`.**

- Backend API (Go) — done.
- Public browse site (Next.js, server-rendered) — done.
- Staff admin (Next.js) — login + full CRUD for healers, remedies, treatment cases, and
  photos — done.
- Public search (remedies + healers, Thai-friendly `pg_trgm`) — done.
- Root `docker-compose.yml` runs the whole stack and is verified end to end.

**Nothing has been pushed to a remote.** There is no git remote configured. Everything
lives in local `main`. Add a remote and push when you are ready (that is an outward action
— get sign-off first).

Git branch model used so far: each increment ("plan") was built on a `feat/*` branch and
merged into `main` with `--no-ff`. `main` is the integration branch.

---

## Run it

**Whole stack (Postgres + API + web):**

```bash
docker compose up --build      # from the repo root → http://localhost:3000
docker compose down            # stop (add -v to also drop the data volumes)
```

Default admin login: `admin` / `change-me`. Override the secrets in a root `.env`:
`JWT_SECRET`, `STAFF_ADMIN_USERNAME`, `STAFF_ADMIN_PASSWORD`.

Only the frontend publishes a host port (`:3000`). The backend is reached internally at
`http://backend:8080`. To curl the API from the host, uncomment the `ports:` block under
`backend` in `docker-compose.yml`.

**Local dev (no containers for the apps):**

```bash
# backend (needs Postgres — backend/docker-compose.yml starts one)
cd backend && docker compose up -d
DATABASE_URL='postgres://folk:folk@localhost:5432/folk_medicine?sslmode=disable' \
JWT_SECRET=dev STAFF_ADMIN_USERNAME=admin STAFF_ADMIN_PASSWORD=dev go run ./cmd/api

# frontend (another terminal)
cd frontend && INTERNAL_API_URL=http://localhost:8080 pnpm dev   # http://localhost:3000
```

---

## Architecture

**Backend (`backend/`, Go 1.26.5)** — Clean Architecture, 15-Factor, event-driven.

```
cmd/api            main: load config → migrate → wire → run
internal/
  domain/          entities + interfaces, NO framework code (location, healer, remedy,
                   treatmentcase, staff, photo, event)
  usecase/         application services; import only domain + stdlib (+ bcrypt)
  adapter/
    http/          Gin router (public + JWT-protected groups), handlers, DTOs
    repository/    Postgres repos + sqlc-generated db/
  platform/        config (env), database (pgx + golang-migrate), eventbus (in-process,
                   slog audit), token (JWT HS256), photostore (local disk)
migrations/        SQL + Yasothon seed (embedded)
```

Dependency rule: `domain` ← `usecase` ← `adapter`/`platform`. Every write publishes a
domain event through an in-process bus; an audit handler logs each one.

**Frontend (`frontend/`, Next.js App Router + TypeScript, Tailwind)**

- **Public pages** are React Server Components that read the Go API server-side. This
  includes `/search` — one box, two result groups (remedies → `/remedies/{id}`, healers →
  `/healers/{id}`); a `SearchBox` also sits in the site header.
- **Staff pages** (`/staff/*`, guarded by `src/proxy.ts`) use TanStack Query +
  react-hook-form + zod + shadcn/ui.
- **Auth is a BFF pattern.** The JWT lives ONLY in an httpOnly `session` cookie. Login and
  every write go browser → a `/bff/*` route handler (reads the cookie, adds
  `Authorization: Bearer`) → the Go API. The token never reaches browser JavaScript.
  Public reads go through the `/api/*` proxy (`next.config.ts` → `INTERNAL_API_URL`).

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
  the main session orchestrates `builder`/`verifier` subagents. Every plan here was built
  that way.

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

---

## Environment variables

**Backend:** `HTTP_PORT` (default 8080), `DATABASE_URL` (required), `JWT_SECRET`
(required), `PHOTO_STORAGE_DIR` (default `./storage/photo`), `STAFF_ADMIN_USERNAME`,
`STAFF_ADMIN_PASSWORD`, `STAFF_ADMIN_EMAIL` (default). If the admin username+password are
set and the staff table is empty, the first admin is created on startup. No default
password is baked into code.

**Frontend:** `INTERNAL_API_URL` (default `http://localhost:8080`). It is used at runtime
by server components AND **baked at build time** into the `/api` proxy destination — see
the gotcha below.

---

## Known gotchas / non-obvious decisions

1. **`INTERNAL_API_URL` is baked at build time.** Next.js resolves the `/api` rewrite
   destination during `next build`, not at runtime. The frontend `Dockerfile` passes it as
   a build ARG (pointing at `http://backend:8080`) so the browser's proxied requests —
   including photo `<img>` loads — hit the right host. Change it via the compose build arg,
   not just the runtime env.
2. **The route guard is `src/proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the
   middleware file to `proxy.ts` (export `proxy`, `config.matcher`). The build shows it as
   `ƒ Proxy (Middleware)`. It guards `/staff/*`.
3. **Docker port `:8080` was flaky on this host** (a Docker/WSL forwarding daemon returned
   500 on that specific port). The compose file therefore does not publish the backend port
   by default. It is uncommented-to-enable, and the app works regardless because the
   frontend reaches the backend over the compose network.
4. **`frontend/pnpm-workspace.yaml`** carries `allowBuilds` (sharp/unrs-resolver disabled).
   Any Docker/CI `pnpm install --frozen-lockfile` must copy that file or pnpm 10+ fails
   with `ERR_PNPM_IGNORED_BUILDS`. The `Dockerfile` copies it in the deps stage.
5. **`treatedOn` is a date string `YYYY-MM-DD`** end to end (native `<input type="date">`
   ↔ zod regex ↔ Go `time.Parse("2006-01-02")`); `formatThaiDate` pins UTC to avoid
   off-by-one.
6. **Photo storage is local disk** behind a `photo.Store` port (`withinlazy`). It is not
   multi-instance safe — swap for S3/MinIO before scaling horizontally.
7. **Delete conflicts return 409:** deleting a healer/remedy that still has children maps
   the Postgres FK violation to a domain `ErrReferenced`; the UI surfaces it.
8. **Search uses `pg_trgm`, not `to_tsvector`.** Thai has no spaces between words, so
   Postgres full-text dictionaries segment it wrongly. The search (`GET /api/v1/search`,
   migration `000008`) matches on character trigrams instead — language-agnostic, ranked by
   `similarity()`, backed by GIN indexes. The minimum term is **2 runes** (counted with
   `utf8.RuneCountInString`, not byte length — one Thai character is 3 bytes); a shorter
   term returns 400. The search reader interfaces live in `usecase/search` (consumer side),
   not on the aggregate `Repository` interfaces.

---

## Future work (nothing blocking; all optional)

- **Search follow-ups** — filter by district/field, pagination, and match highlighting
  (all deliberately out of scope for the first search cut).
- **`GET /districts/{id}`** so staff breadcrumbs can show the district name (currently a
  static "District" label).
- **S3 / MinIO** photo store to replace local disk before horizontal scaling.
- **Staff roles** (admin vs normal) if the team grows — auth is one flat staff type today.
- **Playwright** end-to-end tests across login → manage → browse.
- **A second province** — the data model already supports it; seed more rows in a migration.

---

## Where things live

- Design spec: `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md`
- Plans (one per increment): `docs/superpowers/plans/` (backend foundation, healer + events,
  remedy + case, auth + photos, public frontend, staff healer admin, staff remedy/case
  admin, photo management, search by symptom/herb).
- SDD ledgers / per-task reports: `.superpowers/sdd/` (git-ignored scratch — useful history
  of what each task did and every ruling made).
- System reference: `CONTEXT.md`.
- Project rules and agent config: `.claude/`.

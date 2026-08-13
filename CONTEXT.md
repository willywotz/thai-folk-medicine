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
Photos attach to healer, remedy, or case. Staff log in to write; the public reads.
Patient data in a case holds only age and sex (PDPA-safe).

## Backend layout

```
backend/
├── cmd/api/main.go                     # server start: config → migrate → wire → run
├── internal/
│   ├── domain/
│   │   ├── location/                   # Province, District, Repository interface
│   │   ├── healer/                     # Healer entity, events, ErrReferenced
│   │   ├── remedy/                     # Remedy entity, events, ErrReferenced
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
│   │   ├── staff/                      # guarded: dashboard → district → healer list/new/edit
│   │   ├── bff/session/                # POST login / DELETE logout (sets httpOnly cookie)
│   │   ├── bff/healers/                # POST / [healerId] PUT·DELETE (cookie → Bearer → Go)
│   │   └── layout.tsx                  # Thai font shell (Noto Sans Thai) + TanStack Query Providers
│   ├── components/                     # public: RecordCard, Breadcrumb, …; staff: LoginForm, HealerAdminList, HealerForm, LogoutButton
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
- `withinlazy`: no photo-gallery-by-owner (needs a backend `GET /{owner}/{id}/photos`
  endpoint); breadcrumb shows a static "District" label (needs `GET /districts/{id}`).

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

**The planned scope is complete:** backend API, public browse site, and full staff admin
(healers, remedies, treatment cases, and photos) all work end to end.

## How to run

```bash
cd backend
cp .env.example .env            # then export the vars, or use a loader
docker compose up -d            # Postgres
go run ./cmd/api                # starts on HTTP_PORT (default 8080)
```

Tests: `go test ./...`
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

## Possible future work

- Search by symptom / herb (public + a search box).
- `GET /districts/{id}` so staff breadcrumbs show the district name.
- Swap the local-disk `photo.Store` for S3/MinIO before horizontal scaling.
- Staff roles (admin vs normal) if the team grows.
- End-to-end tests (Playwright) across the login → manage → browse flow.
- Possible backend follow-ups: `GET /districts/{id}` and photo-gallery-by-owner endpoints
  (see the `withinlazy` notes above); search by symptom/herb.

**Carry-forward note:** `sqlc.yaml` points `schema:` at the whole `migrations/`
directory. As new entity migrations land, keep DML seed migrations free of
constructs the sqlc catalog cannot model.

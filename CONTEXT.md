# CONTEXT

This project is a web app. It keeps Thai folk-medicine records (ตำรายาหมอพื้นบ้าน)
for one province. It groups all data by district (อำเภอ). The app saves the
knowledge of local healers, and it shows the knowledge to the public.

First province: **Yasothon** (ยโสธร). The design allows more provinces later.

## Architecture

- **Backend:** Go API (`backend/`), Clean Architecture, 15-Factor, event-driven (planned).
- **Frontend:** Next.js (planned, not started).
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
│   │   └── event/                      # pure Event port (EventName)
│   ├── usecase/                        # Location/Healer/Remedy/TreatmentCase services, Publisher port
│   ├── adapter/
│   │   ├── http/                       # Gin router (RouteRegistrar), handlers, DTOs
│   │   └── repository/                 # Postgres repo + sqlc-generated db/
│   └── platform/
│       ├── config/                     # env config (caarlos0/env)
│       ├── database/                   # pgx pool + golang-migrate
│       └── eventbus/                   # in-process event bus (slog audit)
├── migrations/                         # SQL + Yasothon seed
└── sqlc.yaml
```

## Tech stack

- **Backend:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, caarlos0/env, log/slog,
  testify, testcontainers-go.
- **Frontend (planned):** Next.js App Router + TypeScript, Tailwind + shadcn/ui,
  TanStack Query, react-hook-form + zod, httpOnly cookie + Next.js proxy.
- **Auth (planned):** golang-jwt + bcrypt, one staff type.

## Current state — Plan 1 + Plan 2 + Plan 3 done

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

Full test suite green (unit + testcontainers integration). Whole-branch review: **SHIP**.

**SECURITY NOTE:** all staff write routes (healer, remedy, treatment case) are **not**
guarded yet. JWT auth arrives in Plan 4. Do not deploy publicly before then.

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

## Next plans

4. Auth (JWT login, middleware) + photos (PhotoStore).
5. Next.js frontend.

**Carry-forward note:** `sqlc.yaml` points `schema:` at the whole `migrations/`
directory. As new entity migrations land, keep DML seed migrations free of
constructs the sqlc catalog cannot model.

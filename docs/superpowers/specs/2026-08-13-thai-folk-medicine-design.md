# Thai Folk-Medicine Records — Design Spec

Date: 2026-08-13
Status: Approved (brainstorming)

## 1. Purpose

The app keeps folk-medicine records (ตำรายาหมอพื้นบ้าน) of local healers.
It saves the knowledge before it is lost. It shows the knowledge to the public.
The app groups all data by district (อำเภอ). The first province is Yasothon (ยโสธร).
The design lets you add more provinces later.

## 2. Users

- **Staff** log in. They add and edit all records.
- **The public** read only. They do not log in.
- One staff type for now (no roles yet).

## 3. Scope (first version)

In scope:
- Staff manage healers, remedies, treatment cases, and photos.
- The public browse by district: district → healer → remedy → case.
- The public read photos.
- Simple staff login (username or email + password, JWT token).

Out of scope for now (add later):
- Search by symptom or herb.
- Staff roles (admin vs normal).
- S3/MinIO photo storage and a real message broker.

## 4. Approach — Lean (chosen)

- **Photos:** local disk in development, behind a `PhotoStore` interface. Swap for
  S3/MinIO later with no change to use cases.
- **Events:** in-process event bus (Go). Use cases depend on an `EventPublisher`
  interface. Swap for a broker (for example NATS) later.
- No MinIO and no message broker in the first version.

## 5. Architecture

Two apps in one repository (monorepo). Clean Architecture in the backend.
Dependencies point inward: `domain` ← `usecase` ← `adapter`/`platform`.

```
thai-folk-medicine/
├── backend/                 # Go API (Clean Architecture)
│   ├── cmd/api/             # main.go — starts the HTTP server
│   ├── internal/
│   │   ├── domain/          # entities + interfaces (no framework code)
│   │   │   ├── healer/
│   │   │   ├── remedy/
│   │   │   ├── treatmentcase/
│   │   │   └── location/    # province + district
│   │   ├── usecase/         # application logic
│   │   ├── adapter/
│   │   │   ├── http/        # handlers, router, DTOs
│   │   │   └── repository/  # Postgres implementations
│   │   ├── event/           # in-process event bus
│   │   └── platform/        # config, database, photo store
│   ├── migrations/          # SQL schema + seed data
│   └── go.mod
├── frontend/                # Next.js app (public read + staff pages)
└── docker-compose.yml       # Postgres (+ API and web later)
```

- `domain` knows nothing about HTTP, SQL, or Next.js. It holds entities and
  interfaces (`HealerRepository`, `PhotoStore`, `EventPublisher`).
- `usecase` holds the actions and uses the domain interfaces.
- `adapter/http` connects HTTP to use cases. `adapter/repository` connects
  Postgres to use cases.
- `platform` holds config (from environment, 12-Factor), the database pool, and
  the photo store.

**Request flow:** `Next.js → HTTP handler → use case → repository (Postgres)`.
The use case publishes an event after a successful write.

## 6. Domain model

```
Province (1) ─< District (1) ─< Healer (1) ─< Remedy (1) ─< Case
                                                    Photo >─┘ (owner: healer | remedy | case)
StaffUser  (stands alone — for login)
```

- `district_id` sits on `healer`. A remedy and a case reach their district
  through the healer. So the whole tree stays under one district.
- `treatment_case` also keeps `healer_id`. This makes "all cases by this healer"
  fast.
- Patient data holds only age and sex. No name, no address. This keeps the
  public view safe and follows PDPA (health data is a special category).

### 6.1 Postgres tables

| Table | Key fields |
|---|---|
| `province` | id, name_thai, name_english |
| `district` | id, province_id → province, name_thai, name_english |
| `healer` | id, district_id → district, full_name, sub_district (null), specialty, biography, created_at, updated_at |
| `remedy` | id, healer_id → healer, name, symptoms, ingredients, preparation_method, usage, note (null), created_at, updated_at |
| `treatment_case` | id, remedy_id → remedy, healer_id → healer, patient_age, patient_sex, symptoms, result, treated_on (date), note (null), created_at, updated_at |
| `photo` | id, owner_type ('healer' \| 'remedy' \| 'case'), owner_id, object_key, caption (null), created_at |
| `staff_user` | id, username (unique), email (unique), password_hash, created_at |

- One `photo` table for all three owners (simple polymorphic link). It holds the
  `object_key` (the file name in the photo store), not the image bytes.
- `province` and `district` are seeded in the first migration: Yasothon and its
  9 districts. Add more provinces later by adding rows — no code change.

### 6.2 Yasothon districts (seed)

Mueang Yasothon, Sai Mun, Kut Chum, Kham Khuean Kaeo, Pa Tio,
Maha Chana Chai, Kho Wang, Loeng Nok Tha, Thai Charoen.
(Thai names stored in `name_thai`.)

## 7. API endpoints

Base path `/api/v1`. Full English words, no short forms. Resource names plural.

### 7.1 Public (read only, no token)

| Method | Route |
|---|---|
| GET | `/api/v1/provinces` |
| GET | `/api/v1/provinces/{provinceId}/districts` |
| GET | `/api/v1/districts/{districtId}/healers` |
| GET | `/api/v1/healers/{healerId}` |
| GET | `/api/v1/healers/{healerId}/remedies` |
| GET | `/api/v1/remedies/{remedyId}` |
| GET | `/api/v1/remedies/{remedyId}/treatment-cases` |
| GET | `/api/v1/treatment-cases/{treatmentCaseId}` |
| GET | `/api/v1/photos/{photoId}` (serves the image) |

### 7.2 Staff (needs token)

| Method | Route |
|---|---|
| POST | `/api/v1/authentication/login` |
| POST · PUT · DELETE | `/api/v1/healers` · `/api/v1/healers/{healerId}` |
| POST · PUT · DELETE | `/api/v1/remedies` · `/api/v1/remedies/{remedyId}` |
| POST · PUT · DELETE | `/api/v1/treatment-cases` · `/api/v1/treatment-cases/{treatmentCaseId}` |
| POST · DELETE | `/api/v1/photos` · `/api/v1/photos/{photoId}` |

- `POST /api/v1/photos` takes the image file + `ownerType` + `ownerId`. It saves
  the file to the photo store and writes one `photo` row.
- Login returns a signed JWT. Staff send it in the `Authorization` header for
  every write. The public routes need no token.

### 7.3 Search (later)

`GET /api/v1/remedies?symptom=...&herb=...`.

## 8. Events (in-process bus)

- `internal/event` has a bus with `Publish(event)` and `Subscribe(type, handler)`.
- A use case publishes after a successful write: `HealerCreated`, `RemedyCreated`,
  `TreatmentCaseCreated`, and the update/delete pairs.
- The first handler writes an audit log line. Later, a handler updates a search
  index.
- Use cases depend on an `EventPublisher` interface, not the concrete bus.
- `withinlazy:` in-process bus; add a broker (NATS) if the app splits into many
  services. Events do not survive a restart in this version.

## 9. Photos (PhotoStore interface)

- `PhotoStore` has `Save(file) → objectKey`, `Delete(objectKey)`, and a read to
  serve the file.
- The first implementation writes to `./storage/photo`, behind the interface.
- `withinlazy:` local disk store; swap for S3/MinIO in production.

## 10. Auth (simple)

- One staff type. `POST /api/v1/authentication/login` checks username or email +
  password (bcrypt hash).
- Login returns a JWT. A middleware checks the token on all write routes.
- The JWT secret comes from an environment variable (12-Factor config).

## 11. Testing (TDD, required)

Red → green → refactor for every unit.

- **Use cases:** unit tests with fake repositories and a fake event publisher
  (fast, no database).
- **Repositories:** integration tests against a real Postgres in Docker.
- **HTTP handlers:** tests with `net/http/httptest`.
- The event bus and the local photo store each get a small unit test.

## 12. Methodology compliance

- **15-Factor:** config from environment, backing services (Postgres, photo
  store) behind interfaces, stateless API, logs to stdout.
- **Clean Architecture:** dependencies point inward; domain has no framework
  code.
- **Event-Driven:** use cases emit domain events through an `EventPublisher`.

## 13. Tech stack (decided)

### 13.1 Backend (Go 1.26.5+)

| Concern | Choice | Rule |
|---|---|---|
| HTTP framework | **Gin** | Only in `adapter/http`. Domain and usecase never import it. |
| Postgres access | **pgx + sqlc** | Write SQL; sqlc generates typed Go. |
| Migrations | **golang-migrate** | Plain SQL `up`/`down` files. Pairs with sqlc. |
| Auth token | **golang-jwt/jwt** | Signed JWT; secret from environment. |
| Password hash | **golang.org/x/crypto/bcrypt** | Standard. |
| Config | **caarlos0/env** | Environment only (12-Factor). |
| Logging | **log/slog** (stdlib) | Structured JSON to stdout. No zap for now. |
| Testing | **testing + testify** | Asserts. |
| Integration DB | **testcontainers-go** | Real Postgres for repository tests. |

### 13.2 Frontend (Node 24+)

| Concern | Choice |
|---|---|
| Framework | **Next.js App Router + TypeScript** |
| Public pages | Server components fetch the Go API |
| Styling / components | **Tailwind CSS + shadcn/ui** |
| Staff data | **TanStack Query** |
| Staff forms | **react-hook-form + zod** |
| Auth token | **httpOnly cookie**; Next.js proxies `/api` to keep it same-origin |
| Package manager | **pnpm** |
| Unit tests | **Vitest + React Testing Library** |
| End-to-end (later) | **Playwright** |
| Lint / format | **ESLint (Next.js) + Prettier** |

### 13.3 Notes

- Gin, pgx, sqlc-generated code, and golang-jwt all stay in the outer layers
  (`adapter`, `platform`). The `domain` and `usecase` layers stay free of these
  dependencies.
- `slog` can be swapped for `zap` later through the `slog` handler bridge, with
  no change to call sites.
- Build the API first. Add the Next.js pages after the API is stable.

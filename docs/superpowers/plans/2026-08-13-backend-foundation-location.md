# Backend Foundation + Location Browse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Go API with Clean Architecture and serve the public province/district browse endpoints, seeded with Yasothon and its 9 districts.

**Architecture:** Clean Architecture. Dependencies point inward: `domain` (entities + interfaces) ← `usecase` (services) ← `adapter` (Gin HTTP, Postgres repository) and `platform` (config, database). Gin, pgx, and sqlc-generated code stay in the outer layers only. This plan is the first of a series; it delivers a working read-only API.

**Tech Stack:** Go 1.26.5+, Gin, pgx/v5, sqlc, golang-migrate, caarlos0/env, log/slog, testify, testcontainers-go, Docker (Postgres).

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md`

## Global Constraints

- **Go version:** 1.26.5 or newer.
- **Module path:** `github.com/willywotz/thai-folk-medicine/backend`.
- **Clean Architecture:** `internal/domain` and `internal/usecase` MUST NOT import Gin, pgx, or sqlc-generated code. Framework code lives only in `internal/adapter/*` and `internal/platform/*`.
- **Routes:** full English words, no short forms; every route is under the `/api/v1` prefix.
- **Config:** read only from environment variables (12-Factor).
- **TDD:** red → green → refactor for every unit. No implementation before a failing test.
- **Commits:** Conventional Commits. Commit at the end of each task.
- **Branch:** work on a feature branch, never on `main`.
- **Integration tests** (repository) need Docker running for testcontainers-go.

---

### Task 1: Project scaffold, config, health endpoint

**Files:**
- Create: `backend/go.mod` (via `go mod init`)
- Create: `backend/internal/platform/config/config.go`
- Test: `backend/internal/platform/config/config_test.go`
- Create: `backend/internal/adapter/http/router.go`
- Create: `backend/internal/adapter/http/health_handler.go`
- Test: `backend/internal/adapter/http/health_handler_test.go`
- Create: `backend/cmd/api/main.go`
- Create: `backend/docker-compose.yml`
- Create: `backend/.env.example`

**Interfaces:**
- Produces: `config.Config{ HTTPPort string; DatabaseURL string }`, `config.Load() (config.Config, error)`.
- Produces: `httpapi.NewRouter() *gin.Engine` (registers the health route), `httpapi.Health(c *gin.Context)`.

- [ ] **Step 1: Initialize the module and install dependencies**

```bash
mkdir -p backend && cd backend
go mod init github.com/willywotz/thai-folk-medicine/backend
go get github.com/gin-gonic/gin
go get github.com/caarlos0/env/v11
go get github.com/stretchr/testify
```

- [ ] **Step 2: Write the failing config test**

Create `backend/internal/platform/config/config_test.go`:

```go
package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadReadsEnvironment(t *testing.T) {
	t.Setenv("HTTP_PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	got, err := Load()

	require.NoError(t, err)
	assert.Equal(t, "9090", got.HTTPPort)
	assert.Equal(t, "postgres://localhost/test", got.DatabaseURL)
}

func TestLoadDefaultsHTTPPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	got, err := Load()

	require.NoError(t, err)
	assert.Equal(t, "8080", got.HTTPPort)
}

func TestLoadFailsWhenDatabaseURLMissing(t *testing.T) {
	_, err := Load()

	assert.Error(t, err)
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `go test ./internal/platform/config/... -v`
Expected: FAIL (compile error — `Load` and `Config` are undefined).

- [ ] **Step 4: Write the minimal config implementation**

Create `backend/internal/platform/config/config.go`:

```go
// Package config loads runtime settings from environment variables.
package config

import "github.com/caarlos0/env/v11"

// Config holds all runtime settings.
type Config struct {
	HTTPPort    string `env:"HTTP_PORT" envDefault:"8080"`
	DatabaseURL string `env:"DATABASE_URL,required"`
}

// Load reads the configuration from the environment.
func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, err
	}
	return c, nil
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `go test ./internal/platform/config/... -v`
Expected: PASS (all three tests).

- [ ] **Step 6: Write the failing health handler test**

Create `backend/internal/adapter/http/health_handler_test.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthReturnsOK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := NewRouter()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "ok", body["status"])
}
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `go test ./internal/adapter/http/... -v`
Expected: FAIL (compile error — `NewRouter` undefined).

- [ ] **Step 8: Write the router and health handler**

Create `backend/internal/adapter/http/health_handler.go`:

```go
package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health reports that the service is running.
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
```

Create `backend/internal/adapter/http/router.go`:

```go
// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// NewRouter builds the Gin engine and registers the base routes.
func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)
	return r
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `go test ./internal/adapter/http/... -v`
Expected: PASS.

- [ ] **Step 10: Write main, docker-compose, and env example**

Create `backend/cmd/api/main.go`:

```go
// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"log/slog"
	"os"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	router := httpapi.NewRouter()

	logger.Info("starting server", "port", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
```

Note: the import path `.../internal/adapter/http` has package name `httpapi`; keep the alias-free import — Go resolves the package by its declared name `httpapi`.

Create `backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: folk
      POSTGRES_PASSWORD: folk
      POSTGRES_DB: folk_medicine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Create `backend/.env.example`:

```bash
HTTP_PORT=8080
DATABASE_URL=postgres://folk:folk@localhost:5432/folk_medicine?sslmode=disable
```

- [ ] **Step 11: Verify the build and full test run**

Run: `go build ./... && go test ./...`
Expected: build succeeds; all tests PASS.

- [ ] **Step 12: Commit**

```bash
git add backend
git commit -m "feat: scaffold Go API with config and health endpoint"
```

---

### Task 2: Database pool, migrations, and Yasothon seed

**Files:**
- Create: `backend/migrations/000001_create_location.up.sql`
- Create: `backend/migrations/000001_create_location.down.sql`
- Create: `backend/migrations/000002_seed_yasothon.up.sql`
- Create: `backend/migrations/000002_seed_yasothon.down.sql`
- Create: `backend/migrations/embed.go`
- Create: `backend/internal/platform/database/database.go`
- Test: `backend/internal/platform/database/database_test.go`

**Interfaces:**
- Produces: `migrations.FS embed.FS` (embedded SQL files).
- Produces: `database.NewPool(ctx context.Context, url string) (*pgxpool.Pool, error)`.
- Produces: `database.Migrate(url string) error` (applies all up migrations from the embedded FS).

- [ ] **Step 1: Install database and migration dependencies**

```bash
cd backend
go get github.com/jackc/pgx/v5
go get github.com/jackc/pgx/v5/pgxpool
go get github.com/golang-migrate/migrate/v4
go get github.com/golang-migrate/migrate/v4/database/postgres
go get github.com/golang-migrate/migrate/v4/source/iofs
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres
```

- [ ] **Step 2: Write the location schema migration**

Create `backend/migrations/000001_create_location.up.sql`:

```sql
CREATE TABLE province (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_thai    TEXT NOT NULL,
    name_english TEXT NOT NULL
);

CREATE TABLE district (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    province_id  BIGINT NOT NULL REFERENCES province (id),
    name_thai    TEXT NOT NULL,
    name_english TEXT NOT NULL
);

CREATE INDEX district_province_id_idx ON district (province_id);
```

Create `backend/migrations/000001_create_location.down.sql`:

```sql
DROP TABLE IF EXISTS district;
DROP TABLE IF EXISTS province;
```

- [ ] **Step 3: Write the Yasothon seed migration**

Create `backend/migrations/000002_seed_yasothon.up.sql`:

```sql
INSERT INTO province (name_thai, name_english)
VALUES ('ยโสธร', 'Yasothon');

INSERT INTO district (province_id, name_thai, name_english)
SELECT p.id, seed.name_thai, seed.name_english
FROM province p
CROSS JOIN (
    VALUES
        ('เมืองยโสธร', 'Mueang Yasothon'),
        ('ทรายมูล', 'Sai Mun'),
        ('กุดชุม', 'Kut Chum'),
        ('คำเขื่อนแก้ว', 'Kham Khuean Kaeo'),
        ('ป่าติ้ว', 'Pa Tio'),
        ('มหาชนะชัย', 'Maha Chana Chai'),
        ('ค้อวัง', 'Kho Wang'),
        ('เลิงนกทา', 'Loeng Nok Tha'),
        ('ไทยเจริญ', 'Thai Charoen')
) AS seed (name_thai, name_english)
WHERE p.name_english = 'Yasothon';
```

Create `backend/migrations/000002_seed_yasothon.down.sql`:

```sql
DELETE FROM district
WHERE province_id IN (SELECT id FROM province WHERE name_english = 'Yasothon');

DELETE FROM province WHERE name_english = 'Yasothon';
```

- [ ] **Step 4: Embed the migrations**

Create `backend/migrations/embed.go`:

```go
// Package migrations embeds the SQL migration files.
package migrations

import "embed"

// FS holds all migration files.
//
//go:embed *.sql
var FS embed.FS
```

- [ ] **Step 5: Write the failing database integration test**

Create `backend/internal/platform/database/database_test.go`:

```go
package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func startPostgres(t *testing.T) string {
	t.Helper()
	ctx := context.Background()

	container, err := tcpostgres.Run(ctx, "postgres:17",
		tcpostgres.WithDatabase("folk_medicine"),
		tcpostgres.WithUsername("folk"),
		tcpostgres.WithPassword("folk"),
		tcpostgres.BasicWaitStrategies(),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(container) })

	url, err := container.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)
	return url
}

func TestMigrateSeedsYasothon(t *testing.T) {
	url := startPostgres(t)
	ctx := context.Background()

	require.NoError(t, Migrate(url))

	pool, err := NewPool(ctx, url)
	require.NoError(t, err)
	defer pool.Close()

	var provinceCount int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM province WHERE name_english = 'Yasothon'`).Scan(&provinceCount))
	assert.Equal(t, 1, provinceCount)

	var districtCount int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM district`).Scan(&districtCount))
	assert.Equal(t, 9, districtCount)
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `go test ./internal/platform/database/... -v`
Expected: FAIL (compile error — `Migrate` and `NewPool` undefined).

- [ ] **Step 7: Write the database implementation**

Create `backend/internal/platform/database/database.go`:

```go
// Package database opens the Postgres pool and runs migrations.
package database

import (
	"context"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	pgxstdlib "github.com/jackc/pgx/v5/stdlib"

	"github.com/willywotz/thai-folk-medicine/backend/migrations"
)

// NewPool opens a Postgres connection pool.
func NewPool(ctx context.Context, url string) (*pgxpool.Pool, error) {
	return pgxpool.New(ctx, url)
}

// Migrate applies every up migration from the embedded files.
func Migrate(url string) error {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}

	db, err := pgxstdlib.Open("pgx", url)
	if err != nil {
		return err
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
```

Note: run `go get github.com/jackc/pgx/v5/stdlib` if it is not already pulled in by the pgx dependency.

- [ ] **Step 8: Run the test to verify it passes**

Run: `go test ./internal/platform/database/... -v`
Expected: PASS (Docker must be running).

- [ ] **Step 9: Wire migration into main on startup**

In `backend/cmd/api/main.go`, add the migration call after loading config and before building the router:

```go
	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.Error("run migrations", "error", err)
		os.Exit(1)
	}
```

Add the import `"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"` to the import block.

- [ ] **Step 10: Verify the build**

Run: `go build ./...`
Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add backend
git commit -m "feat: add Postgres pool, migrations, and Yasothon seed"
```

---

### Task 3: Location domain, sqlc queries, and Postgres repository

**Files:**
- Create: `backend/internal/domain/location/location.go`
- Create: `backend/sqlc.yaml`
- Create: `backend/internal/adapter/repository/query/location.sql`
- Create (generated): `backend/internal/adapter/repository/db/*.go`
- Create: `backend/internal/adapter/repository/location_repository.go`
- Test: `backend/internal/adapter/repository/location_repository_test.go`

**Interfaces:**
- Produces: `location.Province{ ID int64; NameThai string; NameEnglish string }`.
- Produces: `location.District{ ID int64; ProvinceID int64; NameThai string; NameEnglish string }`.
- Produces: `location.Repository` interface with `ListProvince(ctx) ([]Province, error)` and `ListDistrictByProvince(ctx, provinceID int64) ([]District, error)`.
- Produces: `repository.NewLocation(q *db.Queries) *repository.Location` implementing `location.Repository`.
- Consumes: `database.NewPool`, `database.Migrate` from Task 2.

- [ ] **Step 1: Write the location domain entities and repository interface**

Create `backend/internal/domain/location/location.go`:

```go
// Package location holds the province and district entities and their
// repository interface. It imports no framework code.
package location

import "context"

// Province is one Thai province.
type Province struct {
	ID          int64
	NameThai    string
	NameEnglish string
}

// District is one district (อำเภอ) inside a province.
type District struct {
	ID          int64
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// Repository reads provinces and districts.
type Repository interface {
	ListProvince(ctx context.Context) ([]Province, error)
	ListDistrictByProvince(ctx context.Context, provinceID int64) ([]District, error)
}
```

- [ ] **Step 2: Write the sqlc config**

Create `backend/sqlc.yaml`:

```yaml
version: "2"
sql:
  - engine: "postgresql"
    schema: "migrations"
    queries: "internal/adapter/repository/query"
    gen:
      go:
        package: "db"
        out: "internal/adapter/repository/db"
        sql_package: "pgx/v5"
        emit_empty_slices: true
```

Note: sqlc recognizes the golang-migrate file naming and applies only the `*.up.sql` files when building the catalog.

- [ ] **Step 3: Write the location queries**

Create `backend/internal/adapter/repository/query/location.sql`:

```sql
-- name: ListProvince :many
SELECT id, name_thai, name_english
FROM province
ORDER BY name_english;

-- name: ListDistrictByProvince :many
SELECT id, province_id, name_thai, name_english
FROM district
WHERE province_id = $1
ORDER BY name_english;
```

- [ ] **Step 4: Generate the sqlc code**

Install sqlc once if needed, then generate:

```bash
cd backend
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
sqlc generate
```

Expected: files appear under `internal/adapter/repository/db/` including `db.go`, `models.go`, and `location.sql.go`. The generated `db.Queries` has methods `ListProvince(ctx) ([]Province, error)` and `ListDistrictByProvince(ctx, provinceID int64) ([]District, error)`, and `db.New(pool)` returns `*Queries`.

- [ ] **Step 5: Write the failing repository integration test**

Create `backend/internal/adapter/repository/location_repository_test.go`:

```go
package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
)

func newTestPool(t *testing.T) (context.Context, *db.Queries) {
	t.Helper()
	ctx := context.Background()

	container, err := tcpostgres.Run(ctx, "postgres:17",
		tcpostgres.WithDatabase("folk_medicine"),
		tcpostgres.WithUsername("folk"),
		tcpostgres.WithPassword("folk"),
		tcpostgres.BasicWaitStrategies(),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(container) })

	url, err := container.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)
	require.NoError(t, database.Migrate(url))

	pool, err := database.NewPool(ctx, url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	return ctx, db.New(pool)
}

func TestLocationListProvinceReturnsYasothon(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)

	require.NoError(t, err)
	require.Len(t, provinces, 1)
	assert.Equal(t, "Yasothon", provinces[0].NameEnglish)
	assert.Equal(t, "ยโสธร", provinces[0].NameThai)
}

func TestLocationListDistrictByProvinceReturnsNine(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewLocation(queries)

	provinces, err := repo.ListProvince(ctx)
	require.NoError(t, err)
	require.Len(t, provinces, 1)

	districts, err := repo.ListDistrictByProvince(ctx, provinces[0].ID)

	require.NoError(t, err)
	assert.Len(t, districts, 9)
	assert.Equal(t, provinces[0].ID, districts[0].ProvinceID)
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `go test ./internal/adapter/repository/... -v`
Expected: FAIL (compile error — `NewLocation` undefined).

- [ ] **Step 7: Write the Postgres location repository**

Create `backend/internal/adapter/repository/location_repository.go`:

```go
// Package repository implements the domain repository interfaces on Postgres.
package repository

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

// Location reads provinces and districts from Postgres.
type Location struct {
	q *db.Queries
}

// NewLocation builds the location repository.
func NewLocation(q *db.Queries) *Location {
	return &Location{q: q}
}

// ListProvince returns every province.
func (r *Location) ListProvince(ctx context.Context) ([]location.Province, error) {
	rows, err := r.q.ListProvince(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]location.Province, 0, len(rows))
	for _, row := range rows {
		result = append(result, location.Province{
			ID:          row.ID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
		})
	}
	return result, nil
}

// ListDistrictByProvince returns the districts of one province.
func (r *Location) ListDistrictByProvince(ctx context.Context, provinceID int64) ([]location.District, error) {
	rows, err := r.q.ListDistrictByProvince(ctx, provinceID)
	if err != nil {
		return nil, err
	}

	result := make([]location.District, 0, len(rows))
	for _, row := range rows {
		result = append(result, location.District{
			ID:          row.ID,
			ProvinceID:  row.ProvinceID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
		})
	}
	return result, nil
}
```

Note: confirm the generated field types are `int64` and `string`. If sqlc emits `pgtype` values for any column, the columns above are `BIGINT NOT NULL` and `TEXT NOT NULL`, so sqlc emits plain `int64` and `string` — no conversion needed.

- [ ] **Step 8: Run the test to verify it passes**

Run: `go test ./internal/adapter/repository/... -v`
Expected: PASS (Docker running).

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat: add location domain and Postgres repository"
```

---

### Task 4: Location use case

**Files:**
- Create: `backend/internal/usecase/location_service.go`
- Test: `backend/internal/usecase/location_service_test.go`

**Interfaces:**
- Consumes: `location.Repository`, `location.Province`, `location.District` from Task 3.
- Produces: `usecase.NewLocationService(repo location.Repository) *usecase.LocationService`.
- Produces: methods `ListProvince(ctx) ([]location.Province, error)` and `ListDistrictByProvince(ctx, provinceID int64) ([]location.District, error)`.

- [ ] **Step 1: Write the failing use case test with a fake repository**

Create `backend/internal/usecase/location_service_test.go`:

```go
package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

type fakeLocationRepo struct {
	provinces []location.Province
	districts []location.District
	err       error
}

func (f *fakeLocationRepo) ListProvince(context.Context) ([]location.Province, error) {
	return f.provinces, f.err
}

func (f *fakeLocationRepo) ListDistrictByProvince(_ context.Context, provinceID int64) ([]location.District, error) {
	if f.err != nil {
		return nil, f.err
	}
	var out []location.District
	for _, d := range f.districts {
		if d.ProvinceID == provinceID {
			out = append(out, d)
		}
	}
	return out, nil
}

func TestListProvincePassesThrough(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{{ID: 1, NameEnglish: "Yasothon"}}}
	service := NewLocationService(repo)

	got, err := service.ListProvince(context.Background())

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Yasothon", got[0].NameEnglish)
}

func TestListDistrictByProvinceFiltersByProvince(t *testing.T) {
	repo := &fakeLocationRepo{districts: []location.District{
		{ID: 1, ProvinceID: 1, NameEnglish: "Kut Chum"},
		{ID: 2, ProvinceID: 2, NameEnglish: "Other"},
	}}
	service := NewLocationService(repo)

	got, err := service.ListDistrictByProvince(context.Background(), 1)

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Kut Chum", got[0].NameEnglish)
}

func TestListProvinceReturnsRepoError(t *testing.T) {
	repo := &fakeLocationRepo{err: errors.New("db down")}
	service := NewLocationService(repo)

	_, err := service.ListProvince(context.Background())

	assert.Error(t, err)
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/usecase/... -v`
Expected: FAIL (compile error — `NewLocationService` undefined).

- [ ] **Step 3: Write the location service**

Create `backend/internal/usecase/location_service.go`:

```go
// Package usecase holds the application services. It depends on the domain
// interfaces only, never on Gin, pgx, or sqlc code.
package usecase

import (
	"context"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

// LocationService reads provinces and districts.
type LocationService struct {
	repo location.Repository
}

// NewLocationService builds the location service.
func NewLocationService(repo location.Repository) *LocationService {
	return &LocationService{repo: repo}
}

// ListProvince returns every province.
func (s *LocationService) ListProvince(ctx context.Context) ([]location.Province, error) {
	return s.repo.ListProvince(ctx)
}

// ListDistrictByProvince returns the districts of one province.
func (s *LocationService) ListDistrictByProvince(ctx context.Context, provinceID int64) ([]location.District, error) {
	return s.repo.ListDistrictByProvince(ctx, provinceID)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `go test ./internal/usecase/... -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add location use case service"
```

---

### Task 5: Location HTTP handlers and router wiring

**Files:**
- Create: `backend/internal/adapter/http/location_handler.go`
- Modify: `backend/internal/adapter/http/router.go`
- Test: `backend/internal/adapter/http/location_handler_test.go`
- Modify: `backend/cmd/api/main.go`

**Interfaces:**
- Consumes: `usecase.LocationService` from Task 4; `location.Repository` (via a fake) for the handler test.
- Produces: `httpapi.NewLocationHandler(service *usecase.LocationService) *httpapi.LocationHandler`.
- Produces: `httpapi.NewRouter(location *LocationHandler) *gin.Engine` (router now takes the location handler and registers the `/api/v1` group).

- [ ] **Step 1: Write the failing location handler test**

Create `backend/internal/adapter/http/location_handler_test.go`:

```go
package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type fakeLocationRepo struct {
	provinces []location.Province
	districts []location.District
}

func (f *fakeLocationRepo) ListProvince(context.Context) ([]location.Province, error) {
	return f.provinces, nil
}

func (f *fakeLocationRepo) ListDistrictByProvince(_ context.Context, provinceID int64) ([]location.District, error) {
	var out []location.District
	for _, d := range f.districts {
		if d.ProvinceID == provinceID {
			out = append(out, d)
		}
	}
	return out, nil
}

func newTestRouter(repo location.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewLocationService(repo)
	handler := NewLocationHandler(service)
	return NewRouter(handler)
}

func TestListProvinceEndpoint(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{
		{ID: 1, NameThai: "ยโสธร", NameEnglish: "Yasothon"},
	}}
	router := newTestRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Yasothon", body[0]["nameEnglish"])
	assert.Equal(t, float64(1), body[0]["id"])
}

func TestListDistrictEndpoint(t *testing.T) {
	repo := &fakeLocationRepo{districts: []location.District{
		{ID: 5, ProvinceID: 1, NameThai: "กุดชุม", NameEnglish: "Kut Chum"},
	}}
	router := newTestRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/1/districts", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Kut Chum", body[0]["nameEnglish"])
	assert.Equal(t, float64(1), body[0]["provinceId"])
}

func TestListDistrictRejectsBadProvinceID(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/abc/districts", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/adapter/http/... -v`
Expected: FAIL (compile errors — `NewLocationHandler` undefined; `NewRouter` signature mismatch).

- [ ] **Step 3: Write the location handler and DTOs**

Create `backend/internal/adapter/http/location_handler.go`:

```go
package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// LocationHandler serves the province and district read endpoints.
type LocationHandler struct {
	service *usecase.LocationService
}

// NewLocationHandler builds the location handler.
func NewLocationHandler(service *usecase.LocationService) *LocationHandler {
	return &LocationHandler{service: service}
}

type provinceDTO struct {
	ID          int64  `json:"id"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

type districtDTO struct {
	ID          int64  `json:"id"`
	ProvinceID  int64  `json:"provinceId"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

// ListProvince handles GET /api/v1/provinces.
func (h *LocationHandler) ListProvince(c *gin.Context) {
	provinces, err := h.service.ListProvince(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list provinces"})
		return
	}

	out := make([]provinceDTO, 0, len(provinces))
	for _, p := range provinces {
		out = append(out, provinceDTO(p))
	}
	c.JSON(http.StatusOK, out)
}

// ListDistrictByProvince handles GET /api/v1/provinces/:provinceId/districts.
func (h *LocationHandler) ListDistrictByProvince(c *gin.Context) {
	provinceID, err := strconv.ParseInt(c.Param("provinceId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "province id must be a number"})
		return
	}

	districts, err := h.service.ListDistrictByProvince(c.Request.Context(), provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list districts"})
		return
	}

	out := make([]districtDTO, 0, len(districts))
	for _, d := range districts {
		out = append(out, districtDTO(d))
	}
	c.JSON(http.StatusOK, out)
}

// toProvinceDTO and toDistrictDTO use direct conversion because the DTO and the
// domain struct share identical field names and types.
var _ = location.Province{}
```

Note: the `provinceDTO(p)` and `districtDTO(d)` conversions compile only while the DTO fields match the domain fields one-for-one, in the same order. Keep them aligned. The trailing `var _ = location.Province{}` keeps the `location` import used; remove it if you reference `location` elsewhere in the file.

- [ ] **Step 4: Update the router to register the location routes**

Replace `backend/internal/adapter/http/router.go` with:

```go
// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// NewRouter builds the Gin engine and registers all routes.
func NewRouter(location *LocationHandler) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/provinces", location.ListProvince)
		v1.GET("/provinces/:provinceId/districts", location.ListDistrictByProvince)
	}
	return r
}
```

- [ ] **Step 5: Fix the health test for the new router signature**

In `backend/internal/adapter/http/health_handler_test.go`, update the router construction:

```go
	router := NewRouter(NewLocationHandler(nil))
```

The health route does not touch the location handler, so a `nil` service is safe for that test.

- [ ] **Step 6: Run the handler tests to verify they pass**

Run: `go test ./internal/adapter/http/... -v`
Expected: PASS (health + province + district + bad-id tests).

- [ ] **Step 7: Wire the real dependencies in main**

Replace the body of `main` in `backend/cmd/api/main.go` so it builds the pool, repository, service, and handler, then passes the handler to the router. The full file:

```go
// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"context"
	"log/slog"
	"os"

	httpapi "github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.Error("run migrations", "error", err)
		os.Exit(1)
	}

	pool, err := database.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Error("open pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	queries := db.New(pool)
	locationRepo := repository.NewLocation(queries)
	locationService := usecase.NewLocationService(locationRepo)
	locationHandler := httpapi.NewLocationHandler(locationService)

	router := httpapi.NewRouter(locationHandler)

	logger.Info("starting server", "port", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
```

Note: `db.New(pool)` accepts the pool because the generated `db` package's `DBTX` interface matches `*pgxpool.Pool`. The import alias `httpapi` is explicit here to avoid confusion with the standard `net/http`.

- [ ] **Step 8: Run the full build and test suite**

Run: `go build ./... && go test ./...`
Expected: build succeeds; all tests PASS.

- [ ] **Step 9: Manual smoke test (optional, needs Docker)**

```bash
docker compose up -d
export $(grep -v '^#' .env.example | xargs)
go run ./cmd/api &
curl -s localhost:8080/api/v1/provinces
curl -s localhost:8080/api/v1/provinces/1/districts
```

Expected: the first curl returns Yasothon; the second returns 9 districts. Stop the server and `docker compose down` after.

- [ ] **Step 10: Commit**

```bash
git add backend
git commit -m "feat: add location HTTP endpoints under /api/v1"
```

---

## Self-Review

**Spec coverage (Plan 1 slice):**
- Clean Architecture layout (spec §5) — Tasks 1–5 build `domain`, `usecase`, `adapter/http`, `adapter/repository`, `platform`. ✓
- Province/District model + Yasothon seed (spec §6.1, §6.2) — Task 2. ✓
- Public read routes `/api/v1/provinces`, `/api/v1/provinces/{provinceId}/districts` (spec §7.1) — Task 5. ✓
- Tech: Gin at edge, pgx+sqlc, golang-migrate, caarlos0/env, slog, testify, testcontainers (spec §13) — Tasks 1–5. ✓
- Deferred by design to later plans: healer/remedy/case/photo/auth, the event bus, search. Stated in the plan header. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows real code. Error handling is concrete (bad id → 400, repo error → 500). ✓

**Type consistency:** `location.Province`/`location.District` field names and types (`int64`, `string`) are identical across the domain (Task 3), the repository mapping (Task 3), the service (Task 4), the fake repos (Tasks 4–5), and the DTO conversions (Task 5). `NewRouter` gains its `*LocationHandler` parameter in Task 5 and both the health test and main are updated in the same task. ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-13-backend-foundation-location.md`.

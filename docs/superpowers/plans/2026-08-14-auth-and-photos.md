# Auth (JWT) + Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staff login (JWT) and a JWT middleware that guards every write route, and add photo upload/serve/delete backed by a swappable `PhotoStore` (local disk now).

**Architecture:** Clean Architecture, continuing Plans 1–3. New: `staff` domain + repository; a `platform/token` JWT manager behind a `TokenIssuer`/`TokenVerifier` seam; an `AuthService` (bcrypt) in the use-case layer; a two-group router (public + JWT-protected) so all writes are guarded; a `photo` domain with a `Store` port and a local-disk implementation. Photo writes publish events like the other aggregates.

**Tech Stack:** Go 1.26.5, Gin, pgx/v5 + sqlc, golang-migrate, golang-jwt/jwt v5, golang.org/x/crypto/bcrypt, log/slog, testify, testcontainers-go.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§6 photo, §7 auth/photo routes, §10 auth).

## Global Constraints

- **Go:** 1.26.5+. **Module:** `github.com/willywotz/thai-folk-medicine/backend`.
- **Clean Architecture:** `internal/domain/*` and `internal/usecase` import NO web/db framework (no gin, pgx, pgtype, sqlc `db`, concrete `eventbus`, concrete `token`). Allowed in the use case: `golang.org/x/crypto/bcrypt` (a crypto primitive) and the `io` package. JWT signing lives in `internal/platform/token`; the use case depends on a `TokenIssuer` interface. Gin only in `internal/adapter/http`.
- **Security (this plan closes the Plan 2–3 gap):** every write route (healer/remedy/treatment-case/photo POST·PUT·DELETE) sits behind the JWT middleware. Public GET routes and `POST /authentication/login` stay open. Remove the `withinlazy: unguarded` comments as routes become guarded.
- **Passwords:** bcrypt hash only; never store or log plaintext. **Tokens:** HS256, secret from `JWT_SECRET` (required env). Login returns the token in the JSON body (the Next.js proxy will move it to an httpOnly cookie in Plan 5).
- **First staff user:** bootstrap from env — if `STAFF_ADMIN_USERNAME` and `STAFF_ADMIN_PASSWORD` are set AND the staff table is empty, create that admin at startup. No hardcoded default password. If unset, create nobody.
- **Photos:** stored via a `photo.Store` port; the only implementation writes to `PHOTO_STORAGE_DIR` (default `./storage/photo`). `withinlazy: local disk store; swap for S3/MinIO later.` The `photo` row holds only the object key, never bytes. `GET /photos/{photoId}` is public; upload/delete are guarded.
- **Routes (full English, under `/api/v1`):** `POST /authentication/login`; `POST /photos`, `DELETE /photos/{photoId}`, `GET /photos/{photoId}`.
- **Validation at the write boundary:** login needs non-empty username + password; photo upload needs a file, a valid `ownerType` ∈ {healer, remedy, case}, and `ownerId > 0`.
- **TDD** mandatory; **Conventional Commits**, one per task; **branch** `feat/auth-photos`. Integration tests need Docker + `TESTCONTAINERS_RYUK_DISABLED=true`.

---

### Task 1: Staff domain, migration, repository

**Files:**
- Create: `backend/internal/domain/staff/staff.go`
- Create: `backend/migrations/000006_create_staff_user.up.sql`, `.down.sql`
- Create: `backend/internal/adapter/repository/query/staff.sql`
- Regenerate: `db/*` (`sqlc generate`)
- Create: `backend/internal/adapter/repository/staff_repository.go`
- Test: `backend/internal/adapter/repository/staff_repository_test.go`

**Interfaces:**
- Produces: `staff.Staff{ ID int64; Username, Email, PasswordHash string; CreatedAt time.Time }`; `staff.CreateParams{ Username, Email, PasswordHash string }`; `staff.ErrNotFound`; `staff.Repository{ GetByUsername(ctx, username) (Staff, error); Create(ctx, CreateParams) (Staff, error); Count(ctx) (int64, error) }`.
- Produces: `repository.NewStaff(q *db.Queries) *repository.Staff`.

- [ ] **Step 1: Write the staff domain**

Create `backend/internal/domain/staff/staff.go`:

```go
// Package staff holds the staff-user entity and repository interface.
// It imports no framework code.
package staff

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound means no staff user has the given username.
var ErrNotFound = errors.New("staff not found")

// Staff is one staff account that may add and edit records.
type Staff struct {
	ID           int64
	Username     string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// CreateParams holds the fields to create a staff user.
type CreateParams struct {
	Username     string
	Email        string
	PasswordHash string
}

// Repository stores and reads staff users.
type Repository interface {
	GetByUsername(ctx context.Context, username string) (Staff, error)
	Create(ctx context.Context, p CreateParams) (Staff, error)
	Count(ctx context.Context) (int64, error)
}
```

- [ ] **Step 2: Write the migration**

Create `backend/migrations/000006_create_staff_user.up.sql`:

```sql
CREATE TABLE staff_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Create `backend/migrations/000006_create_staff_user.down.sql`:

```sql
DROP TABLE IF EXISTS staff_user;
```

- [ ] **Step 3: Write the queries**

Create `backend/internal/adapter/repository/query/staff.sql`:

```sql
-- name: GetStaffByUsername :one
SELECT id, username, email, password_hash, created_at
FROM staff_user
WHERE username = $1;

-- name: CreateStaff :one
INSERT INTO staff_user (username, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, username, email, password_hash, created_at;

-- name: CountStaff :one
SELECT count(*) FROM staff_user;
```

- [ ] **Step 4: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: `db` gains `GetStaffByUsername`, `CreateStaff`, `CountStaff`, model `db.StaffUser`, and `CreateStaffParams`. `CountStaff` returns `(int64, error)`.

- [ ] **Step 5: Write the failing repository test**

Create `backend/internal/adapter/repository/staff_repository_test.go`:

```go
package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

func TestStaffCreateGetCount(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewStaff(queries)

	count, err := repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	created, err := repo.Create(ctx, staff.CreateParams{
		Username: "admin", Email: "admin@example.local", PasswordHash: "hash",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)

	got, err := repo.GetByUsername(ctx, "admin")
	require.NoError(t, err)
	assert.Equal(t, "admin", got.Username)
	assert.Equal(t, "hash", got.PasswordHash)

	count, err = repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

func TestStaffGetMissingReturnsNotFound(t *testing.T) {
	ctx, queries := newTestPool(t)
	_, err := NewStaff(queries).GetByUsername(ctx, "ghost")
	assert.True(t, errors.Is(err, staff.ErrNotFound))
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run Staff -v`
Expected: FAIL (compile error — `NewStaff` undefined).

- [ ] **Step 7: Write the staff repository**

Create `backend/internal/adapter/repository/staff_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

// Staff stores and reads staff users in Postgres.
type Staff struct {
	q *db.Queries
}

// NewStaff builds the staff repository.
func NewStaff(q *db.Queries) *Staff {
	return &Staff{q: q}
}

func toStaff(row db.StaffUser) staff.Staff {
	return staff.Staff{
		ID:           row.ID,
		Username:     row.Username,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt.Time,
	}
}

// GetByUsername returns one staff user or staff.ErrNotFound.
func (r *Staff) GetByUsername(ctx context.Context, username string) (staff.Staff, error) {
	row, err := r.q.GetStaffByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return staff.Staff{}, staff.ErrNotFound
		}
		return staff.Staff{}, err
	}
	return toStaff(row), nil
}

// Create inserts a staff user.
func (r *Staff) Create(ctx context.Context, p staff.CreateParams) (staff.Staff, error) {
	row, err := r.q.CreateStaff(ctx, db.CreateStaffParams{
		Username:     p.Username,
		Email:        p.Email,
		PasswordHash: p.PasswordHash,
	})
	if err != nil {
		return staff.Staff{}, err
	}
	return toStaff(row), nil
}

// Count returns how many staff users exist.
func (r *Staff) Count(ctx context.Context) (int64, error) {
	return r.q.CountStaff(ctx)
}
```

Note: confirm the sqlc `db.StaffUser.CreatedAt` type is `pgtype.Timestamptz` (map `.Time`), consistent with the other tables.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -v`
Then `go build ./... && go vet ./... && gofmt -l . && go mod tidy`.
Expected: PASS + clean.

- [ ] **Step 9: Commit** (orchestrator commits.)

---

### Task 2: Config, JWT token manager, auth use case

**Files:**
- Modify: `backend/internal/platform/config/config.go` (add JWTSecret, PhotoStorageDir, StaffAdmin* )
- Modify: `backend/internal/platform/config/config_test.go` (set JWT_SECRET in existing tests; add new)
- Modify: `backend/.env.example`
- Create: `backend/internal/platform/token/token.go`
- Test: `backend/internal/platform/token/token_test.go`
- Create: `backend/internal/usecase/auth_service.go`
- Test: `backend/internal/usecase/auth_service_test.go`

**Interfaces:**
- Produces: `config.Config` gains `JWTSecret string` (required), `PhotoStorageDir string` (default `./storage/photo`), `StaffAdminUsername`, `StaffAdminPassword`, `StaffAdminEmail string` (default `admin@example.local`).
- Produces: `token.NewManager(secret string, ttl time.Duration) *token.Manager`; `Manager.Issue(staffID int64) (string, error)`; `Manager.Verify(tokenString string) (int64, error)` (returns the staff id, or an error for bad/expired tokens).
- Produces: `usecase.ErrInvalidCredentials`; `usecase.TokenIssuer` interface (`Issue(staffID int64) (string, error)`); `usecase.NewAuthService(repo staff.Repository, issuer TokenIssuer) *usecase.AuthService`; `AuthService.Login(ctx, username, password string) (string, error)`.

- [ ] **Step 1: Extend the config**

Replace `backend/internal/platform/config/config.go`:

```go
// Package config loads runtime settings from environment variables.
package config

import "github.com/caarlos0/env/v11"

// Config holds all runtime settings.
type Config struct {
	HTTPPort           string `env:"HTTP_PORT" envDefault:"8080"`
	DatabaseURL        string `env:"DATABASE_URL,required"`
	JWTSecret          string `env:"JWT_SECRET,required"`
	PhotoStorageDir    string `env:"PHOTO_STORAGE_DIR" envDefault:"./storage/photo"`
	StaffAdminUsername string `env:"STAFF_ADMIN_USERNAME"`
	StaffAdminPassword string `env:"STAFF_ADMIN_PASSWORD"`
	StaffAdminEmail    string `env:"STAFF_ADMIN_EMAIL" envDefault:"admin@example.local"`
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

- [ ] **Step 2: Update the config tests for the new required var**

In `backend/internal/platform/config/config_test.go`, add `t.Setenv("JWT_SECRET", "test-secret")` to `TestLoadReadsEnvironment` and `TestLoadDefaultsHTTPPort` (so they still pass), and add:

```go
func TestLoadFailsWhenJWTSecretMissing(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("JWT_SECRET", "")
	os.Unsetenv("JWT_SECRET")

	_, err := Load()

	assert.Error(t, err)
}

func TestLoadDefaultsPhotoStorageDir(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("JWT_SECRET", "test-secret")

	got, err := Load()

	require.NoError(t, err)
	assert.Equal(t, "./storage/photo", got.PhotoStorageDir)
}
```

Also update `TestLoadFailsWhenDatabaseURLMissing` to set `JWT_SECRET` so it fails specifically on the missing DATABASE_URL (it already asserts only that an error occurs, so this is optional but keeps intent clear). Ensure `os` is imported.

- [ ] **Step 3: Update `.env.example`**

Append to `backend/.env.example`:

```bash
JWT_SECRET=change-me-in-production
PHOTO_STORAGE_DIR=./storage/photo
STAFF_ADMIN_USERNAME=admin
STAFF_ADMIN_PASSWORD=change-me
STAFF_ADMIN_EMAIL=admin@example.local
```

- [ ] **Step 4: Install golang-jwt and bcrypt**

```bash
cd backend
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
```

- [ ] **Step 5: Write the failing token test**

Create `backend/internal/platform/token/token_test.go`:

```go
package token

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIssueThenVerifyRoundTrips(t *testing.T) {
	m := NewManager("secret", time.Hour)

	tok, err := m.Issue(42)
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	id, err := m.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, int64(42), id)
}

func TestVerifyRejectsGarbage(t *testing.T) {
	m := NewManager("secret", time.Hour)
	_, err := m.Verify("not-a-token")
	assert.Error(t, err)
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	tok, err := NewManager("secret-a", time.Hour).Issue(1)
	require.NoError(t, err)

	_, err = NewManager("secret-b", time.Hour).Verify(tok)
	assert.Error(t, err)
}

func TestVerifyRejectsExpired(t *testing.T) {
	m := NewManager("secret", -time.Minute) // already expired
	tok, err := m.Issue(1)
	require.NoError(t, err)

	_, err = m.Verify(tok)
	assert.Error(t, err)
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && go test ./internal/platform/token/... -v`
Expected: FAIL (compile error — `NewManager` undefined).

- [ ] **Step 7: Write the token manager**

Create `backend/internal/platform/token/token.go`:

```go
// Package token issues and verifies signed JWT access tokens.
package token

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Manager signs and verifies HS256 tokens whose subject is the staff id.
type Manager struct {
	secret []byte
	ttl    time.Duration
}

// NewManager builds a token manager.
func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

// Issue returns a signed token for the given staff id.
func (m *Manager) Issue(staffID int64) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(staffID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

// Verify checks the token and returns its staff id.
func (m *Manager) Verify(tokenString string) (int64, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(claims.Subject, 10, 64)
}
```

Note: `time.Now()` is real runtime code (allowed in the app; only the workflow-script sandbox forbids it). `jwt.ParseWithClaims` validates expiry automatically.

- [ ] **Step 8: Run the token tests to verify they pass**

Run: `cd backend && go test ./internal/platform/token/... -v`
Expected: PASS (4 tests).

- [ ] **Step 9: Write the failing auth use case test**

Create `backend/internal/usecase/auth_service_test.go`:

```go
package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

type fakeStaffRepo struct {
	user staff.Staff
	err  error
}

func (f *fakeStaffRepo) GetByUsername(_ context.Context, username string) (staff.Staff, error) {
	if f.err != nil {
		return staff.Staff{}, f.err
	}
	if username != f.user.Username {
		return staff.Staff{}, staff.ErrNotFound
	}
	return f.user, nil
}
func (f *fakeStaffRepo) Create(context.Context, staff.CreateParams) (staff.Staff, error) {
	return staff.Staff{}, nil
}
func (f *fakeStaffRepo) Count(context.Context) (int64, error) { return 0, nil }

type fakeIssuer struct{ issued int64 }

func (f *fakeIssuer) Issue(staffID int64) (string, error) {
	f.issued = staffID
	return "token-for-" + string(rune(staffID)), nil
}

func staffWithPassword(t *testing.T, password string) staff.Staff {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	return staff.Staff{ID: 7, Username: "admin", PasswordHash: string(hash)}
}

func TestLoginSucceedsWithCorrectPassword(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	issuer := &fakeIssuer{}
	service := NewAuthService(repo, issuer)

	tok, err := service.Login(context.Background(), "admin", "secret")

	require.NoError(t, err)
	assert.NotEmpty(t, tok)
	assert.Equal(t, int64(7), issuer.issued)
}

func TestLoginFailsWithWrongPassword(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "admin", "wrong")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestLoginFailsForUnknownUser(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "ghost", "secret")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestLoginPropagatesRepoError(t *testing.T) {
	repo := &fakeStaffRepo{err: errors.New("db down")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "admin", "secret")

	assert.Error(t, err)
	assert.NotErrorIs(t, err, ErrInvalidCredentials)
}
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd backend && go test ./internal/usecase/... -run Login -v`
Expected: FAIL (compile error — `NewAuthService` undefined).

- [ ] **Step 11: Write the auth service**

Create `backend/internal/usecase/auth_service.go`:

```go
package usecase

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

// ErrInvalidCredentials means the username or password did not match.
var ErrInvalidCredentials = errors.New("invalid credentials")

// TokenIssuer issues an access token for a staff id.
type TokenIssuer interface {
	Issue(staffID int64) (string, error)
}

// AuthService logs staff users in.
type AuthService struct {
	repo   staff.Repository
	issuer TokenIssuer
}

// NewAuthService builds the auth service.
func NewAuthService(repo staff.Repository, issuer TokenIssuer) *AuthService {
	return &AuthService{repo: repo, issuer: issuer}
}

// Login checks the credentials and returns a signed token.
func (s *AuthService) Login(ctx context.Context, username, password string) (string, error) {
	user, err := s.repo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, staff.ErrNotFound) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return "", ErrInvalidCredentials
	}
	return s.issuer.Issue(user.ID)
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `cd backend && go test ./internal/usecase/... ./internal/platform/... -v` then `go build ./... && go vet ./... && gofmt -l . && go mod tidy`.
Expected: PASS + clean. (Note: the token manager satisfies `usecase.TokenIssuer` structurally.)

- [ ] **Step 13: Commit** (orchestrator commits.)

---

### Task 3: Login endpoint, JWT middleware, guarded routes, admin bootstrap

**Files:**
- Create: `backend/internal/adapter/http/auth_handler.go`
- Test: `backend/internal/adapter/http/auth_handler_test.go`
- Create: `backend/internal/adapter/http/auth_middleware.go`
- Test: `backend/internal/adapter/http/auth_middleware_test.go`
- Modify: `backend/internal/adapter/http/router.go` (two groups: public + protected)
- Modify: `backend/internal/adapter/http/location_handler.go`, `healer_handler.go`, `remedy_handler.go`, `treatment_case_handler.go` (new `RegisterRoutes(public, protected)` signature; move writes to `protected`; drop `withinlazy` comments)
- Modify: the four handler test router-builders + `health_handler_test.go` for the new `NewRouter` signature
- Modify: `backend/cmd/api/main.go` (token manager, auth handler, middleware, admin bootstrap, wiring)

**Interfaces:**
- Produces: `httpapi.TokenVerifier` interface (`Verify(tokenString string) (int64, error)`); `httpapi.NewAuthMiddleware(verifier TokenVerifier) gin.HandlerFunc` (401 on missing/bad token; on success sets `staffID` in the context).
- Produces: `httpapi.NewAuthHandler(service *usecase.AuthService) *httpapi.AuthHandler` with `RegisterRoutes(public, protected *gin.RouterGroup)` mounting `POST /authentication/login` on **public**.
- Changes: `RouteRegistrar` interface becomes `RegisterRoutes(public, protected *gin.RouterGroup)`; `NewRouter(auth gin.HandlerFunc, registrar ...RouteRegistrar) *gin.Engine`.

- [ ] **Step 1: Refactor the router into public + protected groups**

Replace `backend/internal/adapter/http/router.go`:

```go
// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// RouteRegistrar registers its public (open) and protected (JWT-guarded) routes.
type RouteRegistrar interface {
	RegisterRoutes(public, protected *gin.RouterGroup)
}

// NewRouter builds the Gin engine. Public GET routes are open; protected routes
// go through the auth middleware. /health is always open.
func NewRouter(auth gin.HandlerFunc, registrar ...RouteRegistrar) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	protected.Use(auth)

	for _, reg := range registrar {
		reg.RegisterRoutes(public, protected)
	}
	return r
}
```

- [ ] **Step 2: Update the existing handlers' RegisterRoutes**

`location_handler.go` — reads only, all on public:

```go
// RegisterRoutes mounts the province and district read routes (all public).
func (h *LocationHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.GET("/provinces", h.ListProvince)
	public.GET("/provinces/:provinceId/districts", h.ListDistrictByProvince)
}
```

`healer_handler.go` — reads public, writes protected (remove the `withinlazy` comment):

```go
// RegisterRoutes mounts the healer routes: reads public, writes JWT-guarded.
func (h *HealerHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/districts/:districtId/healers", h.ListByDistrict)
	public.GET("/healers/:healerId", h.Get)
	protected.POST("/healers", h.Create)
	protected.PUT("/healers/:healerId", h.Update)
	protected.DELETE("/healers/:healerId", h.Delete)
}
```

`remedy_handler.go`:

```go
// RegisterRoutes mounts the remedy routes: reads public, writes JWT-guarded.
func (h *RemedyHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/healers/:healerId/remedies", h.ListByHealer)
	public.GET("/remedies/:remedyId", h.Get)
	protected.POST("/remedies", h.Create)
	protected.PUT("/remedies/:remedyId", h.Update)
	protected.DELETE("/remedies/:remedyId", h.Delete)
}
```

`treatment_case_handler.go`:

```go
// RegisterRoutes mounts the treatment-case routes: reads public, writes JWT-guarded.
func (h *TreatmentCaseHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/remedies/:remedyId/treatment-cases", h.ListByRemedy)
	public.GET("/treatment-cases/:treatmentCaseId", h.Get)
	protected.POST("/treatment-cases", h.Create)
	protected.PUT("/treatment-cases/:treatmentCaseId", h.Update)
	protected.DELETE("/treatment-cases/:treatmentCaseId", h.Delete)
}
```

- [ ] **Step 3: Write the failing middleware test**

Create `backend/internal/adapter/http/auth_middleware_test.go`:

```go
package httpapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type fakeVerifier struct{ id int64 }

func (f fakeVerifier) Verify(tokenString string) (int64, error) {
	if tokenString == "good" {
		return f.id, nil
	}
	return 0, errors.New("bad token")
}

func protectedTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(NewAuthMiddleware(fakeVerifier{id: 5}))
	r.GET("/x", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"staffId": c.GetInt64("staffId")})
	})
	return r
}

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestMiddlewareRejectsBadToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer nope")
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestMiddlewareAcceptsGoodToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer good")
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"staffId\":5")
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -run Middleware -v`
Expected: FAIL (compile error — `NewAuthMiddleware` undefined).

- [ ] **Step 5: Write the middleware**

Create `backend/internal/adapter/http/auth_middleware.go`:

```go
package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// TokenVerifier verifies a token string and returns its staff id.
type TokenVerifier interface {
	Verify(tokenString string) (int64, error)
}

// NewAuthMiddleware guards routes: it requires a valid Bearer token and stores
// the staff id in the context as "staffId".
func NewAuthMiddleware(verifier TokenVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		tokenString, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		staffID, err := verifier.Verify(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("staffId", staffID)
		c.Next()
	}
}
```

- [ ] **Step 6: Write the failing login handler test**

Create `backend/internal/adapter/http/auth_handler_test.go`:

```go
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type loginStaffRepo struct{ user staff.Staff }

func (r loginStaffRepo) GetByUsername(_ context.Context, username string) (staff.Staff, error) {
	if username == r.user.Username {
		return r.user, nil
	}
	return staff.Staff{}, staff.ErrNotFound
}
func (r loginStaffRepo) Create(context.Context, staff.CreateParams) (staff.Staff, error) {
	return staff.Staff{}, nil
}
func (r loginStaffRepo) Count(context.Context) (int64, error) { return 1, nil }

type stubIssuer struct{}

func (stubIssuer) Issue(int64) (string, error) { return "signed-token", nil }

func loginRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.DefaultCost)
	require.NoError(t, err)
	repo := loginStaffRepo{user: staff.Staff{ID: 1, Username: "admin", PasswordHash: string(hash)}}
	service := usecase.NewAuthService(repo, stubIssuer{})
	noAuth := func(c *gin.Context) { c.Next() }
	return NewRouter(noAuth, NewAuthHandler(service))
}

func TestLoginEndpointSucceeds(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "secret"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "signed-token", got["token"])
}

func TestLoginEndpointRejectsWrongPassword(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "wrong"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestLoginEndpointRejectsEmptyBody(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
```

- [ ] **Step 7: Write the login handler**

Create `backend/internal/adapter/http/auth_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// AuthHandler serves the login endpoint.
type AuthHandler struct {
	service *usecase.AuthService
}

// NewAuthHandler builds the auth handler.
func NewAuthHandler(service *usecase.AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

// RegisterRoutes mounts the login route on the public group.
func (h *AuthHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.POST("/authentication/login", h.Login)
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login handles POST /api/v1/authentication/login.
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		return
	}
	tok, err := h.service.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot log in"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": tok})
}
```

- [ ] **Step 8: Update the existing handler tests for the new NewRouter signature**

Every handler test that calls `NewRouter(...)` must now pass an auth middleware as the first argument. Add this helper near the top of each affected `_test.go` (or reuse one — they share package `httpapi`, so define it ONCE, e.g. in `auth_middleware_test.go`):

```go
// noAuth is a pass-through middleware for tests that don't exercise auth.
func noAuth(c *gin.Context) { c.Next() }
```

Then change the router builders:
- `health_handler_test.go`: `router := NewRouter(noAuth)`
- `location_handler_test.go` `newTestRouter`: `return NewRouter(noAuth, handler)`
- `healer_handler_test.go` `newTestRouter` (healer) — note it is currently `newTestRouter`; rename collision: the healer file's builder is `newHealerRouter`? Verify the actual name in the repo and update it to `return NewRouter(noAuth, NewHealerHandler(service))`.
- `remedy_handler_test.go` `newRemedyRouter`: `return NewRouter(noAuth, NewRemedyHandler(service))`
- `treatment_case_handler_test.go` `newCaseRouter`: `return NewRouter(noAuth, NewTreatmentCaseHandler(service))`

Define `noAuth` exactly once in the package to avoid a duplicate declaration. The `loginRouter` helper above already defines a local `noAuth` variable — change that to use the shared package-level `noAuth` function (delete its local one) so there is a single definition.

- [ ] **Step 9: Run all http tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: PASS (login, middleware, and all existing handler tests — writes still reachable through the pass-through `noAuth`).

- [ ] **Step 10: Wire the token manager, login, middleware, and admin bootstrap into main**

In `backend/cmd/api/main.go`:
1. Build the token manager: `tokenManager := token.NewManager(cfg.JWTSecret, 24*time.Hour)`.
2. Build the auth middleware: `authMiddleware := httpapi.NewAuthMiddleware(tokenManager)`.
3. Build the auth handler: `authHandler := httpapi.NewAuthHandler(usecase.NewAuthService(repository.NewStaff(queries), tokenManager))`.
4. Pass the middleware as the first `NewRouter` arg and add the auth handler:
   `router := httpapi.NewRouter(authMiddleware, authHandler, locationHandler, healerHandler, remedyHandler, treatmentCaseHandler)`.
5. Add the admin bootstrap AFTER the pool is open, BEFORE serving:

```go
	if err := bootstrapAdmin(context.Background(), repository.NewStaff(queries), cfg, logger); err != nil {
		logger.Error("bootstrap admin", "error", err)
		os.Exit(1)
	}
```

Add the bootstrap function:

```go
// bootstrapAdmin creates the first staff user from env when the table is empty.
func bootstrapAdmin(ctx context.Context, repo *repository.Staff, cfg config.Config, logger *slog.Logger) error {
	if cfg.StaffAdminUsername == "" || cfg.StaffAdminPassword == "" {
		return nil
	}
	count, err := repo.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.StaffAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := repo.Create(ctx, staff.CreateParams{
		Username:     cfg.StaffAdminUsername,
		Email:        cfg.StaffAdminEmail,
		PasswordHash: string(hash),
	}); err != nil {
		return err
	}
	logger.Info("created admin staff user", "username", cfg.StaffAdminUsername)
	return nil
}
```

Add imports: `"time"`, `"golang.org/x/crypto/bcrypt"`, `".../internal/domain/staff"`, `".../internal/platform/token"`.

- [ ] **Step 11: Run the full suite**

Run: `cd backend && go build ./... && go vet ./... && gofmt -l . && go mod tidy && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: clean + every package PASS.

- [ ] **Step 12: Commit** (orchestrator commits.)

---

### Task 4: Photo domain, store port, local-disk store, migration, repository

**Files:**
- Create: `backend/internal/domain/photo/photo.go`
- Create: `backend/internal/platform/photostore/localstore.go`
- Test: `backend/internal/platform/photostore/localstore_test.go`
- Create: `backend/migrations/000007_create_photo.up.sql`, `.down.sql`
- Create: `backend/internal/adapter/repository/query/photo.sql`
- Regenerate: `db/*`
- Create: `backend/internal/adapter/repository/photo_repository.go`
- Test: `backend/internal/adapter/repository/photo_repository_test.go`

**Interfaces:**
- Produces: `photo.Photo{ ID int64; OwnerType string; OwnerID int64; ObjectKey, Caption string; CreatedAt time.Time }`; owner-type constants `photo.OwnerHealer="healer"`, `photo.OwnerRemedy="remedy"`, `photo.OwnerCase="case"`; `photo.ValidOwnerType(string) bool`.
- Produces: `photo.ErrNotFound`; `photo.CreateParams{ OwnerType string; OwnerID int64; ObjectKey, Caption string }`; `photo.Repository{ Create, GetByID, Delete }`; events `CreatedEvent{PhotoID}`/`DeletedEvent{PhotoID}` (names `photo.created`/`photo.deleted`).
- Produces: `photo.Store` port: `Save(ctx, r io.Reader, ext string) (objectKey string, err error)`, `Open(ctx, objectKey string) (io.ReadCloser, error)`, `Delete(ctx, objectKey string) error`.
- Produces: `photostore.NewLocal(dir string) (*photostore.Local, error)` implementing `photo.Store` (writes under `dir`; object key is a random-free, collision-safe name — use a counter-free scheme: the repository supplies uniqueness via the DB id is NOT available at save time, so the store generates the key from a UUID-like value built by the caller). To avoid `Math.random`/uuid deps, the store accepts the key stem from the caller: **revise** — `Save` generates the key from `time`+a monotonic sequence guarded by a mutex. See Step 4.
- Produces: `repository.NewPhoto(q *db.Queries) *repository.Photo`.

- [ ] **Step 1: Write the photo domain**

Create `backend/internal/domain/photo/photo.go`:

```go
// Package photo holds the photo entity, its store port, events, and repository
// interface. It imports only stdlib (context, errors, io, time).
package photo

import (
	"context"
	"errors"
	"io"
	"time"
)

// Owner-type values. A photo belongs to a healer, a remedy, or a case.
const (
	OwnerHealer = "healer"
	OwnerRemedy = "remedy"
	OwnerCase   = "case"
)

// ErrNotFound means no photo has the given id.
var ErrNotFound = errors.New("photo not found")

// ValidOwnerType reports whether t is a known owner type.
func ValidOwnerType(t string) bool {
	return t == OwnerHealer || t == OwnerRemedy || t == OwnerCase
}

// Photo is one stored image linked to a healer, remedy, or case.
type Photo struct {
	ID        int64
	OwnerType string
	OwnerID   int64
	ObjectKey string
	Caption   string
	CreatedAt time.Time
}

// CreateParams holds the fields to create a photo row.
type CreateParams struct {
	OwnerType string
	OwnerID   int64
	ObjectKey string
	Caption   string
}

// Repository stores and reads photo rows (not the bytes).
type Repository interface {
	Create(ctx context.Context, p CreateParams) (Photo, error)
	GetByID(ctx context.Context, id int64) (Photo, error)
	Delete(ctx context.Context, id int64) error
}

// Store keeps the image bytes. The object key identifies a stored file.
type Store interface {
	Save(ctx context.Context, r io.Reader, ext string) (objectKey string, err error)
	Open(ctx context.Context, objectKey string) (io.ReadCloser, error)
	Delete(ctx context.Context, objectKey string) error
}

// CreatedEvent is published after a photo is stored.
type CreatedEvent struct{ PhotoID int64 }

// EventName identifies the event kind.
func (CreatedEvent) EventName() string { return "photo.created" }

// DeletedEvent is published after a photo is deleted.
type DeletedEvent struct{ PhotoID int64 }

// EventName identifies the event kind.
func (DeletedEvent) EventName() string { return "photo.deleted" }
```

- [ ] **Step 2: Write the failing local-store test**

Create `backend/internal/platform/photostore/localstore_test.go`:

```go
package photostore

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveOpenDelete(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)
	ctx := context.Background()

	key, err := store.Save(ctx, bytes.NewBufferString("image-bytes"), ".jpg")
	require.NoError(t, err)
	assert.NotEmpty(t, key)

	rc, err := store.Open(ctx, key)
	require.NoError(t, err)
	data, err := io.ReadAll(rc)
	require.NoError(t, rc.Close())
	require.NoError(t, err)
	assert.Equal(t, "image-bytes", string(data))

	require.NoError(t, store.Delete(ctx, key))
	_, err = store.Open(ctx, key)
	assert.Error(t, err)
}

func TestSaveGeneratesDistinctKeys(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)
	ctx := context.Background()

	k1, err := store.Save(ctx, bytes.NewBufferString("a"), ".png")
	require.NoError(t, err)
	k2, err := store.Save(ctx, bytes.NewBufferString("b"), ".png")
	require.NoError(t, err)

	assert.NotEqual(t, k1, k2)
}

func TestOpenRejectsPathTraversal(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)

	_, err = store.Open(context.Background(), "../../etc/passwd")
	assert.Error(t, err)
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && go test ./internal/platform/photostore/... -v`
Expected: FAIL (compile error — `NewLocal` undefined).

- [ ] **Step 4: Write the local-disk store**

Create `backend/internal/platform/photostore/localstore.go`:

```go
// Package photostore stores photo bytes on the local disk behind the photo.Store
// port. withinlazy: local disk store; swap for S3/MinIO in production.
package photostore

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Local writes photo files under a base directory.
type Local struct {
	dir string
	mu  sync.Mutex
	seq int64
}

// NewLocal builds a local store, creating the directory if needed.
func NewLocal(dir string) (*Local, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Local{dir: dir}, nil
}

// nextKey builds a collision-safe object key from the time and a sequence.
// withinlazy: time+sequence key; a UUID scheme if multiple instances share a disk.
func (l *Local) nextKey(ext string) string {
	l.mu.Lock()
	l.seq++
	seq := l.seq
	l.mu.Unlock()
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return fmt.Sprintf("%d-%d%s", time.Now().UnixNano(), seq, ext)
}

// safePath resolves key under the base dir, rejecting traversal.
func (l *Local) safePath(objectKey string) (string, error) {
	clean := filepath.Clean(objectKey)
	if strings.Contains(clean, "..") || filepath.IsAbs(clean) || strings.ContainsRune(clean, filepath.Separator) {
		return "", fmt.Errorf("invalid object key: %q", objectKey)
	}
	return filepath.Join(l.dir, clean), nil
}

// Save writes the reader to a new file and returns its object key.
func (l *Local) Save(_ context.Context, r io.Reader, ext string) (string, error) {
	key := l.nextKey(ext)
	path, err := l.safePath(key)
	if err != nil {
		return "", err
	}
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return key, nil
}

// Open opens a stored file for reading.
func (l *Local) Open(_ context.Context, objectKey string) (io.ReadCloser, error) {
	path, err := l.safePath(objectKey)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}

// Delete removes a stored file.
func (l *Local) Delete(_ context.Context, objectKey string) error {
	path, err := l.safePath(objectKey)
	if err != nil {
		return err
	}
	return os.Remove(path)
}
```

Note: `time.Now()` is real runtime code (allowed here). The path-traversal guard rejects any key containing a separator or `..`, so `Open("../../etc/passwd")` fails.

- [ ] **Step 5: Run the store tests to verify they pass**

Run: `cd backend && go test ./internal/platform/photostore/... -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the photo migration**

Create `backend/migrations/000007_create_photo.up.sql`:

```sql
CREATE TABLE photo (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('healer', 'remedy', 'case')),
    owner_id   BIGINT NOT NULL,
    object_key TEXT NOT NULL,
    caption    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX photo_owner_idx ON photo (owner_type, owner_id);
```

Create `backend/migrations/000007_create_photo.down.sql`:

```sql
DROP TABLE IF EXISTS photo;
```

Note: `photo` uses a polymorphic owner (no FK), so a photo can point at a healer, remedy, or case. The `CHECK` keeps the owner type valid.

- [ ] **Step 7: Write the photo queries + regenerate sqlc**

Create `backend/internal/adapter/repository/query/photo.sql`:

```sql
-- name: CreatePhoto :one
INSERT INTO photo (owner_type, owner_id, object_key, caption)
VALUES ($1, $2, $3, $4)
RETURNING id, owner_type, owner_id, object_key, caption, created_at;

-- name: GetPhoto :one
SELECT id, owner_type, owner_id, object_key, caption, created_at
FROM photo
WHERE id = $1;

-- name: DeletePhoto :execrows
DELETE FROM photo WHERE id = $1;
```

Run: `cd backend && sqlc generate`.

- [ ] **Step 8: Write the failing photo repository test**

Create `backend/internal/adapter/repository/photo_repository_test.go`:

```go
package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

func TestPhotoCreateGetDelete(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewPhoto(queries)

	created, err := repo.Create(ctx, photo.CreateParams{
		OwnerType: photo.OwnerHealer, OwnerID: 1, ObjectKey: "abc.jpg", Caption: "หมอ",
	})
	require.NoError(t, err)
	assert.NotZero(t, created.ID)

	got, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "abc.jpg", got.ObjectKey)
	assert.Equal(t, photo.OwnerHealer, got.OwnerType)

	require.NoError(t, repo.Delete(ctx, created.ID))
	_, err = repo.GetByID(ctx, created.ID)
	assert.True(t, errors.Is(err, photo.ErrNotFound))

	err = repo.Delete(ctx, created.ID)
	assert.True(t, errors.Is(err, photo.ErrNotFound))
}
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run Photo -v`
Expected: FAIL (compile error — `NewPhoto` undefined).

- [ ] **Step 10: Write the photo repository**

Create `backend/internal/adapter/repository/photo_repository.go`:

```go
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

// Photo stores and reads photo rows in Postgres.
type Photo struct {
	q *db.Queries
}

// NewPhoto builds the photo repository.
func NewPhoto(q *db.Queries) *Photo {
	return &Photo{q: q}
}

func toPhoto(row db.Photo) photo.Photo {
	return photo.Photo{
		ID:        row.ID,
		OwnerType: row.OwnerType,
		OwnerID:   row.OwnerID,
		ObjectKey: row.ObjectKey,
		Caption:   row.Caption,
		CreatedAt: row.CreatedAt.Time,
	}
}

// Create inserts a photo row.
func (r *Photo) Create(ctx context.Context, p photo.CreateParams) (photo.Photo, error) {
	row, err := r.q.CreatePhoto(ctx, db.CreatePhotoParams{
		OwnerType: p.OwnerType,
		OwnerID:   p.OwnerID,
		ObjectKey: p.ObjectKey,
		Caption:   p.Caption,
	})
	if err != nil {
		return photo.Photo{}, err
	}
	return toPhoto(row), nil
}

// GetByID returns one photo row or photo.ErrNotFound.
func (r *Photo) GetByID(ctx context.Context, id int64) (photo.Photo, error) {
	row, err := r.q.GetPhoto(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return photo.Photo{}, photo.ErrNotFound
		}
		return photo.Photo{}, err
	}
	return toPhoto(row), nil
}

// Delete removes a photo row or returns photo.ErrNotFound.
func (r *Photo) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeletePhoto(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return photo.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 11: Run the tests + full suite**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... ./internal/platform/photostore/... -v` then `go build ./... && go vet ./... && gofmt -l . && go mod tidy`.
Expected: PASS + clean.

- [ ] **Step 12: Commit** (orchestrator commits.)

---

### Task 5: Photo use case + HTTP (upload/serve/delete) + wiring

**Files:**
- Create: `backend/internal/usecase/photo_service.go`
- Test: `backend/internal/usecase/photo_service_test.go`
- Create: `backend/internal/adapter/http/photo_handler.go`
- Test: `backend/internal/adapter/http/photo_handler_test.go`
- Modify: `backend/cmd/api/main.go` (build store, photo stack, subscribe audit, wire handler)

**Interfaces:**
- Produces: `usecase.ErrInvalidPhoto`; `usecase.NewPhotoService(repo photo.Repository, store photo.Store, publisher Publisher) *usecase.PhotoService` with:
  - `Upload(ctx, ownerType string, ownerID int64, r io.Reader, ext, caption string) (photo.Photo, error)` — validates ownerType + ownerID>0, saves bytes via store, writes row, publishes `photo.CreatedEvent`. On a row-write error after the file is saved, best-effort delete the file.
  - `Get(ctx, id int64) (photo.Photo, error)`.
  - `OpenFile(ctx, p photo.Photo) (io.ReadCloser, error)` — opens the bytes via the store.
  - `Delete(ctx, id int64) error` — loads the row, deletes the row, deletes the file (best-effort), publishes `photo.DeletedEvent`.
- Produces: `httpapi.NewPhotoHandler(service *usecase.PhotoService) *httpapi.PhotoHandler` with `RegisterRoutes(public, protected)` — `GET /photos/:photoId` public; `POST /photos` and `DELETE /photos/:photoId` protected.

- [ ] **Step 1: Write the failing photo use case test**

Create `backend/internal/usecase/photo_service_test.go`:

```go
package usecase

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

type fakePhotoRepo struct {
	created  photo.Photo
	getErr   error
	createErr error
}

func (f *fakePhotoRepo) Create(_ context.Context, p photo.CreateParams) (photo.Photo, error) {
	if f.createErr != nil {
		return photo.Photo{}, f.createErr
	}
	f.created = photo.Photo{ID: 1, OwnerType: p.OwnerType, OwnerID: p.OwnerID, ObjectKey: p.ObjectKey}
	return f.created, nil
}
func (f *fakePhotoRepo) GetByID(_ context.Context, id int64) (photo.Photo, error) {
	if f.getErr != nil {
		return photo.Photo{}, f.getErr
	}
	return photo.Photo{ID: id, ObjectKey: "k.jpg"}, nil
}
func (f *fakePhotoRepo) Delete(context.Context, int64) error { return nil }

type fakeStore struct {
	saved    string
	deleted  string
	saveErr  error
}

func (f *fakeStore) Save(_ context.Context, _ io.Reader, ext string) (string, error) {
	if f.saveErr != nil {
		return "", f.saveErr
	}
	f.saved = "obj" + ext
	return f.saved, nil
}
func (f *fakeStore) Open(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewBufferString("bytes")), nil
}
func (f *fakeStore) Delete(_ context.Context, key string) error { f.deleted = key; return nil }

type photoRecorder struct{ events []event.Event }

func (r *photoRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func TestUploadStoresAndPublishes(t *testing.T) {
	repo := &fakePhotoRepo{}
	store := &fakeStore{}
	pub := &photoRecorder{}
	service := NewPhotoService(repo, store, pub)

	got, err := service.Upload(context.Background(), photo.OwnerHealer, 3, bytes.NewBufferString("img"), ".jpg", "cap")

	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	assert.Equal(t, "obj.jpg", store.saved)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "photo.created", pub.events[0].EventName())
}

func TestUploadRejectsBadOwnerType(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.Upload(context.Background(), "district", 3, bytes.NewBufferString("x"), ".jpg", "")
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestUploadRejectsBadOwnerID(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.Upload(context.Background(), photo.OwnerRemedy, 0, bytes.NewBufferString("x"), ".jpg", "")
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestUploadDeletesFileWhenRowFails(t *testing.T) {
	store := &fakeStore{}
	service := NewPhotoService(&fakePhotoRepo{createErr: errors.New("db")}, store, &photoRecorder{})

	_, err := service.Upload(context.Background(), photo.OwnerHealer, 3, bytes.NewBufferString("x"), ".jpg", "")

	require.Error(t, err)
	assert.Equal(t, "obj.jpg", store.deleted, "file should be cleaned up when the row write fails")
}

func TestDeletePublishesEvent(t *testing.T) {
	pub := &photoRecorder{}
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, pub)

	require.NoError(t, service.Delete(context.Background(), 5))

	require.Len(t, pub.events, 1)
	assert.Equal(t, "photo.deleted", pub.events[0].EventName())
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && go test ./internal/usecase/... -run Photo -v` (also `Upload`/`Delete`).
Expected: FAIL (compile error — `NewPhotoService` undefined).

- [ ] **Step 3: Write the photo service**

Create `backend/internal/usecase/photo_service.go`:

```go
package usecase

import (
	"context"
	"errors"
	"io"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

// ErrInvalidPhoto means the photo input failed validation.
var ErrInvalidPhoto = errors.New("invalid photo")

// PhotoService stores photo bytes and rows, publishing events on write.
type PhotoService struct {
	repo      photo.Repository
	store     photo.Store
	publisher Publisher
}

// NewPhotoService builds the photo service.
func NewPhotoService(repo photo.Repository, store photo.Store, publisher Publisher) *PhotoService {
	return &PhotoService{repo: repo, store: store, publisher: publisher}
}

// Upload stores the bytes, writes the row, and publishes CreatedEvent.
func (s *PhotoService) Upload(ctx context.Context, ownerType string, ownerID int64, r io.Reader, ext, caption string) (photo.Photo, error) {
	if !photo.ValidOwnerType(ownerType) || ownerID <= 0 {
		return photo.Photo{}, ErrInvalidPhoto
	}
	objectKey, err := s.store.Save(ctx, r, ext)
	if err != nil {
		return photo.Photo{}, err
	}
	created, err := s.repo.Create(ctx, photo.CreateParams{
		OwnerType: ownerType,
		OwnerID:   ownerID,
		ObjectKey: objectKey,
		Caption:   caption,
	})
	if err != nil {
		_ = s.store.Delete(ctx, objectKey) // best-effort cleanup
		return photo.Photo{}, err
	}
	s.publisher.Publish(ctx, photo.CreatedEvent{PhotoID: created.ID})
	return created, nil
}

// Get returns one photo row.
func (s *PhotoService) Get(ctx context.Context, id int64) (photo.Photo, error) {
	return s.repo.GetByID(ctx, id)
}

// OpenFile opens the stored bytes for a photo.
func (s *PhotoService) OpenFile(ctx context.Context, p photo.Photo) (io.ReadCloser, error) {
	return s.store.Open(ctx, p.ObjectKey)
}

// Delete removes the row and the file, then publishes DeletedEvent.
func (s *PhotoService) Delete(ctx context.Context, id int64) error {
	found, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	_ = s.store.Delete(ctx, found.ObjectKey) // best-effort; row is the source of truth
	s.publisher.Publish(ctx, photo.DeletedEvent{PhotoID: id})
	return nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && go test ./internal/usecase/... -v`
Expected: PASS.

- [ ] **Step 5: Write the failing photo handler test**

Create `backend/internal/adapter/http/photo_handler_test.go`:

```go
package httpapi

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubPhotoRepo struct{ getErr error }

func (s *stubPhotoRepo) Create(_ context.Context, p photo.CreateParams) (photo.Photo, error) {
	return photo.Photo{ID: 1, OwnerType: p.OwnerType, OwnerID: p.OwnerID, ObjectKey: p.ObjectKey}, nil
}
func (s *stubPhotoRepo) GetByID(_ context.Context, id int64) (photo.Photo, error) {
	if s.getErr != nil {
		return photo.Photo{}, s.getErr
	}
	return photo.Photo{ID: id, ObjectKey: "k.jpg", OwnerType: photo.OwnerHealer, OwnerID: 2}, nil
}
func (s *stubPhotoRepo) Delete(context.Context, int64) error { return nil }

type memStore struct{}

func (memStore) Save(_ context.Context, r io.Reader, ext string) (string, error) {
	return "obj" + ext, nil
}
func (memStore) Open(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewBufferString("image-bytes")), nil
}
func (memStore) Delete(context.Context, string) error { return nil }

func photoRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewPhotoService(&stubPhotoRepo{}, memStore{}, noopPub{})
	return NewRouter(noAuth, NewPhotoHandler(service))
}

func multipartUpload(t *testing.T, fields map[string]string, fileField, fileName, content string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for k, v := range fields {
		require.NoError(t, w.WriteField(k, v))
	}
	if fileField != "" {
		fw, err := w.CreateFormFile(fileField, fileName)
		require.NoError(t, err)
		_, err = io.WriteString(fw, content)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	return body, w.FormDataContentType()
}

func TestUploadPhotoEndpoint(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "healer", "ownerId": "2", "caption": "x"}, "file", "p.jpg", "img")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"ownerType\":\"healer\"")
}

func TestUploadPhotoRejectsBadOwnerType(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "district", "ownerId": "2"}, "file", "p.jpg", "img")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadPhotoRejectsMissingFile(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "healer", "ownerId": "2"}, "", "", "")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestServePhotoEndpoint(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/photos/1", nil)
	photoRouter().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "image-bytes", rec.Body.String())
}
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -run Photo -v`
Expected: FAIL (compile error — `NewPhotoHandler` undefined).

- [ ] **Step 7: Write the photo handler**

Create `backend/internal/adapter/http/photo_handler.go`:

```go
package httpapi

import (
	"errors"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// PhotoHandler serves photo upload, serve, and delete.
type PhotoHandler struct {
	service *usecase.PhotoService
}

// NewPhotoHandler builds the photo handler.
func NewPhotoHandler(service *usecase.PhotoService) *PhotoHandler {
	return &PhotoHandler{service: service}
}

// RegisterRoutes mounts the photo routes: serve public, upload/delete guarded.
func (h *PhotoHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/photos/:photoId", h.Serve)
	protected.POST("/photos", h.Upload)
	protected.DELETE("/photos/:photoId", h.Delete)
}

type photoDTO struct {
	ID        int64  `json:"id"`
	OwnerType string `json:"ownerType"`
	OwnerID   int64  `json:"ownerId"`
	Caption   string `json:"caption"`
}

func toPhotoDTO(p photo.Photo) photoDTO {
	return photoDTO{ID: p.ID, OwnerType: p.OwnerType, OwnerID: p.OwnerID, Caption: p.Caption}
}

// Upload handles POST /api/v1/photos (multipart: file, ownerType, ownerId, caption).
func (h *PhotoHandler) Upload(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a file is required"})
		return
	}
	ownerType := c.PostForm("ownerType")
	ownerID, err := strconv.ParseInt(c.PostForm("ownerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ownerId must be a number"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read the file"})
		return
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	created, err := h.service.Upload(c.Request.Context(), ownerType, ownerID, file, ext, c.PostForm("caption"))
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidPhoto) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ownerType must be healer|remedy|case and ownerId must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot store the photo"})
		return
	}
	c.JSON(http.StatusCreated, toPhotoDTO(created))
}

// Serve handles GET /api/v1/photos/:photoId (streams the bytes).
func (h *PhotoHandler) Serve(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("photoId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, photo.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read photo"})
		return
	}
	rc, err := h.service.OpenFile(c.Request.Context(), found)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open photo file"})
		return
	}
	defer rc.Close()

	contentType := mimeByExt(filepath.Ext(found.ObjectKey))
	c.DataFromReader(http.StatusOK, -1, contentType, rc, nil)
}

// Delete handles DELETE /api/v1/photos/:photoId.
func (h *PhotoHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("photoId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, photo.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete photo"})
		return
	}
	c.Status(http.StatusNoContent)
}

// mimeByExt maps a file extension to a content type for common image formats.
func mimeByExt(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}
```

Note: `c.DataFromReader` with length `-1` streams without a Content-Length; that is fine for the tests and for browsers. If you prefer a known length, stat the file in the store — not required here.

- [ ] **Step 8: Run the handler tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/... -v`
Expected: PASS.

- [ ] **Step 9: Wire the photo stack into main**

In `backend/cmd/api/main.go`:
1. Build the store: `photoStore, err := photostore.NewLocal(cfg.PhotoStorageDir)` (handle the error like the others).
2. Subscribe audit to `photo.created` and `photo.deleted`.
3. Build the handler: `photoHandler := httpapi.NewPhotoHandler(usecase.NewPhotoService(repository.NewPhoto(queries), photoStore, bus))`.
4. Add `photoHandler` to the `NewRouter(authMiddleware, authHandler, locationHandler, healerHandler, remedyHandler, treatmentCaseHandler, photoHandler)` call.

Add the import `".../internal/platform/photostore"`.

- [ ] **Step 10: Run the full suite**

Run: `cd backend && go build ./... && go vet ./... && gofmt -l . && go mod tidy && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: clean + every package PASS.

- [ ] **Step 11: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage:**
- staff_user table with unique username + email (spec §6.1) — Task 1. ✓
- `POST /authentication/login` returning a JWT; middleware on write routes (spec §7.2, §10) — Tasks 2–3. ✓
- bcrypt + JWT, secret from env (spec §10) — Tasks 2–3. ✓
- Photo table (polymorphic owner) + `PhotoStore` interface + local impl (spec §6.1, §9) — Tasks 4. ✓
- `POST /photos`, `DELETE /photos/{photoId}`, `GET /photos/{photoId}` (spec §7) — Task 5. ✓
- Security gap from Plans 2–3 closed: all writes now guarded — Task 3. ✓
- Photo events (EDA) + audit subscription — Tasks 4–5. ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Concrete status codes (401 unauth, 400 bad input, 404 not found, 201/204). Path traversal guarded in the store.

**Type consistency:** `staff.*`, `photo.*`, and the token `Manager` are used consistently across layers. `token.Manager` satisfies both `usecase.TokenIssuer` (Issue) and `httpapi.TokenVerifier` (Verify). `RouteRegistrar.RegisterRoutes(public, protected)` is changed in Task 3 and EVERY existing handler + test router-builder is updated in the same task; `NewRouter` gains the `auth` first parameter there. The photo `Store` port (domain) is satisfied by `photostore.Local` (platform). `Publisher` (from Plan 2) is reused for photo events. Owner-type strings `healer|remedy|case` match the migration `CHECK` and `photo.ValidOwnerType`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-auth-and-photos.md`.

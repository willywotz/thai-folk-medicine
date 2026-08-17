# Drop-Node Plan 1 — Backend Cookie Authentication

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Go backend accepts the staff JWT from an httpOnly `session` cookie (in addition to the `Authorization: Bearer` header), sets/clears that cookie on login/logout, and exposes `GET /api/v1/authentication/session` so a browser SPA can check auth. Nothing the current Next frontend does breaks.

**Architecture:** This is the first of three plans that move the app off a Node runtime (see `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`). It touches only the Go backend, keeps Bearer auth working (transition-safe), and is shippable on its own. Later plans replace the frontend with a Vite SPA that relies on this cookie auth.

**Tech Stack:** Go 1.26.5, Gin, `golang-jwt/jwt/v5`, testify. Tests are `httptest` + `gin.New()` in package `httpapi` (mirror `internal/adapter/http/auth_middleware_test.go`).

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`

## Global Constraints

- API route names are **full English words**, no abbreviations (project rule). New routes: `POST /api/v1/authentication/logout`, `GET /api/v1/authentication/session`. Login stays `POST /api/v1/authentication/login`.
- Cookie: name `session`, `HttpOnly`, `Path=/`, `Max-Age=86400` (matches the 24h JWT TTL), `SameSite=Lax`, `Secure` from config (`COOKIE_SECURE`, default `true`; dev sets `false`).
- Keep `Authorization: Bearer` working — the current Next frontend still uses it until Plan 3.
- TDD: failing test → confirm fail → minimal code → confirm pass. Run `go test ./...` from `backend/`.
- Clean Architecture: cookie/HTTP concerns live in `internal/adapter/http`; the token/usecase layers do not learn about cookies.

---

## File structure

- Modify `backend/internal/platform/config/config.go` — add `CookieSecure`.
- Modify `backend/internal/adapter/http/auth_middleware.go` — cookie fallback.
- Modify `backend/internal/adapter/http/auth_handler.go` — set/clear cookie, logout + session routes.
- Modify `backend/cmd/api/main.go` — pass `CookieSecure` into the handler.
- Modify `backend/internal/adapter/http/auth_middleware_test.go` and `auth_handler_test.go` — new tests.
- Modify `deploy/templates/compose.prod.yaml.j2` + `deploy/templates/env.j2` (+ `vars`) — set `COOKIE_SECURE=true` in prod; `compose.override.yaml` sets `false` for dev.

---

### Task 1: Auth middleware accepts the `session` cookie

**Files:**
- Modify: `backend/internal/adapter/http/auth_middleware.go`
- Test: `backend/internal/adapter/http/auth_middleware_test.go`

**Interfaces:**
- Consumes: `TokenVerifier.Verify(string) (int64, error)` (unchanged).
- Produces: middleware that reads the token from `Authorization: Bearer <t>` OR, if absent, from the `session` cookie; still sets `staffId` in context; still 401 when neither is present/valid.

- [ ] **Step 1: Write the failing tests**

Add to `auth_middleware_test.go` (the `protectedTestRouter` and `fakeVerifier{id:5}` already exist there):

```go
func TestMiddlewareAcceptsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "good"})
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestMiddlewareRejectsBadSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "nope"})
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && go test ./internal/adapter/http/ -run TestMiddleware -v`
Expected: `TestMiddlewareAcceptsSessionCookie` FAILS (401, cookie ignored).

- [ ] **Step 3: Implement the cookie fallback**

Replace the token-extraction block in `NewAuthMiddleware` (`auth_middleware.go`) with:

```go
	return func(c *gin.Context) {
		tokenString, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || tokenString == "" {
			if cookie, err := c.Cookie("session"); err == nil && cookie != "" {
				tokenString = cookie
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token or session cookie"})
				return
			}
		}
		staffID, err := verifier.Verify(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("staffId", staffID)
		c.Next()
	}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/ -run TestMiddleware -v`
Expected: all `TestMiddleware*` PASS (the pre-existing Bearer tests still pass).

- [ ] **Step 5: Commit**

```bash
git add backend/internal/adapter/http/auth_middleware.go backend/internal/adapter/http/auth_middleware_test.go
git commit -m "feat(auth): accept staff JWT from session cookie in middleware"
```

---

### Task 2: Config flag `CookieSecure`

**Files:**
- Modify: `backend/internal/platform/config/config.go`

**Interfaces:**
- Produces: `Config.CookieSecure bool` (env `COOKIE_SECURE`, default `true`). Consumed by the auth handler (Task 3) and wired in Task 4.

- [ ] **Step 1: Add the field**

In `config.go`, add to the `Config` struct after `JWTSecret`:

```go
	CookieSecure       bool   `env:"COOKIE_SECURE" envDefault:"true"`
```

- [ ] **Step 2: Verify it compiles and parses**

Run: `cd backend && go build ./... && go test ./internal/platform/config/... 2>&1 | tail -5`
Expected: builds; existing config behavior unchanged (default `true`).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/platform/config/config.go
git commit -m "feat(config): add COOKIE_SECURE flag (default true)"
```

---

### Task 3: Login sets the cookie; add logout and session endpoints

**Files:**
- Modify: `backend/internal/adapter/http/auth_handler.go`
- Test: `backend/internal/adapter/http/auth_handler_test.go`

**Interfaces:**
- Consumes: `usecase.AuthService.Login(ctx, user, pass) (string, error)` (unchanged); a `cookieSecure bool` passed to `NewAuthHandler`.
- Produces:
  - `NewAuthHandler(service *usecase.AuthService, cookieSecure bool) *AuthHandler` (new second parameter).
  - `POST /api/v1/authentication/login` — unchanged body `{"token"}`, now ALSO sets the `session` cookie.
  - `POST /api/v1/authentication/logout` — clears the cookie, returns 204.
  - `GET /api/v1/authentication/session` (protected) — returns `{"staffId": <int64>}`.

- [ ] **Step 1: Write the failing tests**

Open `auth_handler_test.go`, read its existing helper (how it builds the router + a fake/real `AuthService`). Add tests following that style. If the existing helper constructs `NewAuthHandler(service)`, it will stop compiling after Step 3 — update the helper call to pass `false` (test = insecure cookie) in the same step you change the signature. Tests to add:

```go
func TestLoginSetsSessionCookie(t *testing.T) {
	// reuse the file's existing helper that yields a router with a valid login;
	// post valid credentials, then assert the Set-Cookie header.
	rec := httptest.NewRecorder()
	body := `{"username":"admin","password":"admin"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginTestRouter().ServeHTTP(rec, req) // helper defined in this file
	assert.Equal(t, http.StatusOK, rec.Code)
	cookie := rec.Result().Cookies()
	require.Len(t, cookie, 1)
	assert.Equal(t, "session", cookie[0].Name)
	assert.NotEmpty(t, cookie[0].Value)
	assert.True(t, cookie[0].HttpOnly)
}

func TestLogoutClearsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/logout", nil)
	loginTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	cookie := rec.Result().Cookies()
	require.Len(t, cookie, 1)
	assert.Equal(t, "session", cookie[0].Name)
	assert.True(t, cookie[0].MaxAge < 0) // cleared
}
```

If `auth_handler_test.go` has no router helper, add one mirroring `protectedTestRouter` in `auth_middleware_test.go`: build `gin.New()`, construct the real `AuthService` with a fake staff repo + a real `token.NewManager("test-secret", time.Hour)`, and register `NewAuthHandler(service, false).RegisterRoutes(public, protected)`. Add the `strings`, `require`, and `time` imports as needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && go test ./internal/adapter/http/ -run 'TestLogin|TestLogout' -v`
Expected: compile error or FAIL (logout route + cookie not implemented).

- [ ] **Step 3: Implement**

In `auth_handler.go`:

```go
const sessionCookieName = "session"
const sessionCookieMaxAge = 60 * 60 * 24 // 24h, matches the JWT TTL

// AuthHandler serves authentication endpoints.
type AuthHandler struct {
	service      *usecase.AuthService
	cookieSecure bool
}

// NewAuthHandler builds the auth handler.
func NewAuthHandler(service *usecase.AuthService, cookieSecure bool) *AuthHandler {
	return &AuthHandler{service: service, cookieSecure: cookieSecure}
}

// RegisterRoutes mounts login/logout as public and the session probe as protected.
func (h *AuthHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.POST("/authentication/login", h.Login)
	public.POST("/authentication/logout", h.Logout)
	protected.GET("/authentication/session", h.Session)
}

func (h *AuthHandler) setSessionCookie(c *gin.Context, token string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(sessionCookieName, token, maxAge, "/", "", h.cookieSecure, true)
}
```

In `Login`, after a successful `h.service.Login(...)` and before the JSON response, add:

```go
	h.setSessionCookie(c, tok, sessionCookieMaxAge)
```

(keep `c.JSON(http.StatusOK, gin.H{"token": tok})` for transition compatibility.)

Add the two handlers:

```go
// Logout clears the session cookie. POST /api/v1/authentication/logout.
func (h *AuthHandler) Logout(c *gin.Context) {
	h.setSessionCookie(c, "", -1)
	c.Status(http.StatusNoContent)
}

// Session returns the current staff id. GET /api/v1/authentication/session (protected).
func (h *AuthHandler) Session(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"staffId": c.GetInt64("staffId")})
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && go test ./internal/adapter/http/ -run 'TestLogin|TestLogout' -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/adapter/http/auth_handler.go backend/internal/adapter/http/auth_handler_test.go
git commit -m "feat(auth): set session cookie on login, add logout and session endpoints"
```

---

### Task 4: Wire into main.go + env, and full verification

**Files:**
- Modify: `backend/cmd/api/main.go`
- Modify: `deploy/templates/env.j2`, `deploy/templates/compose.prod.yaml.j2` (backend env), `compose.override.yaml` (dev)

**Interfaces:**
- Consumes: `Config.CookieSecure` (Task 2), `NewAuthHandler(service, cookieSecure)` (Task 3).

- [ ] **Step 1: Pass the flag in `main.go`**

Change the handler construction (currently `cmd/api/main.go:117`):

```go
	authHandler := httpapi.NewAuthHandler(usecase.NewAuthService(repository.NewStaff(queries), tokenManager), cfg.CookieSecure)
```

- [ ] **Step 2: Dev cookie over http — set `COOKIE_SECURE=false` for local dev**

In `compose.override.yaml`, under the `backend` service, add an environment override so the cookie works over http locally:

```yaml
  backend:
    environment:
      COOKIE_SECURE: "false"
```

(Merge into the existing `backend:` block; do not duplicate the key.)

- [ ] **Step 3: Prod stays secure — set `COOKIE_SECURE=true`**

In `deploy/templates/compose.prod.yaml.j2`, add to the backend `environment:` map:

```yaml
      COOKIE_SECURE: "true"
```

- [ ] **Step 4: Full build + test**

Run:
```bash
cd backend && go vet ./... && go test ./...
```
Expected: all pass.

- [ ] **Step 5: Manual end-to-end check (real login → cookie → session probe)**

Run from the repo root (starts the stack, seeds if empty, exercises the cookie):
```bash
docker compose up -d --build backend postgres
# wait for healthy, then:
curl -si -c /tmp/cj.txt -X POST localhost:8080/api/v1/authentication/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${STAFF_ADMIN_USERNAME:-admin}\",\"password\":\"${STAFF_ADMIN_PASSWORD:-admin}\"}" | grep -i set-cookie
curl -s -b /tmp/cj.txt localhost:8080/api/v1/authentication/session
docker compose down
```
Expected: a `Set-Cookie: session=…; HttpOnly` header, then `{"staffId":<n>}` from the cookie alone (no Authorization header).

- [ ] **Step 6: Commit**

```bash
git add backend/cmd/api/main.go compose.override.yaml deploy/templates/compose.prod.yaml.j2
git commit -m "feat(auth): wire COOKIE_SECURE; dev insecure, prod secure"
```

- [ ] **Step 7: Update CONTEXT.md**

Add a bullet under the auth/backend notes: cookie auth is now supported (`session` httpOnly cookie), with `POST /authentication/logout` and `GET /authentication/session`; Bearer still works. Commit:

```bash
git add CONTEXT.md
git commit -m "docs: note cookie auth endpoints in CONTEXT.md"
```

---

## Self-Review

**Spec coverage (of Plan 1's slice):**
- Go reads JWT from the `session` cookie → Task 1. ✓
- Login sets httpOnly cookie → Task 3. ✓
- Logout clears cookie → Task 3. ✓
- `GET /authentication/session` probe → Task 3. ✓
- Bearer still works (transition) → Task 1 keeps the header path; login still returns `{"token"}`. ✓
- Secure flag (prod true / dev false) → Tasks 2 + 4. ✓

**Placeholder scan:** Task 3 Step 1 depends on the existing `auth_handler_test.go` helper, which the implementer must read — the fallback (build a router helper) is spelled out so there is no blocked step.

**Type/name consistency:** `NewAuthHandler(service, cookieSecure)` used identically in Task 3 (definition), Task 3 test helper, and Task 4 `main.go`. Cookie name `session` matches the middleware (Task 1), the handler (Task 3), and the SPA guard in the design doc. Routes use full English words per the Global Constraints.

**Out of scope (later plans):** the Vite SPA, deleting BFF routes, nginx `/api` proxy, dropping the Node image. Those are Plans 2–3.

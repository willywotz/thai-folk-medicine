# Drop-Node Plan 3d — Cutover + Deploy + Release

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for
> tracking. This is an **outward-facing, hard-to-reverse** phase: it deletes the production
> frontend and cuts over the deploy. The orchestrator (Main) owns every git/deploy action and
> **must get explicit sign-off before tagging/releasing**. TDD applies where there is code;
> config changes are verified by `docker compose config` + build + the CI static checks.

**Goal:** Remove Node.js from production. Repoint every compose + CI + deploy artifact from
`frontend/` (Next.js) to `web/` (Vite SPA served by nginx), delete the `frontend/` directory
and the now-dead `INTERNAL_API_URL` wiring, update the operator docs, and release a `v*` tag.
After 3d, production runs **Postgres + Go + nginx** — no Node process.

**Architecture:** `web/Dockerfile` already builds an `nginx:alpine` image that serves `dist/`
and proxies `/api/` to `backend:8080` (hardcoded in `web/nginx.conf`). It exposes `:3000`, the
same port `frontend/` did. So at the compose level `web/` is a **drop-in replacement** for
`frontend/` — same service name, same port, same `target: production`. The only things that
change: the build `context`, the dead `INTERNAL_API_URL` env, the CI lint/test job, and the dev
override.

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`
**Series overview:** `docs/superpowers/plans/2026-08-17-drop-node-3-page-port-series.md`

## State entering 3d

- Plans 1, 2, 3a, 3b, 3c are merged to `main`. `web/` has all 34 routes (10 public + login +
  23 staff) wired, `tsc` clean, 75 tests pass, `vite build` green.
- `frontend/` (Next.js) is still the production app: `compose.yaml` `frontend` service builds
  `./frontend`, and `release.yml` builds/pushes `ghcr.io/willywotz/thai-folk-medicine-frontend`.
- `web/` ships nothing to prod yet. No `web/` image is built in CI or referenced by the deploy.
- **Risk (from the 3c plan):** this is the first phase where the SPA exercises the staff write
  path end-to-end (browser → `/api/v1` with the session cookie). A **manual smoke**
  (login → create a herb → see it → delete it) is a gate before tagging.

## Global constraints

- **Outward-facing actions need sign-off.** Deleting `frontend/`, pushing a tag, and anything
  that touches the live server are gated on the user. Do not run `git tag`/`git push origin v*`
  or `ansible-playbook` against prod without it.
- **`web/` is a drop-in for `frontend/` at compose level** — keep the service name `frontend`
  (so the prod compose, nginx proxy, and `FRONTEND_PORT` keep working) and just change the
  build `context`. This minimizes deploy churn. (Renaming the service is YAGNI and risks the
  nginx `proxy_pass` + port mapping.)
- **Keep the GHCR image name `thai-folk-medicine-frontend`** — renaming it would orphan the
  `:latest`/history and force a server-side image prune. Lazy: same name, new build context.
- **`INTERNAL_API_URL` is dead for `web/`.** `web/nginx.conf` hardcodes `backend:8080`. Drop
  the env var from every compose service that referenced it (root, override, prod template).
- **CI must stay green** — the `deploy-artifacts` job renders the prod compose and runs
  `docker compose config`; the frontend job must move to `web/` (`typecheck` + `test` + `build`,
  not `lint` — `web/` has no lint script).
- **Don't edit historical plan/spec docs** (they're point-in-time records). Update only the
  **operational** docs: `HANDOFF.md`, `CONTEXT.md`, `deploy/README.md`.

## Files 3d touches

| File | Change |
|---|---|
| `compose.yaml` | `frontend` service `context: ./frontend` → `./web`; drop `INTERNAL_API_URL` env |
| `compose.override.yaml` | Rework the dev `frontend` override for `web/` (or drop it — see Task 2) |
| `deploy/templates/compose.prod.yaml.j2` | Drop `INTERNAL_API_URL` from the `frontend` service (image-based; context doesn't change — it's an image pull) |
| `.github/workflows/ci.yml` | `frontend` job: `working-directory: web/`, `pnpm typecheck`+`pnpm test`+`pnpm build`, `cache-dependency-path: web/pnpm-lock.yaml` |
| `.github/workflows/release.yml` | matrix `context: ./frontend` → `./web` |
| `frontend/` | **Delete** the entire directory |
| `HANDOFF.md` | Update: `frontend/` gone; `web/` is prod; how to run; the Node-removal outcome |
| `CONTEXT.md` | Update the `web/` section: 3d done, `web/` is prod, `frontend/` deleted |
| `deploy/README.md` | Update any `frontend/`-specific runbook steps if present |

---

### Task 1: Repoint the root compose (`compose.yaml`) to `web/`

**Files:** `compose.yaml`.

- [ ] **Step 1** — Edit the `frontend` service: `context: ./frontend` → `./web`. Drop the
  `environment: { INTERNAL_API_URL: http://backend:8080 }` block (web/nginx hardcodes the
  backend target; the env is unused). Keep `target: production`, `depends_on: [backend]`, and
  the `ports: ["${FRONTEND_PORT:-3000}:3000"]` mapping unchanged.

  Resulting `frontend` service:
  ```yaml
  frontend:
    build:
      context: ./web
      target: production
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
  ```

- [ ] **Step 2 — Verify:** `docker compose -f compose.yaml config` (from repo root) must
  succeed. Then a real build+run smoke: `docker compose -f compose.yaml up -d --build backend
  postgres frontend`, wait for health, `curl -sI http://localhost:3000` → 200 (the SPA shell),
  and `curl -s http://localhost:3000/api/v1/provinces` → JSON (the nginx `/api` proxy works).
  `docker compose down`.

- [ ] **Step 3 — Commit** `feat(infra): point root compose frontend service at web/ (drop-node 3d)`

---

### Task 2: Rework the dev override (`compose.override.yaml`) for `web/`

**Files:** `compose.override.yaml`. Source: the current override targets `frontend/` with
`target: development` + a `develop.watch` (Next fast-refresh `sync` to `/app`).

`web/Dockerfile` has **no `development` target** (only `base`/`build`/`production`), and the
HANDOFF's dev story for `web/` is **`pnpm dev` on the host** (Vite dev server proxies `/api`),
not a container. So the `frontend` dev override as written cannot work for `web/`.

- [ ] **Step 1 — Decide (lazy):** drop the `frontend` override entirely. The `backend` dev
  override (`target: development` + `go run` watch) stays — it's unaffected. `web/` dev is
  `cd web && pnpm dev` on the host (already documented). Rationale: a Vite dev container adds
  complexity for no gain over the host dev server; YAGNI. If the user later wants
  containerized `web/` dev, add a `development` target to `web/Dockerfile` then.

  Edit `compose.override.yaml` to contain ONLY the `backend` service override (delete the
  `frontend:` block). Result:
  ```yaml
  services:
    backend:
      build: { target: development }
      environment:
        COOKIE_SECURE: "false"
      develop:
        watch:
          - action: sync+restart
            path: ./backend
            target: /src
            ignore:
              - .git/
          - action: rebuild
            path: ./backend/go.mod
  ```

- [ ] **Step 2 — Verify:** `docker compose config` (auto-merges override) must succeed, and
  `docker compose -f compose.yaml config` (prod layer, no override) must still succeed. Note in
  the report that `docker compose up` now runs the `web/` **production** image (no dev target)
  — host dev is `pnpm dev`.

- [ ] **Step 3 — Commit** `chore(infra): drop frontend dev override (web/ dev runs on host) (drop-node 3d)`

---

### Task 3: Drop dead `INTERNAL_API_URL` from the prod compose template

**Files:** `deploy/templates/compose.prod.yaml.j2`.

- [ ] **Step 1** — In the `frontend` service of the template, delete the
  `environment: { INTERNAL_API_URL: http://backend:8080 }` block. The service is image-based
  (`image: {{ registry }}/{{ image_frontend }}:{{ app_version }}`) — its build context is the
  CI workflow, not this template, so **no context change here**. Keep `image`, `restart`,
  `depends_on`, `ports`. The `{{ image_frontend }}` var stays `thai-folk-medicine-frontend`
  (same GHCR name, new build context in CI — Task 5).

- [ ] **Step 2 — Verify the CI render path:** `cd deploy && ansible-playbook render-check.yml
  -e @example.vars.yml` must re-render `.render/compose.prod.yaml`, then
  `docker compose -f deploy/.render/compose.prod.yaml config` must succeed. Confirm the rendered
  `frontend` service has no `INTERNAL_API_URL`. (This is the exact gate the CI
  `deploy-artifacts` job runs.)

- [ ] **Step 3 — Commit** `feat(deploy): drop dead INTERNAL_API_URL from prod frontend service (drop-node 3d)`

---

### Task 4: Move CI's frontend job to `web/`

**Files:** `.github/workflows/ci.yml`. The `frontend` job currently `pnpm lint`+`pnpm test` in
`frontend/`. `web/` has `typecheck` + `test` + `build` (no `lint`).

- [ ] **Step 1** — Edit the `frontend` job:
  - `cache-dependency-path: frontend/pnpm-lock.yaml` → `web/pnpm-lock.yaml`.
  - `working-directory: frontend` → `web/` on every step.
  - Replace the `Lint` step (`pnpm lint`) with `Typecheck` (`pnpm typecheck` — `tsc --noEmit`,
    the real completeness gate for the SPA).
  - Keep `Test` (`pnpm test`).
  - Add `Build` (`pnpm build`) — proves `vite build` succeeds, the image's build step.
  - Keep `pnpm/action-setup` version `11.8.0` and node 24.

  ```yaml
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with:
          version: "11.8.0"
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - name: Install
        working-directory: web
        run: pnpm install --frozen-lockfile
      - name: Typecheck
        working-directory: web
        run: pnpm typecheck
      - name: Test
        working-directory: web
        run: pnpm test
      - name: Build
        working-directory: web
        run: pnpm build
  ```
  Keep the `backend` and `deploy-artifacts` jobs unchanged.

- [ ] **Step 2 — Verify locally:** `cd web && pnpm install --frozen-lockfile && pnpm typecheck
  && pnpm test && pnpm build` — all must pass (they do as of 3c merge; re-confirm).

- [ ] **Step 3 — Commit** `ci: move frontend job to web/ (typecheck+test+build) (drop-node 3d)`

---

### Task 5: Repoint the release workflow's build context to `web/`

**Files:** `.github/workflows/release.yml`. The `build-push` matrix has
`{ component: frontend, context: ./frontend }`.

- [ ] **Step 1** — Change the matrix `context` for the frontend component: `./frontend` →
  `./web`. Keep `component: frontend` and the image name
  `ghcr.io/willywotz/thai-folk-medicine-frontend` (via `docker/metadata-action` on
  `thai-folk-medicine-${{ matrix.component }}`) — same GHCR repo, new build context. The
  `target: production` stays (web/Dockerfile has a `production` stage → nginx). The `deploy`
  job is unchanged.

- [ ] **Step 2 — Verify:** `docker build -t tfm-web-check -f web/Dockerfile --target production
  web/` must succeed and produce an nginx image. (Don't push.) Confirm
  `docker run --rm tfm-web-check` serves `:3000` (optional — the Task 1 smoke already covers
  the runtime path).

- [ ] **Step 3 — Commit** `ci(release): build frontend image from web/ (drop-node 3d)`

---

### Task 6: Delete `frontend/`

**Files:** the entire `frontend/` directory.

- [ ] **Step 1 — Pre-deletion grep:** confirm nothing live references `frontend/` as a build
  context or working directory after Tasks 1–5:
  `grep -rnE "context: ./frontend|working-directory: frontend|frontend/pnpm-lock" .github compose.yaml deploy` → must be empty.
  (Docs/HANDOFF may still mention `frontend/` narratively — those are updated in Task 7, not
  blockers for deletion.)
- [ ] **Step 2 — Delete:** `git rm -r frontend`. This is large (the Next app) but
  irreversible-ish — it's a local delete, recoverable from git history, but it removes the
  prod app. **Confirm with the user before this step if they haven't pre-authorized.** (The
  Task 1–5 smoke already proved `web/` serves the site; `frontend/` is now dead code.)
- [ ] **Step 3 — Verify:** `cd web && pnpm typecheck && pnpm test && pnpm build` still green
  (nothing in `web/` imported from `frontend/`). `docker compose -f compose.yaml config`
  succeeds. `grep -rl "next/" web/src` empty (already true).
- [ ] **Step 4 — Commit** `chore: delete frontend/ (Next.js app) — drop-node cutover complete`

---

### Task 7: Update operational docs (HANDOFF, CONTEXT, deploy/README)

**Files:** `HANDOFF.md`, `CONTEXT.md`, `deploy/README.md`.

- [ ] **Step 1 — `HANDOFF.md`:** update the **Status** + **Run it** + **Drop-Node migration**
  sections:
  - Status: the drop-node migration is **complete**; production runs no Node (Postgres + Go +
    nginx). `web/` is the production frontend; `frontend/` is deleted.
  - Run it: the root compose `frontend` service now builds `web/`; dev is `cd web && pnpm dev`
    (host), not `docker compose watch` for the frontend. `INTERNAL_API_URL` is gone.
  - Drop-Node section: mark 3d done; note the image name stayed
    `thai-folk-medicine-frontend` (new context), and the dev override was dropped (web/ dev on
    host). Remove the "frontend/ still serves prod until 3d" caveat.
  - Testing section: `cd web && pnpm test` (not `frontend`).
- [ ] **Step 2 — `CONTEXT.md`:** update the `web/` section — 3d done; `web/` is prod;
  `frontend/` deleted; the `Vite SPA foundation` heading can note "is the production frontend".
- [ ] **Step 3 — `deploy/README.md`:** if it references `frontend/` build context or
  `INTERNAL_API_URL`, update to `web/` / drop the env. (Read it first; only change what's
  stale.)
- [ ] **Step 4 — Commit** `docs: update operator docs for web/ cutover (drop-node 3d)`

---

### Task 8: Full local green gate + manual smoke

**The gate before any tag.**

- [ ] **Step 1 — Full stack build+run smoke (the write-path risk):**
  ```bash
  docker compose -f compose.yaml up -d --build
  # wait for health
  docker compose --profile seed run --rm seed   # if DB empty, else skip
  ```
  Then **manually** in a browser at `http://localhost:3000`:
  1. Public site loads (home, a herb detail, a remedy detail, search).
  2. Click "For staff" → redirected to `/login` (no session).
  3. Log in (`admin` / the `STAFF_ADMIN_PASSWORD` — `change-me` unless overridden in `.env`).
  4. Dashboard loads (stats + activity).
  5. **Create a herb** (Herbs → New → fill → save) → it appears in the list.
  6. **Edit** that herb → change saves.
  7. **Delete** it → it's gone (exercise the 409 path too: try deleting a province that has
     districts → expect the error message).
  8. **Log out** → redirected to `/login`.
  This is the first end-to-end exercise of the SPA write path (browser → `/api/v1` with the
  session cookie, Plan 1's cookie auth). **If any step fails, stop and fix before tagging.**
  `docker compose down` (add `-v` to drop data if desired).

- [ ] **Step 2 — Toolchain gate:**
  ```bash
  cd web && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build
  cd ../backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./...
  docker compose -f compose.yaml config
  cd ../deploy && ansible-playbook -i inventory.ini playbook.yml --syntax-check
  ansible-playbook render-check.yml -e @example.vars.yml
  docker compose -f .render/compose.prod.yaml config
  ```
  All clean. `grep -rnE "context: ./frontend|INTERNAL_API_URL" .github compose.yaml deploy` empty.

- [ ] **Step 3 — Commit** (if any fixups were needed) and **stop here for sign-off.**

---

### Task 9: Release a `v*` tag (GATED — needs explicit user sign-off)

**This is the outward-facing step. Do not run without the user saying to.**

- [ ] **Step 1 — Confirm the user wants to release.** The whole branch must be merged to
  `main` first (the release workflow checks out the **tagged commit**, not a branch — so tag
  `main` after merge).
- [ ] **Step 2 — Merge** `feat/drop-node-3d-cutover` → `main` (`--no-ff`), if not already.
- [ ] **Step 3 — Tag:** `git tag -a v0.2.0 -m "Drop Node from production: Vite SPA cutover"`
  (bump from the current `v0.1.2`; a minor bump is appropriate — Node removal is a significant
  infra change but no user-facing feature change). Push the tag: `git push origin v0.2.0`
  (**only if a remote exists and the user authorized push** — there is currently no remote
  configured; if none, this step is "add a remote and push" which is itself gated).
- [ ] **Step 4 — Watch the release:** `gh run watch <run-id> --exit-status` or the Actions
  tab. `release.yml` builds `backend` + `frontend`(=`web/` context) images, pushes to GHCR,
  then runs `deploy/playbook.yml` over SSH to `152.42.209.242`. Confirm the deploy job
  succeeds and `tfm.willywotz.com` serves the SPA.
- [ ] **Step 5 — Post-release prod smoke:** visit `tfm.willywotz.com`, log in, create+delete a
  record. Confirm no Node process runs on the server (`ssh root@… 'docker compose -f
  /opt/thai-folk-medicine/compose.prod.yaml ps'` — only `postgres`, `backend`, `frontend`
  (nginx) should be up; `frontend` is nginx, not node).

---

## Self-Review

**Node-removal coverage:** root compose (Task 1), dev override (Task 2), prod template
(Task 3), CI build/test (Task 4), release image build (Task 5), source deletion (Task 6),
docs (Task 7). After 3d, `grep -rn "next/" .` (excluding `node_modules`/git) returns only
historical plan/spec markdown. ✓

**Why it's low-risk despite being a cutover:** `web/` is a port-for-port drop-in at the
compose level — same service name `frontend`, same `:3000`, same `target: production`, same
GHCR image name. The nginx `/api` proxy replaces the Next `/api` rewrite; the Go cookie auth
(Plan 1) was already live and transition-safe. The only behavioral change is CSR vs SSR
(already accepted in the spec) and the dev workflow (host `pnpm dev`).

**Smoke gate (Task 8) is non-negotiable** — it's the first end-to-end write-path exercise.
The 3c tests mock the API; only a real stack proves login→create→delete works against Go's
cookie auth. If it fails, 3d is not done.

**Lazy decisions (called out):**
- Keep the `frontend` service name + GHCR image name — avoids nginx/playbook/port churn.
- Drop the dev override for `frontend` rather than add a `web/` `development` Docker target —
  host `pnpm dev` is the documented dev story; a Vite dev container is YAGNI.
- Don't edit historical plan/spec docs — they're records, not live instructions.

**Gated actions:** `git rm -r frontend` (Task 6 — confirm if not pre-authorized), `git tag` +
`git push origin v*` + the Ansible deploy (Task 9 — explicit sign-off). The orchestrator does
these, not a builder.

**Rollback:** if the prod deploy fails, the previous release `v0.1.2` is still on GHCR; revert
the tag or re-run `ansible-playbook` with `-e app_version=v0.1.2`. `frontend/` is recoverable
from git history (`git checkout <pre-3d> -- frontend/`) if the cutover must be backed out
entirely — but the smoke gate exists to avoid that.

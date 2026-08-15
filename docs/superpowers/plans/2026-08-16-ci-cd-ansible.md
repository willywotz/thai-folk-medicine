# CI/CD with GitHub Actions + Ansible Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Actions builds backend and frontend images, pushes them to GHCR on a `v*` tag, and Ansible deploys the stack over SSH with Docker Compose.

**Architecture:** Two workflows. `ci.yml` runs Go and frontend tests plus a static check of the deploy files on every push and pull request. `release.yml` builds and pushes images on a tag, then runs an Ansible playbook that renders a production compose file plus a `.env` from an encrypted vault, pulls the images, and starts the stack. The backend applies its embedded migrations on start, so deploy has no separate migration step.

**Tech Stack:** GitHub Actions, Docker Buildx, GitHub Container Registry (GHCR), Ansible (core 2.16), Docker Compose, Go 1.26.5, pnpm 11.8.0 / Node 24.

**Spec:** `docs/superpowers/specs/2026-08-16-ci-cd-ansible-design.md`

## Global Constraints

- Registry: `ghcr.io/willywotz`. Image names: `thai-folk-medicine-backend`, `thai-folk-medicine-frontend` (GHCR requires lowercase; these already are).
- Go version: `1.26.5`. pnpm: `11.8.0`. Node: `24`.
- Secrets come from the environment only. No secret value is committed in clear text. The vault file is committed but encrypted.
- The deploy static check must NOT need the vault password (it runs on pull requests). Verified: `ansible-playbook --syntax-check` loads a vaulted `group_vars` file without decrypting it.
- API route naming and app config are out of scope; this plan only adds CI/CD and deploy files. No application code changes.
- One `prod` environment. No staging. No reverse proxy added (the server already terminates TLS and routes to `:3000`).

---

## File structure

Created by this plan:

```
.github/workflows/ci.yml               # test + deploy-file static check
.github/workflows/release.yml          # build+push to GHCR, then Ansible deploy
deploy/ansible.cfg
deploy/inventory.ini                   # names the `prod` group
deploy/playbook.yml                    # the deploy play
deploy/render-check.yml                # localhost play: renders templates for CI validation
deploy/example.vars.yml                # placeholder vars for the static render check (committed)
deploy/vault.example.yml               # plaintext key reference for operators (committed)
deploy/group_vars/prod/vars.yml        # non-secret prod vars
deploy/group_vars/prod/vault.yml       # ENCRYPTED secrets (created by the operator, not this plan)
deploy/templates/compose.prod.yaml.j2  # prod stack, GHCR images
deploy/templates/env.j2                # renders .env from vault vars
deploy/README.md                       # operator runbook
```

Modified:

```
.gitignore                             # ignore deploy/.render/
CONTEXT.md                             # record the new CI/CD subsystem
```

Note on the encrypted vault: this plan's automated steps CANNOT create `deploy/group_vars/prod/vault.yml`, because it needs the operator's real secret values and vault password. The plan commits `vault.example.yml` (plaintext reference) and the `README.md` gives the exact `ansible-vault` command. The operator creates and commits the real encrypted `vault.yml`.

---

### Task 1: Ansible deploy files + local validation

**Files:**
- Create: `deploy/ansible.cfg`
- Create: `deploy/inventory.ini`
- Create: `deploy/group_vars/prod/vars.yml`
- Create: `deploy/example.vars.yml`
- Create: `deploy/vault.example.yml`
- Create: `deploy/templates/compose.prod.yaml.j2`
- Create: `deploy/templates/env.j2`
- Create: `deploy/playbook.yml`
- Create: `deploy/render-check.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces (Jinja vars consumed by templates and playbook; snake_case):
  - Non-secret (`group_vars/prod/vars.yml`): `app_dir` (`/opt/thai-folk-medicine`), `registry` (`ghcr.io/willywotz`), `image_backend` (`thai-folk-medicine-backend`), `image_frontend` (`thai-folk-medicine-frontend`).
  - Secret (vault, and mirrored in `example.vars.yml` / `vault.example.yml`): `ansible_host`, `ansible_user`, `jwt_secret`, `postgres_password`, `staff_admin_username`, `staff_admin_password`, `staff_admin_email`.
  - Extra vars passed at deploy time by `release.yml`: `app_version`, `ghcr_username`, `ghcr_token`.
- Later tasks rely on: `deploy/inventory.ini`, `deploy/playbook.yml`, `deploy/render-check.yml`, `deploy/example.vars.yml` existing at these exact paths (used by both workflows).

- [ ] **Step 1: Add the render output dir to .gitignore**

Append to `.gitignore`:

```
/deploy/.render/
```

- [ ] **Step 2: Write `deploy/ansible.cfg`**

```ini
[defaults]
inventory = inventory.ini
host_key_checking = True
retry_files_enabled = False

[ssh_connection]
pipelining = True
```

- [ ] **Step 3: Write `deploy/inventory.ini`**

The host address is not here; `ansible_host` / `ansible_user` come from the
vault as group vars for the `prod` group. Do NOT restate them as inventory
host vars — a host var `ansible_host="{{ ansible_host }}"` self-references and
fails with a template recursion error at connect time.

```ini
[prod]
production
```

- [ ] **Step 4: Write `deploy/group_vars/prod/vars.yml`**

```yaml
app_dir: /opt/thai-folk-medicine
registry: ghcr.io/willywotz
image_backend: thai-folk-medicine-backend
image_frontend: thai-folk-medicine-frontend
```

- [ ] **Step 5: Write `deploy/example.vars.yml`** (placeholders for the CI render check — never real secrets)

```yaml
app_dir: /opt/thai-folk-medicine
registry: ghcr.io/willywotz
image_backend: thai-folk-medicine-backend
image_frontend: thai-folk-medicine-frontend
app_version: v0.0.0-ci
ansible_host: 127.0.0.1
ansible_user: deploy
jwt_secret: ci-placeholder-secret
postgres_password: ci-placeholder-password
staff_admin_username: admin
staff_admin_password: ci-placeholder-admin
staff_admin_email: admin@example.com
```

- [ ] **Step 6: Write `deploy/vault.example.yml`** (operator reference — plaintext, safe placeholders)

```yaml
# Copy this file to group_vars/prod/vault.yml, fill in real values, then encrypt:
#   ansible-vault encrypt deploy/group_vars/prod/vault.yml
ansible_host: 203.0.113.10
ansible_user: deploy
jwt_secret: CHANGE_ME_64_HEX
postgres_password: CHANGE_ME
staff_admin_username: admin
staff_admin_password: CHANGE_ME
staff_admin_email: admin@example.com
```

- [ ] **Step 7: Write `deploy/templates/env.j2`**

```jinja
JWT_SECRET={{ jwt_secret }}
POSTGRES_PASSWORD={{ postgres_password }}
STAFF_ADMIN_USERNAME={{ staff_admin_username }}
STAFF_ADMIN_PASSWORD={{ staff_admin_password }}
STAFF_ADMIN_EMAIL={{ staff_admin_email }}
```

- [ ] **Step 8: Write `deploy/templates/compose.prod.yaml.j2`**

Mirrors `compose.yaml` topology but pulls images from GHCR and reads secrets from `.env` (Docker Compose auto-loads `.env` from the project directory for `${...}` interpolation).

```jinja
services:
  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: folk
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: folk_medicine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U folk -d folk_medicine"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    image: {{ registry }}/{{ image_backend }}:{{ app_version }}
    restart: unless-stopped
    environment:
      HTTP_PORT: "8080"
      DATABASE_URL: postgres://folk:${POSTGRES_PASSWORD}@postgres:5432/folk_medicine?sslmode=disable
      JWT_SECRET: ${JWT_SECRET}
      PHOTO_STORAGE_DIR: /data/photo
      STAFF_ADMIN_USERNAME: ${STAFF_ADMIN_USERNAME}
      STAFF_ADMIN_PASSWORD: ${STAFF_ADMIN_PASSWORD}
      STAFF_ADMIN_EMAIL: ${STAFF_ADMIN_EMAIL}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - photo_data:/data/photo

  frontend:
    image: {{ registry }}/{{ image_frontend }}:{{ app_version }}
    restart: unless-stopped
    environment:
      INTERNAL_API_URL: http://backend:8080
    depends_on:
      - backend
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  photo_data:
```

- [ ] **Step 9: Write `deploy/render-check.yml`** (localhost play; renders both templates so CI can validate them without the vault)

```yaml
- name: Render deploy templates for validation
  hosts: localhost
  gather_facts: false
  vars:
    render_dir: "{{ playbook_dir }}/.render"
  tasks:
    - name: Ensure render dir exists
      ansible.builtin.file:
        path: "{{ render_dir }}"
        state: directory

    - name: Render compose
      ansible.builtin.template:
        src: templates/compose.prod.yaml.j2
        dest: "{{ render_dir }}/compose.prod.yaml"

    - name: Render env
      ansible.builtin.template:
        src: templates/env.j2
        dest: "{{ render_dir }}/.env"
```

- [ ] **Step 10: Write `deploy/playbook.yml`**

```yaml
- name: Deploy thai-folk-medicine
  hosts: prod
  gather_facts: false
  vars:
    compose_file: "{{ app_dir }}/compose.prod.yaml"
  tasks:
    - name: Ensure app directory exists
      ansible.builtin.file:
        path: "{{ app_dir }}"
        state: directory
        mode: "0755"

    - name: Render production compose file
      ansible.builtin.template:
        src: templates/compose.prod.yaml.j2
        dest: "{{ compose_file }}"
        mode: "0644"

    - name: Render environment file
      ansible.builtin.template:
        src: templates/env.j2
        dest: "{{ app_dir }}/.env"
        mode: "0600"

    - name: Log in to GHCR
      ansible.builtin.command:
        cmd: docker login ghcr.io -u "{{ ghcr_username }}" --password-stdin
        stdin: "{{ ghcr_token }}"
      no_log: true

    - name: Pull images
      ansible.builtin.command:
        cmd: docker compose -f "{{ compose_file }}" pull
        chdir: "{{ app_dir }}"

    - name: Start the stack
      ansible.builtin.command:
        cmd: docker compose -f "{{ compose_file }}" up -d
        chdir: "{{ app_dir }}"

    - name: Prune dangling images
      ansible.builtin.command:
        cmd: docker image prune -f
```

- [ ] **Step 11: Run the syntax check — expect PASS (no vault password)**

Run:
```bash
cd deploy && ansible-playbook -i inventory.ini playbook.yml --syntax-check
```
Expected: prints `playbook: playbook.yml`, exit 0.

- [ ] **Step 12: Render templates and validate the compose — expect PASS**

Run:
```bash
cd deploy && ansible-playbook render-check.yml -e @example.vars.yml \
  && docker compose -f .render/compose.prod.yaml config >/dev/null && echo VALID
```
Expected: prints `VALID`, exit 0. (`docker compose config` reads `.render/.env` for interpolation.)

- [ ] **Step 13: Commit**

```bash
git add .gitignore deploy/
git commit -m "feat(deploy): ansible playbook + prod compose template for GHCR deploy"
```

---

### Task 2: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `deploy/inventory.ini`, `deploy/playbook.yml`, `deploy/render-check.yml`, `deploy/example.vars.yml` (from Task 1).
- Produces: a `CI` workflow with jobs `backend`, `frontend`, `deploy-artifacts`. No later task depends on it.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.26.5"
          cache-dependency-path: backend/go.sum
      - name: Vet
        working-directory: backend
        run: go vet ./...
      - name: Test
        working-directory: backend
        run: go test ./...

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: "11.8.0"
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - name: Install
        working-directory: frontend
        run: pnpm install --frozen-lockfile
      - name: Lint
        working-directory: frontend
        run: pnpm lint
      - name: Test
        working-directory: frontend
        run: pnpm test

  deploy-artifacts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install ansible-core
        run: pipx install ansible-core
      - name: Syntax check
        working-directory: deploy
        run: ansible-playbook -i inventory.ini playbook.yml --syntax-check
      - name: Render templates with placeholder vars
        working-directory: deploy
        run: ansible-playbook render-check.yml -e @example.vars.yml
      - name: Validate rendered compose
        working-directory: deploy
        run: docker compose -f .render/compose.prod.yaml config
```

- [ ] **Step 2: Validate the workflow YAML — expect PASS**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
```
Expected: prints `YAML OK`.

- [ ] **Step 3: Dry-run the deploy-artifacts commands locally — expect PASS**

These are the exact commands the `deploy-artifacts` job runs; they must already pass from Task 1.
```bash
cd deploy && ansible-playbook -i inventory.ini playbook.yml --syntax-check \
  && ansible-playbook render-check.yml -e @example.vars.yml \
  && docker compose -f .render/compose.prod.yaml config >/dev/null && echo OK
```
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test + deploy-file validation workflow"
```

---

### Task 3: Release workflow (build, push, deploy)

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `deploy/inventory.ini`, `deploy/playbook.yml` (Task 1); `backend/Dockerfile`, `frontend/Dockerfile` (existing, `production` target).
- Produces: a `Release` workflow triggered on `v*` tags. Passes `app_version={{ github.ref_name }}`, `ghcr_username={{ github.actor }}`, `ghcr_token={{ secrets.GITHUB_TOKEN }}` to the playbook.
- Requires GitHub Actions secrets: `SSH_PRIVATE_KEY`, `KNOWN_HOSTS`, `ANSIBLE_VAULT_PASSWORD` (set by the operator — see Task 4 README).

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  build-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - component: backend
            context: ./backend
          - component: frontend
            context: ./frontend
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/willywotz/thai-folk-medicine-${{ matrix.component }}
          tags: |
            type=ref,event=tag
            type=raw,value=latest
      - uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install ansible-core
        run: pipx install ansible-core
      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_deploy
          chmod 600 ~/.ssh/id_deploy
          printf '%s\n' "${{ secrets.KNOWN_HOSTS }}" > ~/.ssh/known_hosts
      - name: Write vault password file
        run: printf '%s' "${{ secrets.ANSIBLE_VAULT_PASSWORD }}" > /tmp/vault_pass
      - name: Deploy
        working-directory: deploy
        env:
          ANSIBLE_PRIVATE_KEY_FILE: ~/.ssh/id_deploy
        run: |
          ansible-playbook -i inventory.ini playbook.yml \
            --vault-password-file /tmp/vault_pass \
            -e app_version=${{ github.ref_name }} \
            -e ghcr_username=${{ github.actor }} \
            -e ghcr_token=${{ secrets.GITHUB_TOKEN }}
      - name: Clean up secrets
        if: always()
        run: rm -f /tmp/vault_pass ~/.ssh/id_deploy
```

- [ ] **Step 2: Validate the workflow YAML — expect PASS**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('YAML OK')"
```
Expected: prints `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow to build+push GHCR images and deploy via ansible"
```

---

### Task 4: Operator runbook + CONTEXT.md

**Files:**
- Create: `deploy/README.md`
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: no code interface; documents the manual one-time setup (secrets, vault, remote, first deploy).

- [ ] **Step 1: Write `deploy/README.md`**

````markdown
# Deploy

Ansible deploys the production stack over SSH. GitHub Actions builds the
images and triggers the deploy on a `v*` tag.

## One-time setup

### 1. GitHub repository

The repo has no git remote yet. Create it and push:

```bash
gh repo create willywotz/thai-folk-medicine --private --source=. --push
```

### 2. GitHub Actions secrets

Set these in the repo (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | Private key whose public half is in the server's `authorized_keys`. |
| `KNOWN_HOSTS` | Output of `ssh-keyscan <server-host>`. |
| `ANSIBLE_VAULT_PASSWORD` | The password used to encrypt `group_vars/prod/vault.yml`. |

`GITHUB_TOKEN` is automatic; it pushes to GHCR and the server pulls with it.

### 3. Encrypted vault

Copy the example, fill in real values, then encrypt:

```bash
cp deploy/vault.example.yml deploy/group_vars/prod/vault.yml
# edit deploy/group_vars/prod/vault.yml
ansible-vault encrypt deploy/group_vars/prod/vault.yml
git add deploy/group_vars/prod/vault.yml
git commit -m "chore(deploy): add encrypted prod vault"
```

Vault keys: `ansible_host`, `ansible_user`, `jwt_secret`, `postgres_password`,
`staff_admin_username`, `staff_admin_password`, `staff_admin_email`.

Edit later with `ansible-vault edit deploy/group_vars/prod/vault.yml`.

## Deploy

Push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `Release` workflow builds and pushes both images to GHCR, then runs the
playbook. The backend applies its embedded migrations on start.

## Deploy from a workstation (bypass CI)

```bash
cd deploy
ansible-playbook -i inventory.ini playbook.yml \
  --ask-vault-pass \
  -e app_version=v0.1.0 \
  -e ghcr_username=<github-user> \
  -e ghcr_token=<ghcr-pat-with-read:packages>
```

## Notes

- First push makes the GHCR package private. If the server token cannot pull,
  set the package to internal/public or link it to this repo in the GHCR UI.
- No reverse proxy is included. The frontend listens on `:3000`; the server's
  existing proxy terminates TLS and forwards to it.
````

- [ ] **Step 2: Update `CONTEXT.md`**

Add a short section recording the new subsystem (place it where other subsystem notes live). Content:

```markdown
## CI/CD

- `.github/workflows/ci.yml`: Go + frontend tests, and a static check of the
  deploy files (ansible `--syntax-check`, render templates, `docker compose config`).
- `.github/workflows/release.yml`: on a `v*` tag, builds backend and frontend
  images, pushes to `ghcr.io/willywotz/thai-folk-medicine-{backend,frontend}`,
  then runs `deploy/playbook.yml` over SSH.
- `deploy/`: Ansible playbook + `compose.prod.yaml.j2` (GHCR images) + `.env`
  from an encrypted vault. See `deploy/README.md` for setup.
```

- [ ] **Step 3: Verify docs render as valid Markdown / no broken intent**

Run:
```bash
test -f deploy/README.md && grep -q "CI/CD" CONTEXT.md && echo OK
```
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add deploy/README.md CONTEXT.md
git commit -m "docs(deploy): operator runbook and CONTEXT.md CI/CD section"
```

---

## Self-Review

**Spec coverage:**
- CI quality gate (backend/frontend tests) → Task 2. ✓
- Deploy-file static check without vault → Task 1 Step 11-12, Task 2 job `deploy-artifacts`. ✓
- Build+push to GHCR on tag → Task 3 `build-push`. ✓
- Ansible deploy play (dir, template compose, template .env, login, pull, up, prune) → Task 1 Step 10. ✓
- Host/user + secrets in encrypted vault → Task 1 (structure) + Task 4 README (creation). ✓
- Prod compose template with GHCR images, secrets via `.env` → Task 1 Step 8. ✓
- Secrets list (SSH_PRIVATE_KEY, ANSIBLE_VAULT_PASSWORD, KNOWN_HOSTS; vault keys) → Task 3 Interfaces + Task 4 README. ✓
- Verification (go test, vitest, syntax-check, compose config) → Tasks 1-2. ✓
- Assumptions (no proxy, Postgres in compose, single env) → honored; README documents the proxy assumption. ✓

**Placeholder scan:** No `TBD`/`TODO`/"add error handling". The encrypted `vault.yml` is intentionally operator-created (documented), not a plan placeholder.

**Type/name consistency:** Jinja var names are snake_case and identical across `vars.yml`, `example.vars.yml`, `vault.example.yml`, `env.j2`, `compose.prod.yaml.j2`, and the playbook (`app_dir`, `registry`, `image_backend`, `image_frontend`, `app_version`, `ghcr_username`, `ghcr_token`, `jwt_secret`, `postgres_password`, `staff_admin_username/password/email`, `ansible_host`, `ansible_user`). Image names identical in `release.yml` metadata-action and `vars.yml`. Paths (`deploy/inventory.ini`, `deploy/playbook.yml`, `deploy/render-check.yml`, `deploy/example.vars.yml`, `.render/compose.prod.yaml`) identical across Tasks 1-3.

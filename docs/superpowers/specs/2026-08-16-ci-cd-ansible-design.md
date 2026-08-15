# CI/CD with GitHub Actions + Ansible SSH Deploy — Design

Date: 2026-08-16
Status: Approved (design), pending implementation plan

## Goal

Add continuous integration and continuous deployment for the
thai-folk-medicine stack (Go backend, Next.js frontend, Postgres). GitHub
Actions builds container images and pushes them to the GitHub Container
Registry (GHCR). Ansible connects to a production server over SSH and runs
the stack from those images with Docker Compose.

## Decisions

| Topic | Decision |
| --- | --- |
| Build strategy | CI builds images, pushes to GHCR. Server pulls tagged images. |
| CD trigger | Push of a Git tag `v*`. |
| Server state | Already provisioned (Docker + Compose installed, SSH access works). |
| Secrets | Ansible Vault (encrypted file in the repo). |

## Facts that shaped the design

- The backend applies its embedded migrations on start
  (`backend/cmd/api/main.go:36`). Deploy needs no separate migration step.
- The frontend reads `INTERNAL_API_URL` only at run time and uses a BFF
  proxy. No `NEXT_PUBLIC_*` value is baked at build time. One CI-built
  image is portable across environments.
- `compose.yaml` builds images for local development. Production must use a
  separate compose file that references GHCR images.

## Architecture

Two GitHub Actions workflows.

### 1. `ci.yml` — quality gate

Trigger: pull request, and push to `main`.

- Job `backend`: `go vet ./...` and `go test ./...` (Go 1.26). Tests use
  Postgres testcontainers, which already run in the repo.
- Job `frontend`: `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm test` (vitest).
- Job `deploy-artifacts` (fast static check): `ansible-playbook
  --syntax-check` and a `docker compose config` on the prod compose template
  rendered with placeholder values. This needs no vault access, so it runs
  on pull requests too.

No deployment runs in this workflow.

### 2. `release.yml` — build and deploy

Trigger: push of a tag that matches `v*`.

- Job `build-push` (matrix: `backend`, `frontend`):
  - `docker buildx build --target production`.
  - Tags: `ghcr.io/willywotz/thai-folk-medicine-<component>:<tag>` and
    `:latest`.
  - Push to GHCR with the built-in `GITHUB_TOKEN` (`packages: write`).
  - Use GitHub Actions cache for build layers.
- Job `deploy` (`needs: build-push`):
  - Install Ansible.
  - Load the SSH private key and known-hosts from Actions secrets.
  - Run `ansible-playbook` with `--vault-password-file`.
  - Pass the tag as the extra variable `app_version`.

## Ansible layout

New directory `deploy/`:

```
deploy/
  ansible.cfg
  inventory.ini              # names the `prod` group only
  playbook.yml               # the deploy play
  group_vars/prod/
    vars.yml                 # non-secret: app_dir, registry, image names
    vault.yml                # ENCRYPTED: ansible_host, ansible_user, secrets
  templates/
    compose.prod.yaml.j2     # prod stack: image: ghcr.io/...:{{ app_version }}
    env.j2                   # renders .env from vault vars
```

The host and user live encrypted in `vault.yml`. Ansible decrypts the vault
before it connects, so no server address sits in clear text in the repo.

### Play steps (`playbook.yml`, group `prod`)

1. Ensure the app directory `/opt/thai-folk-medicine` exists.
2. Template `compose.prod.yaml` to the app directory.
3. Template `.env` from vault variables (mode `0600`).
4. `docker login ghcr.io` with the short-lived token from the workflow.
5. `docker compose pull`.
6. `docker compose up -d`. The backend applies migrations on start.
7. Prune dangling images.

## Production compose (template)

`compose.yaml` stays as-is for local development (it builds images).
`templates/compose.prod.yaml.j2` keeps the same topology but:

- Backend and frontend use `image: ghcr.io/...:{{ app_version }}` instead of
  `build:`.
- Secrets come from the templated `.env` file.
- Postgres keeps its named volume. Frontend is published on `:3000`.
  Backend stays on the internal network only.

## Secrets

GitHub Actions secrets (set once, by hand):

- `SSH_PRIVATE_KEY` — deploy key present on the server.
- `ANSIBLE_VAULT_PASSWORD` — decrypts the vault.
- `KNOWN_HOSTS` — the server host key, for SSH host verification.
- `GITHUB_TOKEN` — automatic. Pushes to GHCR and the server pulls with it.

Ansible Vault (`group_vars/prod/vault.yml`, encrypted, committed):

- `ansible_host`, `ansible_user`.
- `JWT_SECRET`.
- `STAFF_ADMIN_USERNAME`, `STAFF_ADMIN_PASSWORD`, `STAFF_ADMIN_EMAIL`.
- `POSTGRES_PASSWORD`.

## Verification

- CI runs real `go test` and `vitest`.
- The deploy files are validated in CI with `ansible-playbook --syntax-check`
  and `docker compose config` on the template rendered with placeholder
  values (no vault access needed).
- A full end-to-end deploy needs the live server and the real secrets. The
  user runs that.

## Assumptions and out of scope

- TLS and reverse proxy: the server already terminates TLS and routes to
  `:3000` (Caddy, nginx, or Traefik). This design does not add one.
- Postgres stays inside Compose with a named volume. No managed database.
- One `prod` environment. No staging.

## 15-Factor and Clean Architecture notes

- Config comes from the environment through the `.env` file. No secret is
  hard-coded.
- Processes are stateless. State lives in the Postgres volume and the photo
  volume.
- Build, release, and run are separate stages: CI builds, the tag is the
  release, Ansible runs it.
- The deploy layer does not touch application code. It only wires
  configuration and orchestration.

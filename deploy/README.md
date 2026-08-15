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
- The frontend container listens on `:3000`, published on the host at
  `${FRONTEND_PORT}` (set by `frontend_port` in `group_vars/prod/vars.yml`,
  currently `14285`; falls back to `3000`).
- The deploy installs an nginx reverse proxy at
  `/etc/nginx/conf.d/{{ nginx_conf_name }}` (default
  `thai-folk-medicine.conf`) that proxies `:80` to the frontend's published
  port, then runs `nginx -t && systemctl reload nginx`. Requires sudo on the
  deploy user and nginx already installed on the server. Set
  `nginx_server_name` in `vars.yml` to your domain (default `_` catch-all).
  This is HTTP only — terminate TLS in front (external LB / CDN) or extend the
  template with a `:443` server block.

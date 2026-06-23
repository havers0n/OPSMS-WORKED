# Deployment

This document defines the first manual production deployment model for WOS. It is intentionally limited to a single VPS and Docker Compose. It does not add continuous deployment, SSH deploy workflows, image registry publishing, automatic migrations, Kubernetes, Terraform, blue/green deploys, or zero-downtime deployment.

Use [SERVER_RUNBOOK.md](./SERVER_RUNBOOK.md) for the step-by-step VPS rehearsal.

## 1. Deployment Model

The first production model is:

- single Ubuntu/Debian VPS
- Docker Compose running from a repo clone on the server
- expected app directory: `/opt/wos/app`
- server-only `.env.production` created from `.env.production.example`
- `web` container serves the Vite static build through Nginx
- `web` publishes `${WEB_PORT:-8080}:80` by default
- safer final shape behind system Nginx/Caddy is `127.0.0.1:${WEB_PORT:-8080}:80`
- `bff` listens only inside the Compose network on `BFF_HOST=0.0.0.0`, `BFF_PORT=8787`
- `/api/*` is proxied by the web container to the internal BFF
- Supabase/Postgres is external or already provisioned before deploy
- no automatic migrations in the first deployment version

Current production Docker files:

- `docker-compose.prod.yml`
- `apps/web/Dockerfile`
- `apps/web/nginx.conf`
- `apps/bff/Dockerfile`

The production web image uses `apps/web/nginx.conf` as its reverse proxy config. For large manual-shift Excel uploads, keep the `/api/` location body limit aligned with the BFF upload limits. The current target is `client_max_body_size 20m;`.

## 2. Server Prerequisites

Assumptions:

- Ubuntu or Debian server
- non-root deploy user, for example `deploy`
- SSH key access for the deploy user
- Git
- curl
- Docker Engine
- Docker Compose plugin, available as `docker compose`
- optional system Nginx or Caddy for domain/TLS

Baseline packages:

```bash
sudo apt update
sudo apt install git curl ca-certificates
```

Install Docker from the official Docker instructions for the server OS, then verify:

```bash
docker --version
docker compose version
```

Create the deploy user deliberately and review SSH/sudo policy before using these commands on a real server:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudoedit /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Log out and back in after adding the user to the `docker` group.

## 3. Server Directory Layout

Recommended first git-based layout:

```text
/opt/wos/
  app/       cloned repository
  backups/   DB backup receipts, restore notes, migration evidence
  logs/      copied incident logs or deployment notes; live logs remain in Docker
```

Create it with narrow ownership:

```bash
sudo mkdir -p /opt/wos/app /opt/wos/backups /opt/wos/logs
sudo chown -R deploy:deploy /opt/wos
```

The repo lives in `/opt/wos/app`. The server-only env file lives at `/opt/wos/app/.env.production`.

## 4. Environment Handling

Create production env on the server only:

```bash
cd /opt/wos/app
cp .env.production.example .env.production
$EDITOR .env.production
chmod 600 .env.production
```

Required values:

```env
WEB_PORT=8080
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_BFF_URL=/api
VITE_ENABLE_DEV_AUTO_LOGIN=false
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
BFF_HOST=0.0.0.0
BFF_PORT=8787
BFF_CORS_ORIGIN=https://YOUR_DOMAIN
PRINT_RENDER_FRONTEND_URL=http://web
```

Rules:

- never commit `.env.production`
- never use a production service-role key in frontend `VITE_*` variables
- `VITE_BFF_URL=/api` assumes the web container proxies `/api/*` to BFF
- `BFF_CORS_ORIGIN` must match the final public origin exactly, including scheme
- BFF port `8787` must not be published directly to the host
- `PRINT_RENDER_FRONTEND_URL` must be reachable from the BFF container and serve both frontend routes and the `/api` proxy
- `/api/ready` requires Supabase connectivity and the `public.healthcheck()` RPC from migration `0109_ready_healthcheck_rpc.sql`

## 5. Build And Run Commands

From `/opt/wos/app`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f bff
```

Restart and stop:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production restart
docker compose -f docker-compose.prod.yml --env-file .env.production stop
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

Use `down` only when removing the running containers/network is acceptable.

## 6. Verification Checklist

Local checks from the VPS:

```bash
curl -i http://localhost:8080
curl -i http://localhost:8080/api/health
curl -i http://localhost:8080/api/ready
```

Expected results:

- `/` returns frontend HTML
- `/api/health` returns OK when the BFF process is alive
- `/api/ready` returns ready only when Supabase/DB is reachable and migrated
- `/api/ready` can return HTTP 503 when Supabase env is placeholder, connectivity fails, or `public.healthcheck()` is missing

If using system Nginx/Caddy and TLS:

```bash
curl -i https://YOUR_DOMAIN/
curl -i https://YOUR_DOMAIN/api/health
curl -i https://YOUR_DOMAIN/api/ready
```

The BFF internal routes are `/health` and `/ready`; production traffic should use `/api/health` and `/api/ready` through the web proxy.

## 7. Firewall And Ports

Recommended first setup:

- SSH open only as required, preferably restricted by provider firewall or UFW rules
- HTTP `80/tcp` open when serving HTTP or issuing certificates
- HTTPS `443/tcp` open for the final public site
- BFF `8787/tcp` closed publicly
- Docker web port `8080/tcp` either temporarily public for testing or bound to loopback behind system Nginx/Caddy

Example UFW shape:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Safer final Compose port binding behind system Nginx/Caddy:

```yaml
ports:
  - "127.0.0.1:${WEB_PORT:-8080}:80"
```

Do not change Compose during production deployment unless the change has already been reviewed and validated.

## 8. TLS And Domain Plan

Simple path:

1. Point DNS `A` record for `YOUR_DOMAIN` to the VPS public IP.
2. Bind the Compose web service to `127.0.0.1:8080` when a system reverse proxy is used.
3. Terminate TLS in system Nginx or Caddy.
4. Proxy public traffic to `http://127.0.0.1:8080`.
5. Keep the app container responsible for SPA serving and `/api/*` proxying to BFF.

Caddy example:

```text
YOUR_DOMAIN {
  reverse_proxy 127.0.0.1:8080
}
```

Nginx plus Certbot is also acceptable. Commands are server-specific, but the high-level flow is:

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudoedit /etc/nginx/sites-available/wos
sudo ln -s /etc/nginx/sites-available/wos /etc/nginx/sites-enabled/wos
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Before pointing real DNS to the server:

- [ ] intended commit is checked out
- [ ] `.env.production` points to the intended Supabase project
- [ ] `BFF_CORS_ORIGIN` matches the final origin
- [ ] firewall exposes only intended ports
- [ ] TLS certificate path is understood
- [ ] `/api/health` passes through the public origin
- [ ] `/api/ready` is expected to pass after migrations are confirmed
- [ ] rollback commit SHA is recorded

## 9. Backup And Migration Policy

First-version policy:

- no automatic migrations during deploy
- confirm migration status manually before deploy
- create a database backup before any production migration
- never run seed/reset scripts against production
- `/api/ready` depends on required DB objects, including `public.healthcheck()`
- schema rollback is handled separately from app rollback

Before deploy:

- [ ] DB backup exists or backup receipt is recorded in `/opt/wos/backups`
- [ ] migrations reviewed
- [ ] no reset or seed scripts will run against production
- [ ] env points to the intended Supabase project
- [ ] `public.healthcheck()` exists and returns `ok`
- [ ] `/api/ready` is expected to pass after deploy

## 10. Manual Rollback

Record the current known-good commit before deploying:

```bash
cd /opt/wos/app
git rev-parse HEAD | tee /opt/wos/last-known-good.txt
```

Deploy a target commit:

```bash
git fetch origin
git checkout <target-sha>
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
curl -i http://localhost:8080/api/health
curl -i http://localhost:8080/api/ready
```

Rollback if health or readiness fails and the issue is app/container related:

```bash
previous_good_sha="$(cat /opt/wos/last-known-good.txt)"
git checkout "$previous_good_sha"
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
curl -i http://localhost:8080/api/health
curl -i http://localhost:8080/api/ready
```

DB migrations may not be rollback-safe. If a deploy included manual schema changes, decide the DB recovery path separately before rolling the application back.

## 11. First Manual Deploy Rehearsal

Dry run:

1. Create deploy user.
2. Clone repo into `/opt/wos/app`.
3. Check out target commit.
4. Create `.env.production`.
5. Confirm DB backup/migration status.
6. Build images.
7. Start Compose.
8. Check `web` and `bff` logs.
9. Curl frontend.
10. Curl `/api/health`.
11. Curl `/api/ready`.
12. Test one browser login flow.
13. Test one read-only warehouse/product/operations flow.
14. Record issues, target commit, rollback commit, and final health status.

## 12. WooCommerce Product Sync

Product sync pulls all products from artos.co.il and upserts them into Supabase.

**Local development:**

```bash
npm run sync:products:local --workspace=@wos/bff
```

Requires `apps/bff/.env.local` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Production:**

Sync runs automatically via GitHub Actions once per day (02:15 UTC).
Manual trigger: **Actions → Sync products → Run workflow**.

The workflow SSHs into the VPS and passes the key via `docker exec` stdin, not via CLI arguments. The key is injected only into that one-off process and is never persisted on the VPS.

**Required repository secrets (Settings → Secrets and variables → Actions):**

| Secret | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key for the sync script |
| `VPS_SSH_FINGERPRINT` | VPS host fingerprint — prevents SSH MITM during sync |

Security rules — `SUPABASE_SERVICE_ROLE_KEY` must never appear in:

- `VITE_*` variables or frontend bundles
- Docker image layers or Compose files
- Regular BFF container environment
- Logs, docs, or committed env files

## 13. What Is Intentionally Postponed

- image registry publishing
- automatic migrations
- E2E deployment gate
- SQL test harness in CI
- zero-downtime deployment
- monitoring and alerting
- automated backups

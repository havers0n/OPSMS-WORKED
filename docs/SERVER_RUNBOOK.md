# First Manual VPS Deploy Runbook

This runbook rehearses the first manual production server deployment. It assumes the deployment model in [DEPLOYMENT.md](./DEPLOYMENT.md) and intentionally stops before any automated CD work.

## 1. Preflight

- [ ] Server is Ubuntu/Debian.
- [ ] SSH access works for a non-root deploy user.
- [ ] Docker Engine works for the deploy user.
- [ ] `docker compose version` works.
- [ ] Git and curl are installed.
- [ ] `/opt/wos/app` exists and is owned by the deploy user.
- [ ] Production Docker artifacts exist in the repo checkout.
- [ ] `.env.production` exists only on the server and has mode `600`.
- [ ] Target commit SHA is known.
- [ ] Previous known-good commit SHA is recorded when replacing an existing deployment.
- [ ] Supabase project, anon key, and migration status are confirmed.
- [ ] DB backup exists before any production migration.

## 2. Create Deploy User

Review these commands before running them on a real server:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudoedit /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Open a new SSH session as `deploy` before continuing.

## 3. Prepare Directories

```bash
sudo mkdir -p /opt/wos/app /opt/wos/backups /opt/wos/logs
sudo chown -R deploy:deploy /opt/wos
```

## 4. Clone Or Update Repo

First clone:

```bash
cd /opt/wos
git clone <repo-url> app
cd /opt/wos/app
git checkout <target-sha>
```

Existing clone:

```bash
cd /opt/wos/app
git rev-parse HEAD | tee /opt/wos/last-known-good.txt
git fetch origin
git checkout <target-sha>
```

Confirm required files:

```bash
test -f docker-compose.prod.yml
test -f apps/web/Dockerfile
test -f apps/web/nginx.conf
test -f apps/bff/Dockerfile
test -f .env.production.example
```

## 5. Create Production Environment

```bash
cd /opt/wos/app
cp .env.production.example .env.production
$EDITOR .env.production
chmod 600 .env.production
```

Confirm these values are production-correct:

- [ ] `WEB_PORT=8080`, unless the server intentionally uses another port
- [ ] `VITE_SUPABASE_URL` is the intended Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` is an anon key, not a service-role key
- [ ] `VITE_BFF_URL=/api`
- [ ] `VITE_ENABLE_DEV_AUTO_LOGIN=false`
- [ ] `SUPABASE_URL` is the intended Supabase project URL
- [ ] `SUPABASE_ANON_KEY` is present
- [ ] `BFF_HOST=0.0.0.0`
- [ ] `BFF_PORT=8787`
- [ ] `BFF_CORS_ORIGIN` exactly matches the final browser origin

## 6. Migration And Backup Gate

Do not run migrations automatically from Docker startup.

- [ ] Production DB backup exists.
- [ ] Migration files have been reviewed.
- [ ] Required migrations have been applied manually by the DB owner/operator.
- [ ] No seed or reset command will run against production.
- [ ] `public.healthcheck()` exists and returns `ok`.
- [ ] `/api/ready` is expected to pass once the app starts.

## 7. Build And Start

```bash
cd /opt/wos/app
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

## 8. Logs

Follow startup logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f bff
```

Bounded inspection:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 web
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 bff
```

## 9. Local Verification

Run from the VPS:

```bash
curl -i http://localhost:8080
curl -i http://localhost:8080/api/health
curl -i http://localhost:8080/api/ready
```

Expected:

- `/` returns frontend HTML
- `/api/health` returns BFF liveness with `status: ok`
- `/api/ready` returns readiness only when Supabase is reachable and migrated
- `/api/ready` returns HTTP 503 when the Supabase placeholder env is used, connectivity fails, or `public.healthcheck()` is missing

## 10. Firewall Hardening

Minimum intended exposure:

- [ ] SSH open only as required
- [ ] `80/tcp` open if using HTTP or certificate issuance
- [ ] `443/tcp` open for HTTPS
- [ ] `8787/tcp` closed publicly
- [ ] `8080/tcp` closed publicly when system Nginx/Caddy proxies to loopback

Check:

```bash
sudo ufw status verbose
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

When using system Nginx/Caddy, prefer this Compose shape after validation:

```yaml
ports:
  - "127.0.0.1:${WEB_PORT:-8080}:80"
```

## 11. TLS And Domain Verification

After DNS and TLS are configured through system Nginx or Caddy:

```bash
curl -i https://YOUR_DOMAIN/
curl -i https://YOUR_DOMAIN/api/health
curl -i https://YOUR_DOMAIN/api/ready
```

Before pointing real DNS to the server:

- [ ] server responds correctly on localhost
- [ ] reverse proxy points to `127.0.0.1:8080`
- [ ] TLS certificate is issued for the final domain
- [ ] `BFF_CORS_ORIGIN` matches `https://YOUR_DOMAIN`
- [ ] public `/api/health` passes
- [ ] public `/api/ready` passes or has an understood DB-readiness reason
- [ ] browser login works
- [ ] one read-only warehouse/products/operations flow works

## 12. Browser Smoke

Manual smoke after curl checks:

- [ ] Open `https://YOUR_DOMAIN/` or temporary `http://SERVER_IP:8080/`.
- [ ] Confirm the frontend loads without a blank screen.
- [ ] Log in with a production-authorized user.
- [ ] Open one read-only warehouse view.
- [ ] Open one read-only product or operations view.
- [ ] Confirm no unexpected BFF errors appear in logs.

## 13. Rollback

If a deploy fails health checks before any schema change:

```bash
cd /opt/wos/app
previous_good_sha="$(cat /opt/wos/last-known-good.txt)"
git checkout "$previous_good_sha"
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
curl -i http://localhost:8080/api/health
curl -i http://localhost:8080/api/ready
```

If a deploy included manual migrations, do not assume app rollback is enough. Decide whether the schema is forward-compatible, whether a DB restore is required, or whether a separate corrective migration is safer.

## 14. Stop Or Restart

Restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production restart
```

Stop without removing containers:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop
```

Stop and remove containers/network:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

## 15. Rehearsal Notes

During the first manual VPS rehearsal, record:

- server OS and version
- Docker and Compose versions
- target commit SHA
- Supabase project identifier, without secrets
- whether `8080` was public or loopback-only
- TLS/reverse proxy choice
- curl results for `/`, `/api/health`, and `/api/ready`
- browser smoke result
- rollback SHA
- issues found and owner

## 16. Intentionally Postponed

- GitHub Actions CD
- SSH deploy workflow
- image registry publishing
- automatic migrations
- E2E deployment gate
- SQL test harness in CI
- zero-downtime deployment
- monitoring and alerting
- automated backups

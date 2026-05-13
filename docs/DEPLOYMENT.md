# Deployment

This repo is prepared for a manual, production-like Docker Compose deployment on a single server. It does not include continuous deployment, automatic database migrations, image registry publishing, or infrastructure provisioning.

## Prerequisites

- Docker Engine and Docker Compose v2.
- A server-local `.env.production` file created from `.env.production.example`.
- A reachable Supabase project or local Supabase-compatible service with the required schema already migrated.
- No real secrets committed to the repository.

## Create `.env.production`

Copy the example and replace placeholders on the server:

```bash
cp .env.production.example .env.production
```

Set the public Vite values used during the frontend image build:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=replace-me
VITE_BFF_URL=/api
VITE_ENABLE_DEV_AUTO_LOGIN=false
```

Set the BFF runtime values:

```env
BFF_HOST=0.0.0.0
BFF_PORT=8787
BFF_LOG_LEVEL=info
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=replace-me
BFF_CORS_ORIGIN=https://your-public-hostname.example
WEB_PORT=8080
```

## Build Images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
```

## Start Containers

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml ps
```

The `web` service publishes `${WEB_PORT:-8080}:80`. The `bff` service is only exposed on the internal Compose network.

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f bff
```

## Verify Frontend

```bash
curl http://localhost:8080
```

This should return the static Vite app served by Nginx. React Router refreshes are handled by the Nginx `try_files` fallback to `index.html`.

## Verify BFF Health

```bash
curl http://localhost:8080/api/health
```

Nginx forwards this to the internal BFF `/health` route. It should return a basic service health response if the BFF process is running.

## Verify BFF Readiness

```bash
curl http://localhost:8080/api/ready
```

Nginx forwards this to the internal BFF `/ready` route. This check requires Supabase connectivity and the `healthcheck` RPC to be present. If Supabase is unavailable or placeholders are used, this can return `503` while `/api/health` still succeeds.

## Stop And Restart

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml restart bff
docker compose -f docker-compose.prod.yml restart web
```

## Manual Rollback

For a manual rollback, keep the previous checked-out commit or release artifact available on the server. Stop the current stack, check out the previous known-good revision, rebuild, and start again:

```bash
docker compose -f docker-compose.prod.yml down
git checkout <previous-known-good-commit>
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Intentionally Not Automated Yet

- No GitHub Actions CD.
- No SSH deployment workflow.
- No image registry publishing.
- No Kubernetes, Terraform, or VPS provisioning.
- No automatic database migrations.
- No Supabase SQL test harness in Docker validation.
- No Playwright/E2E tests in Docker validation.
- No zero-downtime deployment strategy.

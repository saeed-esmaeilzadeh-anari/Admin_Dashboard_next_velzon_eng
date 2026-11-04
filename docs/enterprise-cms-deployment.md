# Enterprise CMS Deployment Guide

## Deployment topology

Recommended self-hosted topology:

- Next.js frontend and BFF on a Node.js runtime.
- NestJS API on a persistent Node.js service or a serverless runtime with external scheduler.
- PostgreSQL 16+ with TLS and automated backups.
- S3-compatible object storage/CDN for production media.
- External scheduler for scheduled publishing and webhook dispatch if the backend runtime does not run continuously.
- HTTPS on all public origins.

No deployment provider is required by this repository.

## Private backend environment

Set the following in the frontend host:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
BACKEND_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_BACKEND_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_SITE_NAME=Customer CMS
```

`BACKEND_API_URL` is the primary server-only BFF target. Do not define it as `NEXT_PUBLIC_*`.

## Backend environment

Configure at least these private settings:

- `DATABASE_URL`: PostgreSQL connection.
- `JWT_SECRET`: randomly generated private value of at least 32 characters.
- `CORS_ORIGINS`: exact frontend origin(s), comma-separated.
- `PUBLIC_SITE_URL`: canonical public frontend origin.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: bootstrap values used by the seed command.
- `CMS_MEDIA_STORAGE=s3`, S3 bucket/region/public origin and required credentials for persistent object storage.
- `CMS_JOB_TOKEN`: random private value of at least 32 characters for external job calls.

Never commit a populated `.env` file or expose private credentials in client-side variables.

## Database release procedure

1. Provision a staging database matching Production's PostgreSQL major version.
2. Run migrations and seed on staging.
3. Verify migration status, role grants and a seeded administrator.
4. Back up Production and confirm the restore procedure before schema changes.
5. Deploy backend code and run `npm run prisma:deploy` using the matching release.
6. Verify `GET /api/v1/health`, Swagger and BFF authentication.
7. Deploy the frontend with the matching `BACKEND_API_URL`.
8. Execute staging smoke tests before allowing customer traffic.

Do not use `prisma db push` for Production.

## Commands

Backend:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed   # only for bootstrap/approved seed updates
npm run build
npm run start:prod
```

Frontend:

```bash
npm ci --legacy-peer-deps
npm run type-check
npm run build
npm run start
```

Run the frontend and backend in their respective project directories.

## External scheduled jobs

If NestJS is deployed serverlessly or without a continuously running process, an external scheduler must call:

```http
POST /api/v1/internal/cms/jobs/publish-scheduled
Authorization: Bearer <CMS_JOB_TOKEN>

POST /api/v1/internal/cms/jobs/dispatch-webhooks
Authorization: Bearer <CMS_JOB_TOKEN>
```

Use a private scheduler secret store. Never put `CMS_JOB_TOKEN` in the browser.

The current in-process cron/worker does not constitute a durable distributed queue. Verify overlap/lease behavior before running multiple backend instances.

## Go-live checklist

- HTTPS and CORS verified.
- PostgreSQL migration and restore rehearsed.
- S3/persistent media upload, read and delete tested across redeploy.
- BFF login, logout, expiry and 401/403 behavior tested.
- CMS role and direct API permission tests passed.
- Persian/English public rendering, slug, SEO, hreflang and sitemap verified.
- Forms, webhooks, retries and scheduled publishing tested.
- Monitoring, error reporting, log retention and alerting configured.
- Commercial source/template/asset license checked.
- Production approval and deployment authorization obtained.

No Production infrastructure is provisioned by this branch.

# Velzon Enterprise CMS — Deployment Runbook

This document describes the repository-supported deployment contract. It does not mean that any hosting provider, database or production environment has been provisioned.

## Deployment topology

- Next.js frontend and BFF.
- NestJS API.
- PostgreSQL 16 or later.
- S3-compatible persistent object storage for media.
- External scheduler/worker when the NestJS process is serverless or does not stay alive.
- HTTPS on all public endpoints.

A dedicated installation per customer is the current deployment model. Do not expose a single shared database to multiple customer organizations as SaaS without a separate tenant isolation design.

## Frontend environment

Set these in the Next.js hosting environment:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
BACKEND_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_BACKEND_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_SITE_NAME=Customer Site
```

`BACKEND_API_URL` is private server-side configuration. Do not prefix it with `NEXT_PUBLIC_`.

## Backend environment

Start from `backend/.env.example`. Configure at least:

```dotenv
DATABASE_URL=postgresql://...
JWT_SECRET=<random-secret-at-least-32-characters>
PORT=3001
NODE_ENV=production
CORS_ORIGINS=https://www.example.com
PUBLIC_SITE_URL=https://www.example.com
ADMIN_NAME=Customer Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-bootstrap-password>
CMS_MEDIA_STORAGE=s3
CMS_MAX_UPLOAD_BYTES=26214400
CMS_JOB_TOKEN=<random-private-token>
```

Set `CMS_JOB_TOKEN` only if an external scheduler will call internal job endpoints. Keep all secrets in the provider's secret manager.

S3-compatible settings:

```dotenv
S3_BUCKET=<bucket>
S3_REGION=<region>
S3_ENDPOINT=<optional-endpoint>
S3_PUBLIC_BASE_URL=https://media.example.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<private-key>
S3_SECRET_ACCESS_KEY=<private-secret>
```

Use provider-managed identity/credentials when supported. Keep the bucket policy and CDN access behavior aligned with public/private media requirements.

## Release procedure

1. Create a database backup and verify the backup file/restore point.
2. Provision PostgreSQL and configure TLS/connection pooling appropriate to the host.
3. Provision persistent object storage and verify upload/read/delete permissions.
4. Configure frontend/backend environment variables and exact CORS origins.
5. Install dependencies from lockfiles.
6. Run `npx prisma validate` and `npm run prisma:generate` in `backend/`.
7. Apply database migrations with `npm run prisma:deploy`.
8. Seed the first administrator only in a secure controlled run.
9. Build and start NestJS and Next.js.
10. Run the release smoke tests in `docs/enterprise-cms-testing.md`.
11. Verify logs, error monitoring, health endpoints and scheduled jobs.
12. Record commit SHA, migration status, storage bucket and restore point in the release record.

Do not run `prisma db push` against production.

## Health and API checks

- Backend health: `GET /api/v1/health`.
- Swagger: `/docs`.
- OpenAPI: `/docs-json`.
- Public sitemap: backend `/api/v1/public/cms/sitemap.xml` and frontend `/sitemap.xml`.

Health-check success does not prove database write, storage durability, scheduler or email functionality.

## Serverless scheduled jobs

For serverless deployments:
1. Set backend `CMS_JOB_TOKEN` privately.
2. Set GitHub Actions secrets `CMS_API_BASE_URL` (HTTPS base ending in `/api/v1`) and `CMS_JOB_TOKEN`.
3. Run the CMS Scheduled Jobs workflow manually once.
4. Inspect the workflow result and backend job logs.

The checked-in workflow invokes scheduled publication and webhook dispatch every five minutes. GitHub Actions may delay scheduled execution. Use a dedicated durable queue/scheduler for strict delivery or publication SLAs.

## Rollback

- Application rollback: redeploy the previous known-good application artifact/commit.
- Database rollback: use a tested forward-fix or restore the pre-migration backup to a controlled recovery database. Do not assume every Prisma migration can be reversed automatically.
- Media rollback: restore objects and database metadata from matching backup points.
- After rollback, validate login, public content, media, webhook queue and scheduler behavior.

No production deployment is authorized by this repository change.

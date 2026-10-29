# Production Readiness Checklist

This checklist is the manual deployment boundary for the current CMS branch. CI validates the repository and a disposable PostgreSQL database; it does not provision or validate production services.

## 1. Provision services

- [ ] Provision PostgreSQL 16+ with TLS, automated backups, and a tested restore procedure.
- [ ] Provision persistent S3-compatible object storage/CDN for media when the backend is serverless. Do not rely on an ephemeral function filesystem.
- [ ] Decide whether NestJS runs as a persistent process or serverless. Serverless needs an external cron/scheduler for scheduled publishing and webhook dispatch.
- [ ] Use HTTPS for the frontend, backend and public media CDN.

## 2. Configure backend secrets

Set these privately in the backend hosting platform, not in Git:

- DATABASE_URL: production PostgreSQL connection string.
- JWT_SECRET: unique random secret, at least 32 characters.
- ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD: dedicated administrator email and a strong seed password of at least 12 characters.
- CORS_ORIGINS: exact frontend origin(s), comma-separated and without path segments.
- PUBLIC_SITE_URL: canonical public website origin.
- CMS_MEDIA_STORAGE=s3, S3_BUCKET, S3_REGION, S3_PUBLIC_BASE_URL and credentials/endpoint as needed.
- CMS_JOB_TOKEN: unique random secret of at least 32 characters if an external scheduler will run jobs.

Never put database passwords, JWT secrets, S3 credentials or the job token in NEXT_PUBLIC variables.

## 3. Set up the database

1. Back up production and verify a restore before schema changes.
2. Deploy the backend version matching the checked-in Prisma schema.
3. Run npm run prisma:deploy once against production.
4. Verify migration status and API connectivity.
5. Run npm run prisma:seed with the intended dedicated administrator email. The seed refuses to promote existing non-admin users and does not rotate an existing admin password.
6. Sign in as administrator and configure menu items, media, forms, webhooks and role grants. Starter main menus are intentionally empty.

## 4. Set frontend configuration

Set these values in the Next.js host and create a fresh build:

    NEXT_PUBLIC_DEFAULT_AUTH=backend
    NEXT_PUBLIC_BACKEND_API_URL=https://api.example.com/api/v1
    NEXT_PUBLIC_SITE_URL=https://www.example.com
    NEXT_PUBLIC_SITE_NAME=Example

Use the deployed frontend origin in backend CORS_ORIGINS. Confirm the API base URL ends in /api/v1.

## 5. Scheduled jobs for serverless

Configure an external scheduler to call both endpoints every minute. Store CMS_JOB_TOKEN only in the scheduler secret store and backend environment.

    POST https://api.example.com/api/v1/internal/cms/jobs/publish-scheduled
    Authorization: Bearer <CMS_JOB_TOKEN>

    POST https://api.example.com/api/v1/internal/cms/jobs/dispatch-webhooks
    Authorization: Bearer <CMS_JOB_TOKEN>

Use separate POST requests and never expose these calls to browser code.

## 6. Mandatory smoke tests

- [ ] Test health, login, logout and expired-token behavior.
- [ ] Create Persian and English pages, add media and builder blocks, preview, submit for review, publish, edit after publication, and confirm the old live snapshot remains until republishing.
- [ ] Verify both language URLs, SEO metadata, language alternates and sitemap.
- [ ] Add localized main-menu items and verify RTL/LTR rendering and HTTPS-only external menu links.
- [ ] Test redirect status codes and locale matching; confirm direct redirect loops are rejected.
- [ ] Submit a public form and confirm throttling and unexpected-field rejection.
- [ ] Test webhook signatures, retry behavior and delivery history using a controlled HTTPS endpoint.
- [ ] Upload, read and delete media; verify object persistence after redeploy.
- [ ] Test ADMIN, MANAGER and USER permissions for allowed and denied actions.
- [ ] Verify audit records, backup and restore, accessibility and load behavior.
- [ ] Run frontend type-check/build, backend type-check/tests/build and the PostgreSQL migration/seed smoke workflow on the exact release commit.

## Scope boundary

The CMS-specific pages and APIs are implemented as a complete first CMS slice. The legacy e-commerce, CRM, project/task and other template demo pages are not all migrated away from Fake Backend. Fine-grained action permissions exist, but ownership/team-level authorization, password recovery/email verification, richer public-form spam controls, and production end-to-end/accessibility/load testing still need separate work before an enterprise-wide production rollout.

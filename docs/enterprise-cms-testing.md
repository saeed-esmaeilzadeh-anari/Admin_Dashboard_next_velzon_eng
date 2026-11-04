# Enterprise CMS Testing Guide

## Automated CI

### Backend workflow

The backend GitHub Actions workflow:

1. Starts PostgreSQL 16.
2. Installs dependencies.
3. Validates Prisma schema and generates the client.
4. Deploys checked-in migrations.
5. Verifies migration status.
6. Seeds roles, permissions, locales/content types and administrator.
7. Runs the database seed smoke test.
8. Runs TypeScript checking and Jest unit tests.
9. Builds NestJS and verifies the entrypoint.
10. Runs API/auth runtime and watch-mode smoke tests.

### Frontend workflow

The frontend workflow:

1. Installs dependencies from the lockfile.
2. Runs TypeScript checking.
3. Runs a Next.js production build.
4. Starts the production server against a disposable local mock API.
5. Tests that known legacy demo routes redirect to the CMS, the CMS admin page requires a session, the login response sets an HttpOnly cookie without leaking the token, the BFF forwards the session as a Bearer token and logout expires the cookie.

The latest result must be checked on the exact final branch SHA. Older runs may be cancelled by the workflow's concurrency policy as newer commits arrive.

## Local commands

Frontend:

```bash
npm ci --legacy-peer-deps
npm run type-check
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run type-check
npm test
npm run test:db-smoke
npm run build
```

The DB smoke script expects a migrated, seeded isolated test database.

## Manual staging scenarios

### CMS editorial workflow
- Sign in as ADMIN.
- Create a content type/field.
- Create a Persian version and an English translation.
- Upload and attach a media asset.
- Save draft and submit for review.
- Verify unauthorized roles cannot publish.
- Review, publish and inspect public content, SEO metadata and sitemap.
- Edit the draft after publication and verify the public snapshot remains unchanged until republishing.
- Restore a prior revision.

### Role authorization
- Configure the grants for MANAGER, EDITOR, AUTHOR, REVIEWER, MEDIA_MANAGER, ANALYST and READ_ONLY.
- Test allowed and denied operations through direct API calls, not only the UI.
- Verify ADMIN/SUPER_ADMIN restrictions, self-demotion prevention and last-active-admin protection.
- Verify an ADMIN cannot promote a user to SUPER_ADMIN or manage a SUPER_ADMIN account.

### Forms and webhooks
- Submit valid and invalid form payloads.
- Verify throttling and rejection of unknown/invalid fields.
- Submit to a controlled public HTTPS webhook receiver.
- Verify HMAC signature, delivery history, failed delivery and retry.
- Verify private/internal destinations are rejected.

### Media
- Upload valid and invalid MIME/signature combinations.
- Verify size limits and random object keys.
- Verify referenced media cannot be deleted.
- Verify S3/local persistent media survive backend restart/redeploy in the selected hosting setup.

### Backup and recovery
- Create database and object-storage backups.
- Restore into an isolated database/bucket.
- Verify content, users, revisions, permissions, media URLs and sitemap.

## Test coverage limitations

There is currently no dedicated frontend component test suite or Playwright/Browser E2E suite in the root package. CI does not prove the full editorial workflow through an actual browser. Accessibility, performance/load, security penetration, multi-browser and production backup/restore tests remain release gates.

# Enterprise CMS — Testing and Release Checklist

## Automated checks in repository CI

### Frontend workflow

Workflow: `.github/workflows/frontend-ci.yml`

- `npm ci --legacy-peer-deps --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- Start production Next.js server and a disposable mock NestJS API.
- Verify public pages and a chart page respond.
- Verify BFF health proxy, rejected login, successful login, HttpOnly cookie, access-token non-disclosure, authenticated `/auth/me`, and logout cookie expiry.
- Current branch extends this with a published CMS public-content Server Component smoke test. Check the exact final CI run before calling it passed.

The repository includes a focused Playwright Chromium browser suite in `e2e/portfolio-journeys.spec.ts`. Frontend CI installs the pinned runner and Chromium, then executes the suite against the production Next.js server and a disposable backend. It covers signup without auto-login, HttpOnly login, authenticated BFF requests, logout/cookie clearing, unauthorized access after logout, failed login and published public-page rendering. This is focused browser E2E coverage, not a full visual-regression, cross-browser or accessibility suite. The separate **CMS Frontend Quality** workflow runs Prettier and ESLint checks for maintained CMS sources and tracked legacy lint-debt files.

### Backend workflow

Workflow: `.github/workflows/backend-ci.yml`

- PostgreSQL 16 CI service.
- Prisma schema validation and client generation.
- Apply all checked-in migrations and inspect migration status.
- Run seed and database smoke invariants.
- `npm run type-check`
- `npm test`
- `npm run build`
- Run backend health/authentication smoke checks.

## Run locally

Frontend from repository root:

```powershell
npm ci --legacy-peer-deps
npm run type-check
npm run build
```

To run the browser suite locally against an already running Next.js server and backend:

```powershell
npm install --no-save --package-lock=false --legacy-peer-deps @playwright/test@1.64.1
npx playwright install chromium
$env:E2E_BASE_URL = "http://localhost:3000"
npx playwright test
```

The CI job installs the same pinned runner and Chromium. Use a disposable test environment: browser tests create a test account and sign in/out through the configured backend.

Backend from `backend/`:

```powershell
npm install
npm run prisma:generate
npx prisma validate
npm run type-check
npm test
npm run build
```

For database-dependent tests, configure a disposable PostgreSQL database and use `npm run prisma:deploy` followed by `npm run prisma:seed` and `npm run test:db-smoke`. Never point these commands at a customer's production database.

## Manual staging scenarios

Before launch, execute and record these using a real staging database and storage bucket:

1. ADMIN login through BFF, cookie flags, token non-disclosure, logout and expiry.
2. Create Page content type and a required/localized field; verify backend field validation.
3. Create Persian and English translations with distinct slugs.
4. Upload valid image and invalid/mismatched MIME content; verify invalid files are rejected.
5. Use media in a draft and published block; verify referenced media cannot be deleted.
6. Submit, reject, approve/publish and archive content using authorized roles.
7. Verify public pages return published snapshots only, metadata and hreflang alternates.
8. Verify public sitemap includes only published entries.
9. Verify nested menu, inactive menu items and external URL restrictions.
10. Create a redirect chain and reject a loop.
11. Submit valid and invalid public forms; verify throttling and submission privacy.
12. Deliver a webhook to a controlled public HTTPS endpoint; verify HMAC, retry and delivery history.
13. Attempt forbidden CMS actions with USER/MANAGER and verify backend 403 behavior.
14. Verify administrator cannot demote/deactivate self or remove the last active ADMIN.
15. Run scheduled publication and webhook jobs twice; verify no duplicate transitions/deliveries.
16. Export/import content into a separate staging install and verify partial/failure reporting.
17. Test database and media restore to a separate recovery environment.
18. Test Persian RTL and English LTR on desktop, tablet and mobile.

## Production acceptance gates

Do not mark a feature Production Ready without evidence from the exact release SHA. Required outstanding gates include:
- browser E2E/component tests;
- accessibility keyboard/screen reader review;
- browser compatibility and responsive QA;
- dependency/security/penetration tests;
- measured load/soak and performance baselines;
- content ownership/team-level authorization tests;
- backup and restore rehearsal;
- persistent object storage and deployed upload verification;
- deployed staging smoke test;
- operational monitoring, alerting and incident response.

A green CI workflow is necessary but does not replace these gates.

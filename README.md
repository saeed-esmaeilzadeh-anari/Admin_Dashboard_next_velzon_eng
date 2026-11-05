# Velzon Enterprise CMS

**A standalone, bilingual-ready Enterprise Content Management foundation built on the existing Velzon dashboard.**

> نسخه فارسی: این مخزن شامل رابط مدیریت مبتنی بر Next.js، API مبتنی بر NestJS و هسته CMS متصل به PostgreSQL است. پروژه در حال توسعه است و تا زمان عبور از آزمون‌های کامل، بررسی امنیتی، استقرار آزمایشی و آزمون بازیابی، نباید به‌عنوان محصول Production Ready فروخته یا مستقر شود.

[![Next.js](https://img.shields.io/badge/Next.js-15.5.28-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.7-149eca)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-ea2845)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.12.0-2d3748)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169e1)](https://www.postgresql.org/)

## Product scope and release status

The target deployment model for this release is **one independent installation per customer organization**. The current schema does not implement SaaS multi-tenancy. New tenant isolation must be designed as a separate, explicit product requirement before a shared-database SaaS launch.

The CMS core is database-backed. The repository also retains the original Velzon template modules. E-commerce, CRM, projects/tasks, tickets, crypto, NFT, job and other template/demo areas are not all migrated to real APIs and must not be represented as completed CMS capabilities. In backend-auth mode, the commercial navigation exposes the CMS surface rather than the full demo catalogue.

**Release gate: In development — not yet approved for production or commercial hand-off.** The current branch records concrete verification and remaining work in [the implementation status](docs/enterprise-cms-implementation-status.md) and [the enterprise audit](docs/enterprise-cms-audit.md).

## Implemented CMS foundation

The repository contains real PostgreSQL/Prisma models, NestJS endpoints and Next.js pages for:

- Content records, localized translations, dynamic content types and fields.
- Administrator-only user listing/search/pagination and updates for the current ADMIN/MANAGER/USER roles (invitations and account recovery are not implemented).
- Draft/review/publish/schedule/archive workflow actions and revision snapshots.
- A first-version page builder with hero, text/Markdown, image/gallery, CTA, FAQ and card-grid blocks. This is not a freeform visual drag-and-drop website designer.
- Media metadata, MIME/signature checks, upload size limits, local storage and an S3-compatible storage adapter.
- Taxonomies, terms, localized navigation menus and safe redirect resolution.
- Public published-content rendering, metadata, language alternates and XML sitemap output.
- Form definitions, server-side submission validation, submission review and throttling.
- Login and registration endpoint throttling (5/minute and 3/minute respectively); public registration is disabled by default in production unless explicitly enabled.
- HMAC-signed outbound webhook delivery, retry records and destination-address checks.
- CMS role-permission grants and audit records.
- JSON import/export with per-record results. Media binaries are not embedded in export packages.

The presence of a page or endpoint does not by itself mean the feature is production-qualified. See the audit for the current tested/partial/not-implemented classification.

## Technology stack

| Layer | Technology in this repository |
|---|---|
| Admin frontend | Next.js 15.5.28, React 19.2.7, TypeScript 5.x, App Router |
| UI | Bootstrap 5.3.6, Reactstrap and existing Velzon components |
| State | Redux Toolkit 2.8.2, redux-persist |
| Internationalization | i18next 25.2.0, react-i18next 15.5.2 |
| HTTP | Axios 1.9.0 and same-origin Next.js BFF for browser CMS requests |
| API | NestJS 10, REST, DTO validation, Swagger/OpenAPI |
| Data | PostgreSQL 16+, Prisma ORM 6.12.0 |
| Authentication | JWT access token, server-managed HttpOnly BFF cookie |
| Media | Local development storage or S3-compatible object storage |
| Jobs | NestJS scheduler for always-on deployments and authenticated external job endpoints |

Node.js 20 or later is required by the backend package. Use a supported, maintained Node.js LTS release for new installations.

## Architecture overview

```text
Browser
  |
  | same-origin pages and /backend-api/*
  v
Next.js App Router
  |-- CMS/admin UI
  |-- public published-content routes
  |-- BFF: HttpOnly velzon_session cookie
  |
  | server-side Bearer forwarding
  v
NestJS REST API (/api/v1)
  |-- Authentication and role checks
  |-- CMS permission guard
  |-- CMS content, workflow, media, forms, menus and webhooks
  |
  +-----------> PostgreSQL (Prisma migrations)
  |
  +-----------> S3-compatible object storage (production media)
  |
  +-----------> external scheduler / worker (serverless deployments)
```

The browser does not read the backend access token. The Next.js BFF issues a host-only `velzon_session` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, a maximum 15-minute lifetime and `Secure` in production. BFF requests use the cookie server-side to add the Bearer header. NestJS remains the authority for JWT verification and authorization.

## Repository structure

```text
.
├── src/
│   ├── app/                         # Next.js routes (admin CMS and public content)
│   ├── components/Cms/              # Public renderer and CMS components
│   ├── helpers/cmsApi.ts            # CMS API client/types
│   ├── helpers/backendApi.ts        # Same-origin BFF Axios client
│   ├── layouts/                     # Velzon layouts/navigation
│   └── components/Common/locales/    # Translation dictionaries
├── backend/
│   ├── prisma/schema.prisma         # PostgreSQL data model
│   ├── prisma/migrations/           # Checked-in SQL migrations
│   ├── prisma/seed.ts               # Initial administrator/locales/permissions
│   └── src/                         # NestJS modules/controllers/services
├── postman/                         # API collection and local environment
├── docs/                            # Architecture, audit and operations docs
└── .github/workflows/               # Frontend, backend and scheduled-job workflows
```

## Local development setup

### 1. Prerequisites

- Node.js 20+
- npm
- PostgreSQL 16+
- Git

### 2. Configure and start the backend

From the repository root:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/velzon_admin?schema=public"
JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
PORT=3001
NODE_ENV=development
PUBLIC_REGISTRATION_ENABLED=true
CORS_ORIGINS="http://localhost:3000"
ADMIN_NAME="Dashboard Administrator"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="REPLACE_WITH_A_STRONG_PASSWORD_AT_LEAST_12_CHARACTERS"
PUBLIC_SITE_URL="http://localhost:3000"
UPLOAD_DIR=uploads
CMS_MEDIA_STORAGE=local
CMS_MAX_UPLOAD_BYTES=26214400
```

Use a unique password. Never commit `backend/.env` or real credentials.

Install, migrate, seed and start:

```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

The first migration must be applied to an empty or backed-up development database. Production migrations must use `prisma migrate deploy`; do not use `prisma db push` for production.

### 3. Configure and start the frontend

Open a second terminal at the repository root:

```powershell
Copy-Item .env.example .env.local
npm ci --legacy-peer-deps
```

Set the CMS-related values in `.env.local`:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Velzon
```

- `BACKEND_API_URL` is the private server-side URL used by the Next.js BFF and server-rendered public CMS pages.
- `NEXT_PUBLIC_BACKEND_API_URL` is retained for compatibility and middleware redirect lookup. It must not contain credentials or secrets.
- Never store JWT secrets, database passwords, S3 credentials or job tokens in `NEXT_PUBLIC_*` variables.

Start Next.js:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend Swagger UI is at [http://localhost:3001/docs](http://localhost:3001/docs).

## Media storage

Local storage is intended for development and persistent single-server installations. The default directory is `backend/uploads/media` unless `UPLOAD_DIR` is changed. An ephemeral serverless filesystem is not durable.

For S3-compatible storage, set the following variables privately in the backend environment:

```dotenv
CMS_MEDIA_STORAGE=s3
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ENDPOINT=https://your-s3-endpoint
S3_PUBLIC_BASE_URL=https://your-public-media-domain
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

The bucket/public URL and access policy must be validated in a staging environment. This repository does not provision an object-storage account or verify a customer's storage ACLs.

## API documentation and Postman

- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/docs-json`
- Base API prefix: `/api/v1`
- Liveness: `GET /api/v1/health/live` (process only)
- Readiness: `GET /api/v1/health/ready` (PostgreSQL connectivity)
- Backward-compatible health: `GET /api/v1/health` (database readiness)
- Postman collection: [postman/Velzon-Admin-API.postman_collection.json](postman/Velzon-Admin-API.postman_collection.json)
- Postman environment: [postman/Velzon-Local.postman_environment.json](postman/Velzon-Local.postman_environment.json)
- Postman setup: [postman/README.md](postman/README.md)

The Postman collection calls the NestJS API directly with a Bearer token. This is separate from the browser flow, where the Next.js BFF keeps the access token in an HttpOnly cookie.

## Useful scripts

### Frontend (repository root)

To run the browser E2E suite locally, install its pinned runner and Chromium:

```powershell
npm install --no-save --package-lock=false --legacy-peer-deps @playwright/test@1.64.1
npx playwright install chromium
$env:E2E_BASE_URL = "http://localhost:3000"
npx playwright test
```

The browser suite expects the Next.js application and a disposable backend to be running.

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run type-check` | TypeScript validation |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run the configured Next.js lint command |
| `npm run format:check` | Check Prettier formatting |

Install uses `npm ci --legacy-peer-deps` because the current template dependency graph includes legacy peer relationships.

### Backend (from `backend/`)

| Command | Purpose |
|---|---|
| `npm run prisma:generate` | Generate Prisma Client |
| `npx prisma validate` | Validate the Prisma schema |
| `npm run prisma:deploy` | Apply checked-in migrations |
| `npm run prisma:seed` | Seed the first admin, locales and CMS permissions |
| `npm run type-check` | TypeScript validation |
| `npm test` | Run Jest unit tests |
| `npm run test:db-smoke` | Verify migrated database and seed invariants |
| `npm run build` | Generate Prisma Client and build NestJS |

## CI workflows

- **Frontend CMS CI** installs dependencies, runs TypeScript checking and the production build, then starts Next.js with a disposable local upstream. It exercises BFF authentication/session behavior, published-content Server Component rendering and Playwright Chromium browser journeys for signup, HttpOnly login, authenticated requests, logout, failed login and public CMS rendering.
- **Backend CI** validates/generates Prisma, applies all migrations to a PostgreSQL 16 service, seeds test data, runs database smoke checks, TypeScript, Jest, NestJS build/runtime smoke tests, health probes and HTTP-level authentication throttling checks.
- **CMS Frontend Lint** runs ESLint with the repository's Prettier rule on the newly added CMS User Management page. This is a targeted check, not a full-repository lint pass.
- **CMS Scheduled Jobs** calls the authenticated publication and webhook dispatcher endpoints on a five-minute schedule. GitHub-hosted scheduled execution can be delayed; it is not a precise real-time scheduler.

A passing CI run validates the tested commit and disposable CI environment only. It does not prove production provisioning, S3 persistence, backup restoration, browser accessibility, load capacity or customer-specific configuration.

## Internationalization

The dashboard has existing i18next dictionaries for Persian, English and additional template languages. CMS content locales are separately stored in PostgreSQL and include locale code and RTL/LTR direction. UI translation coverage is not yet complete across all legacy screens or every CMS empty/error/validation state. Do not assume that changing the dashboard UI language also creates or translates CMS content.

## Operational and security documentation

- [Enterprise architecture](docs/enterprise-cms-architecture.md)
- [Repository audit and findings](docs/enterprise-cms-audit.md)
- [Implementation status](docs/enterprise-cms-implementation-status.md)
- [Security model and limitations](docs/enterprise-cms-security.md)
- [Portfolio readiness hardening](docs/portfolio-readiness-hardening.md)
- [Deployment runbook](docs/enterprise-cms-deployment.md)
- [Backup and restore runbook](docs/enterprise-cms-backup-restore.md)
- [Administrator guide](docs/enterprise-cms-admin-guide.md)
- [Editor/user guide](docs/enterprise-cms-user-guide.md)
- [API reference and Postman guidance](docs/enterprise-cms-api.md)
- [Testing and release gates](docs/enterprise-cms-testing.md)
- [Release notes](docs/enterprise-cms-release-notes.md)

Existing detailed references: [CMS architecture](docs/cms-architecture.md), [CMS audit](docs/cms-audit.md), [CMS permissions](docs/cms-permissions.md), [implementation audit](docs/implementation-audit.md), [production readiness](docs/production-readiness.md), and [security and deployment](docs/security-and-deployment.md).

## Known limitations — do not market as completed

- Each 15-minute access token is bound to a PostgreSQL session and authenticated logout revokes that session. Refresh-token rotation and cross-device session management are not implemented. Expired and revoked sessions are also pruned daily at 03:00 UTC.
- Password reset, email verification, MFA and account recovery are not implemented in the current backend foundation.
- User management currently exposes administrator-only listing and updates; it is not a complete invitation, lifecycle and session-management product.
- Content owner/team-level authorization and reviewer assignment are not fully implemented.
- The page builder is a limited block editor, not a freeform visual builder.
- Public forms have server-side schema validation and throttling, but a complete configurable CAPTCHA/honeypot and privacy/retention workflow is not established.
- Webhook execution has retry records and destination checks; durable queue semantics, multi-instance coordination and full operational observability still need deployment-level verification.
- CMS audit entries record request-level outcomes, request IDs, client IP and HTTP status for authenticated CMS controller requests. Field-level before/after diffs, immutable retention and authentication failures outside those controllers remain incomplete.
- Legacy template modules outside the CMS are not all migrated away from fake/demo data.
- Focused Playwright Chromium E2E coverage exists for core portfolio journeys. Component-level visual regression, cross-browser/device matrix, accessibility, load/soak and external penetration testing remain incomplete.
- Automated production backup, media backup, restore rehearsal and disaster-recovery objectives are not delivered by this codebase.
- No staging deployment or customer production infrastructure is provisioned by this repository update.

## Commercial distribution

Before customer delivery, verify the applicable Velzon source-template license and the licenses/redistribution terms of all bundled fonts, icons, images and third-party packages. Do not rely on a repository badge or assume that a template license automatically permits resale of a derivative product.

## Contributing and safe release process

1. Start from the latest `main` and create a dedicated feature branch.
2. Protect any local uncommitted work before switching branches or updating.
3. Keep secrets and real customer data outside Git.
4. Use additive Prisma migrations and test them against a disposable/staging database.
5. Run frontend and backend CI on the exact proposed PR head.
6. Review the security, backup/restore, staging and release gates before approving a production release.
7. Merge and deploy only with explicit release approval.

**Current release status:** development in progress. No production deployment is performed by these instructions.

# Velzon Enterprise CMS

A self-hosted, multilingual content management system built on the existing Velzon Next.js dashboard and NestJS API. The target deployment model is one installation per customer organization. The current codebase is a CMS foundation with several working end-to-end modules; it is **not yet certified or demonstrated as a production-ready commercial release**.

## Product scope

The commercial navigation is focused on CMS administration. Template/demo modules remain in source control for potential future products, but are routed away from the commercial dashboard.

The CMS currently includes database-backed content, localized translations, dynamic content types and fields, publishing workflow, revision history, a first-generation block editor, media management, taxonomy, menus, redirects, public forms and submissions, webhooks, permission grants, audit logs, import/export, public rendering, SEO metadata and a sitemap.

The current installation is single-organization. Multi-tenancy is deliberately not imposed on the schema or runtime until there is a concrete business requirement.

## Technology

| Layer | Current project version / technology |
|---|---|
| Frontend | Next.js 15.5.28, React 19.2.7, TypeScript |
| UI | Bootstrap 5.3.6, Velzon components, Reactstrap |
| State | Redux Toolkit and Redux Persist |
| Localization | i18next and react-i18next; Persian and English dictionaries |
| Fonts | Local HK Grotesk and IRANSansWeb WOFF2 fonts |
| Backend | NestJS 10.4.15, TypeScript |
| ORM | Prisma 6.12.0 |
| Database | PostgreSQL 16+ |
| Authentication | bcrypt password hashing, JWT access token, Next.js BFF session |
| API | REST under `/api/v1`, Swagger at `/docs` |
| Media | Local development adapter and S3-compatible storage adapter |
| Automation | GitHub Actions, NestJS scheduled worker endpoints |

The existing framework and ORM have been retained. Versions above are taken from the repository manifests, not from a claim that every dependency is on its newest upstream release.

## CMS modules

| Module | What is present |
|---|---|
| Overview | Database-backed counts, workflow totals and recently updated content |
| Content | Create, list, edit, translate, submit, review, publish, schedule, unpublish, archive, restore |
| Content types | Configurable schemas and JSON-backed typed fields |
| Revisions | Revision records and restore operations; published snapshots are separated from draft edits |
| Page builder | Reorderable first-generation blocks: Hero, rich text, image, gallery, CTA, FAQ and card grid |
| Media | Upload validation, metadata, reference checks and local/S3 storage adapters |
| Taxonomy | Taxonomies, hierarchical terms, translations and content assignments |
| Menus | Localized navigation trees and public menu response |
| Redirects | Locale-aware redirect resolver with safe destination validation |
| Forms | Dynamic public form schema, server-side validation, submissions and status management |
| Webhooks | HMAC signatures, delivery history, retry records and public-HTTPS destination checks |
| Permissions | Predefined organization roles with database-backed action grants |
| Users | Database-backed user list, role updates and activation/deactivation controls |
| Audit | Management request and selected business events |
| Import/export | Versioned JSON packages; imported content is created as drafts |
| Public site | Published-only content route, localized metadata, alternates and sitemap |

See [the audit](docs/enterprise-cms-audit.md) and [implementation status](docs/enterprise-cms-implementation-status.md) for what is complete and what remains.

## Local development

### Prerequisites

- Node.js 20 or later (CI currently uses Node 20)
- npm
- PostgreSQL 16 or later
- Git

### 1. Configure PostgreSQL and backend

Create a local database, then copy the backend environment template:

**PowerShell**
```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and set at least:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — private random value of at least 32 characters
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the initial administrator used by the seed
- `PUBLIC_SITE_URL` — the public frontend origin for sitemap and canonical links

Install and prepare the backend:

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

The API listens on `http://localhost:3001` by default. Check `GET /api/v1/health`. Swagger is available at `http://localhost:3001/docs`.

### 2. Configure and run the frontend

In a second terminal, from the repository root:

```powershell
Copy-Item .env.example .env.local
npm ci --legacy-peer-deps
```

Set the local values in `.env.local`:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Velzon Enterprise CMS
```

Start Next.js:

```powershell
npm run dev
```

Open `http://localhost:3000`. The root route sends unauthenticated visitors to sign-in and authenticated sessions to `/apps-cms`.

The preferred API target is the server-only `BACKEND_API_URL`. Do not put secrets in a `NEXT_PUBLIC_*` variable. The `NEXT_PUBLIC_BACKEND_API_URL` value remains for compatibility with middleware redirect resolution.

## Authentication and security boundary

The browser signs in through the same-origin Next.js route `/backend-api/auth/login`. The BFF stores the backend access token in a host-only `velzon_session` cookie marked HttpOnly, SameSite=Lax and Path=/. The cookie is Secure in Production and its lifetime is capped at 15 minutes. Browser JavaScript does not receive the Bearer token. The BFF derives the backend Authorization header from that cookie and ignores browser-supplied Authorization headers.

Logout expires the server-managed cookie. A protected API 401 clears the cookie; a 403 is treated as an authorization failure and does not sign the user out. Unsafe BFF methods validate a supplied Origin header.

Security controls in the API include DTO validation, role/permission guards, rate limits on authentication and public form submissions, password hashing, upload signature/size checks, webhook signing and destination checks. These controls do not replace a security review or a deployment-specific threat assessment.

Read [Security](docs/enterprise-cms-security.md) and [Deployment](docs/enterprise-cms-deployment.md) before exposing the application to the Internet.

## Roles

The predefined role vocabulary is:

- SUPER_ADMIN
- ADMIN
- MANAGER
- CONTENT_MANAGER
- EDITOR
- AUTHOR
- REVIEWER
- MEDIA_MANAGER
- ANALYST
- READ_ONLY
- USER

Permission grants are stored in the database and can be configured for non-administrator roles. SUPER_ADMIN and ADMIN retain administrator-level access. These are predefined roles, not arbitrary customer-created role definitions.

## Scripts and verification

Frontend (repository root):

```powershell
npm run type-check
npm run lint
npm run build
```

Backend (from `backend/`):

```powershell
npm run prisma:generate
npm run type-check
npm test
npm run test:db-smoke
npm run build
```

`test:db-smoke` requires a migrated and seeded test database. Do not point test or migration-smoke commands at Production.

GitHub Actions:

- [Frontend CMS CI](.github/workflows/frontend-ci.yml) installs dependencies, runs TypeScript checking, creates a Production build and starts it against a disposable local mock API to test route scope and the BFF session lifecycle.
- [Backend CI](.github/workflows/backend-ci.yml) provisions PostgreSQL 16, applies migrations, seeds data, validates Prisma, runs the database smoke test, TypeScript checking, unit tests, Nest build and API runtime smoke tests.

The frontend currently has no dedicated component-test or Playwright E2E suite. CI smoke tests do not prove every user workflow works against a deployed environment. The exact release commit must have passing CI before release.

## Postman and API documentation

- Collection: [postman/Velzon-Admin-API.postman_collection.json](postman/Velzon-Admin-API.postman_collection.json)
- Local environment: [postman/Velzon-Local.postman_environment.json](postman/Velzon-Local.postman_environment.json)
- Staging environment template: [postman/Velzon-Staging.postman_environment.json](postman/Velzon-Staging.postman_environment.json)
- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/docs-json`

The checked-in collection contains 122 nested requests/groups. Verify it against the deployed Swagger document after any API change; the collection is a test aid, not a guarantee that every workflow is end-to-end complete.

## Known limitations before a commercial launch

The following are deliberately not described as complete:

1. Password reset, invitation/email verification, MFA, refresh-token rotation and server-side session revocation are not implemented.
2. User administration currently covers listing, role changes and account activation. It does not yet provide invite/create-user workflows or credential recovery.
3. Content ownership/team-level authorization and thorough cross-user IDOR tests remain open.
4. Page Builder is a first-generation structured block editor, not a full visual drag-and-drop website designer. Arbitrary Custom HTML/JavaScript is not enabled.
5. The content field enum does not currently provide every field named in the product vision (for example dedicated PHONE, RADIO and CHECKBOX types). Dynamic JSON-backed schemas should be extended only with matching DTO, persistence, editor, renderer and tests.
6. Public forms have server validation and throttling, but CAPTCHA/honeypot and richer spam controls are not implemented.
7. Webhook and scheduled-publish workers run in-process. Serverless deployments require an external scheduler; a durable distributed queue/lease strategy must be verified for multi-instance deployments.
8. Media persistence in Production requires S3-compatible storage or a persistent volume. A serverless ephemeral filesystem is not supported as durable storage.
9. Import/export packages structured JSON records; media binaries are not embedded. Imports create drafts and can report partial failures.
10. The current frontend CI is not a substitute for component tests, browser E2E, accessibility, load, penetration, backup/restore or staging deployment tests.
11. Production database, storage, monitoring, SMTP, scheduler, backups and disaster recovery have not been provisioned or tested by this repository change.
12. Confirm the commercial redistribution rights for the Velzon template, fonts, icons and all third-party assets before selling or distributing a customer installation. No license is asserted by this repository README.

## Product documentation

- [Architecture](docs/enterprise-cms-architecture.md)
- [Audit](docs/enterprise-cms-audit.md)
- [Implementation status](docs/enterprise-cms-implementation-status.md)
- [Security](docs/enterprise-cms-security.md)
- [Deployment](docs/enterprise-cms-deployment.md)
- [Backup and restore](docs/enterprise-cms-backup-restore.md)
- [User guide](docs/enterprise-cms-user-guide.md)
- [Administrator guide](docs/enterprise-cms-admin-guide.md)
- [API guide](docs/enterprise-cms-api.md)
- [Testing guide](docs/enterprise-cms-testing.md)
- [Release notes](docs/enterprise-cms-release-notes.md)

## Release status

This repository is under active hardening. A successful build or CI run is not, by itself, a Production Ready certification. Do not deploy this branch to a customer environment until the release gates in the documentation are satisfied.

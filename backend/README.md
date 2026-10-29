# Velzon Admin API and CMS

This repository contains the NestJS + Prisma/PostgreSQL backend and a Next.js dashboard. CMS-specific screens use the database-backed API. The original template also contains legacy e-commerce, CRM, project/task and demo screens; those are not all converted from Fake Backend in this increment.

## Requirements

- Node.js 20 or later
- PostgreSQL
- npm

## Local setup

1. Copy backend/.env.example to backend/.env.
2. Set DATABASE_URL and a random JWT_SECRET with at least 32 characters.
3. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD; the seed requires a password of at least 12 characters.
4. Set PUBLIC_SITE_URL to the local or production frontend origin for absolute sitemap/hreflang links.
5. From the backend directory run npm install, then npm run prisma:generate.
6. Run npm run prisma:deploy to apply the checked-in migrations.
7. Run npm run prisma:seed to create the administrator, locales, starter Page/Article content types and default CMS role grants.
8. Run npm run start:dev.

The API base URL is http://localhost:3001/api/v1. Swagger is at http://localhost:3001/docs. Health check: GET /api/v1/health.

## Real CMS login from the dashboard

Set these values in the root Next.js environment, restart Next.js and sign in with the administrator seeded above:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The template's fake authentication remains the default until explicitly changed.

## Authentication and security

- POST /api/v1/auth/register creates a standard USER and does not accept a client-supplied role.
- POST /api/v1/auth/login returns a short-lived 15-minute Bearer access token.
- GET /api/v1/auth/me returns the current authenticated user.
- CMS management requests require a Bearer token. The server-side CMS permission guard checks action-level grants; ADMIN bypasses grants.
- Use HTTPS and private secrets in deployment. Never commit .env files, database credentials or webhook secrets.
- Public form submissions are throttled and schema-validated. Webhook deliveries use HMAC-SHA256 and restrict destination addresses to public HTTPS hosts.
- Rich-text and Markdown from authors are rendered as text by the included public renderer. Do not inject raw HTML unless a reviewed allowlist sanitizer is added.

Password reset, email verification and refresh-token rotation are not part of this first backend foundation.

## Existing business API resources

- Dashboard: GET /api/v1/dashboard/summary
- Categories: GET/POST /api/v1/categories
- Products: GET /api/v1/products, GET /api/v1/products/:id, POST, PATCH /api/v1/products/:id, DELETE /api/v1/products/:id (archives)
- Customers: GET /api/v1/customers, GET /api/v1/customers/:id, POST, PATCH /api/v1/customers/:id, DELETE /api/v1/customers/:id (archives)
- Leads: GET, POST, PATCH /api/v1/leads/:id, DELETE /api/v1/leads/:id
- Projects: GET, GET /api/v1/projects/:id, POST, PATCH /api/v1/projects/:id, DELETE /api/v1/projects/:id
- Tasks: GET, GET /api/v1/tasks/:id, POST, PATCH /api/v1/tasks/:id, DELETE /api/v1/tasks/:id
- Tickets: GET, GET /api/v1/tickets/:id, POST, PATCH /api/v1/tickets/:id, DELETE /api/v1/tickets/:id
- Orders: GET, GET /api/v1/orders/:id, POST /api/v1/orders, PATCH /api/v1/orders/:id/status
- Users: GET /api/v1/users and PATCH /api/v1/users/:id (admin only)

List endpoints support page/limit (up to 100) and search. Order totals are computed on the server from decimal database values; order creation and stock decrement happen transactionally.

## CMS management API

Administrative routes below /api/v1/cms require a JWT and the configured action permission.

- Locales: GET/POST /cms/locales, PATCH /cms/locales/:id.
- Content types and dynamic fields: GET/POST/PATCH /cms/content-types and POST/PATCH /cms/content-types/:id/fields.
- Content and translations: GET/POST /cms/contents, GET /cms/contents/:id, POST /cms/contents/:id/translations, PATCH /cms/contents/:id/translations/:localeCode, and PATCH /cms/contents/:id/shared-fields.
- Workflow: submit, publish, reject, schedule, unpublish, archive and restore-to-draft actions under /cms/contents/:id/translations/:localeCode.
- Revisions: list versions and restore a selected revision.
- Taxonomies and term translations: /cms/taxonomies, /cms/taxonomies/:id/terms, /cms/taxonomy-terms/:termId/translations, and PUT /cms/contents/:id/terms.
- Menus: /cms/menus and nested /cms/menus/:id/items.
- Redirects: /cms/redirects and /cms/redirects/resolve.
- Forms: /cms/forms and nested submissions.
- Webhooks: /cms/webhooks and nested delivery history/retry.
- Media: GET/POST /cms/media, PATCH/DELETE /cms/media/:id.
- Access policy and audit: /cms/permissions and /cms/audit-logs.
- Import/export: GET /cms/import-export/export?limit=5000 and POST /cms/import-export/import.

Public read paths do not require a token and expose only published snapshots:

- Content detail/list: /api/v1/public/cms/:typeKey/:localeCode/:slug and /api/v1/public/cms/:typeKey/:localeCode.
- Localized menus: /api/v1/public/cms/menus/:key/:localeCode.
- Public form schema/submission: /api/v1/public/cms/forms/:key and POST /api/v1/public/cms/forms/:key/submissions.
- Redirect resolution: /api/v1/public/cms/redirects/resolve.
- Sitemap JSON/XML: /api/v1/public/cms/sitemap and /api/v1/public/cms/sitemap.xml.

## Media storage configuration

Default storage is local. In local development the backend stores files under UPLOAD_DIR/media and serves local asset paths under /uploads/media. On serverless or ephemeral filesystems, local uploads may disappear between invocations; mount persistent storage or use S3-compatible storage.

To enable S3-compatible storage, configure all required values privately:

```dotenv
CMS_MEDIA_STORAGE=s3
S3_BUCKET=your-private-bucket-name
S3_REGION=us-east-1
S3_PUBLIC_BASE_URL=https://cdn.example.com
# Optional for compatible providers such as MinIO:
S3_ENDPOINT=https://s3.example.com
S3_FORCE_PATH_STYLE=false
# Set both credentials together, or omit both when the runtime has an identity/role:
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

S3_PUBLIC_BASE_URL should be the public base that serves the objects saved under the media/ prefix. Do not put production credentials in source control. The local and S3 storage adapters validate generated object keys; CDN/bucket policies and access permissions must still be configured for the chosen deployment.

## Published website, SEO and transfer limitations

- Published entries render at /content/:typeKey/:localeCode/:slug with locale direction, SEO metadata and alternate-language links.
- The seed creates an editable `main` navigation menu for `fa-IR` and `en-US`. Add menu items in the CMS menu editor to display localized navigation on public content pages; the page renderer handles a disabled or missing menu.
- Set NEXT_PUBLIC_SITE_URL in the frontend environment and PUBLIC_SITE_URL in the backend environment to the canonical public origin. Active redirect rules are also checked by middleware for public GET/HEAD requests; unavailable CMS services fail open and do not block the page. Set NEXT_PUBLIC_SITE_NAME for the public navigation brand. Next.js exposes /sitemap.xml; the backend also has JSON/XML sitemap endpoints.
- The page builder's first version supports hero, text/Markdown, image, gallery, CTA, FAQ and card-grid blocks; it is not a universal freeform drag/drop builder.
- JSON import/export is versioned, bounded and returns per-record results. Imports create drafts. Media binaries are not embedded in packages, so referenced media must already be available on the destination.
- The scheduled publisher and webhook dispatcher use in-process cron workers. Production serverless needs an external durable scheduler/worker.
- The CMS screens are wired to real backend APIs. The legacy e-commerce/CRM/project/task/demo screens are not all migrated away from Fake Backend.
- Production DB provisioning, environment secret setup, persistent storage validation, deployed login/content smoke tests, E2E/browser coverage, accessibility QA and backup/restore drills must be performed before a production launch.

See docs/implementation-progress.md and docs/cms-audit.md for the current implementation ledger and verification state.


## Security and production launch

See [docs/security-and-deployment.md](../docs/security-and-deployment.md) for the pre-production environment, dependency, migration, storage, security and smoke-test checklist. This branch has not itself provisioned or exercised a production environment.


## Production release checks

Before deploying, provision PostgreSQL with backups and TLS, configure a persistent S3-compatible media store for serverless hosting, and set production secrets through the hosting provider rather than committing them. Set CORS_ORIGINS to the exact public frontend origin, PUBLIC_SITE_URL and NEXT_PUBLIC_SITE_URL to the canonical public origin, NEXT_PUBLIC_SITE_NAME for the site brand, and NEXT_PUBLIC_DEFAULT_AUTH=backend.

Apply migrations with npm run prisma:deploy only after a database backup. Run npm run prisma:seed with a dedicated administrator email; the seed refuses to promote an existing non-admin user and does not rotate an existing administrator password. Configure a strong CMS_JOB_TOKEN if scheduled publishing or webhook dispatch uses serverless hosting.

For serverless deployments, configure an external scheduler to POST /api/v1/internal/cms/jobs/publish-scheduled and /api/v1/internal/cms/jobs/dispatch-webhooks every minute, using Authorization: Bearer <CMS_JOB_TOKEN> stored only in the scheduler's secrets.

The CMS-specific pages are wired to the real API. The legacy e-commerce, CRM, project/task and demo screens are not all migrated from Fake Backend. Before calling the product production-ready, run the release smoke tests in docs/production-readiness.md and verify role permissions, public publishing, storage persistence, redirects, form throttling, webhook signatures, accessibility, and backup/restore.

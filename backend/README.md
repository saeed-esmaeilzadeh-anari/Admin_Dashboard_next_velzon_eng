# Velzon Admin API

This is a new NestJS REST API alongside the existing Next.js dashboard. The legacy UI still contains demo data and Fake Backend imports; not every existing page is wired to this API yet.

## Requirements

- Node.js 20 or later
- PostgreSQL
- npm

## Local setup

1. Copy backend/.env.example to backend/.env.
2. Set DATABASE_URL and a JWT_SECRET of at least 32 characters.
3. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD for the initial administrator.
4. From the backend directory run npm install, then npm run prisma:generate.
5. Run npm run prisma:deploy to apply the checked-in migration.
6. Run npm run prisma:seed to create the administrator and general category.
7. Run npm run start:dev.

The API base URL is http://localhost:3001/api/v1. Swagger is at http://localhost:3001/docs. The health check is GET /api/v1/health.

## Authentication

- POST /api/v1/auth/register creates a standard USER and does not accept a client-supplied role.
- POST /api/v1/auth/login returns a short-lived 15-minute Bearer access token.
- GET /api/v1/auth/me returns the authenticated user.
- Protected calls need Authorization: Bearer <accessToken>.

This first slice does not yet include refresh-token rotation, password reset or email verification. Use HTTPS and a private strong JWT_SECRET in deployment. Never commit .env files or live credentials.

## API resources

- Dashboard: GET /api/v1/dashboard/summary
- Categories: GET and POST /api/v1/categories
- Products: GET /api/v1/products, GET /api/v1/products/:id, POST, PATCH /api/v1/products/:id, DELETE /api/v1/products/:id (archives)
- Customers: GET /api/v1/customers, GET /api/v1/customers/:id, POST, PATCH /api/v1/customers/:id, DELETE /api/v1/customers/:id (archives)
- Leads: GET, POST, PATCH /api/v1/leads/:id, DELETE /api/v1/leads/:id
- Projects: GET, GET /api/v1/projects/:id, POST, PATCH /api/v1/projects/:id, DELETE /api/v1/projects/:id
- Tasks: GET, GET /api/v1/tasks/:id, POST, PATCH /api/v1/tasks/:id, DELETE /api/v1/tasks/:id
- Tickets: GET, GET /api/v1/tickets/:id, POST, PATCH /api/v1/tickets/:id, DELETE /api/v1/tickets/:id
- Orders: GET, GET /api/v1/orders/:id, POST /api/v1/orders, PATCH /api/v1/orders/:id/status
- Users: GET /api/v1/users and PATCH /api/v1/users/:id (admin only)

List endpoints support page, limit (up to 100) and search. Responses include data and pagination metadata. Order totals are computed by the server using decimal database values; tax is a fixed monetary amount, not a percentage. Order creation and stock decrement occur in one transaction.

## Current limitations

The initial backend is not a claim that all legacy pages are production-ready. Page-by-page UI integration, tests, rate limiting, password reset, refresh-token rotation, detailed audit writes, uploads, notifications, jobs/invoices/chat/mail modules and deployment infrastructure remain to be implemented. Check docs/implementation-progress.md before treating the system as complete.


## CMS endpoints

The branch contains a multilingual CMS core under `/api/v1/cms`. Administrative routes require a valid Bearer token.

- Locale metadata: `GET/POST /cms/locales`, `PATCH /cms/locales/:id`.
- Content types: `GET/POST /cms/content-types`, `PATCH /cms/content-types/:id`.
- Dynamic fields: `POST /cms/content-types/:id/fields`, `PATCH /cms/content-types/:id/fields/:fieldId`.
- Content: `GET /cms/contents`, `GET /cms/contents/:id`, `POST /cms/contents`.
- Translation: `POST /cms/contents/:id/translations`, `PATCH /cms/contents/:id/translations/:localeCode`.
- Shared fields: `PATCH /cms/contents/:id/shared-fields`.
- Editorial actions: `POST /cms/contents/:id/translations/:localeCode/submit|publish|reject|schedule|unpublish|archive|restore-to-draft`.
- Revisions: `GET /cms/contents/:id/translations/:localeCode/revisions` and restore endpoint below the same route.
- Public delivery returns published snapshots only: `GET /public/cms/:typeKey/:localeCode` and `GET /public/cms/:typeKey/:localeCode/:slug`.

Dynamic fields are initially backed by JSON and server-side schema validation. Supported types include text/textarea, rich text, Markdown, integer/decimal, boolean, date/datetime, select/multi-select, email, URL and JSON. Media, relation and repeater fields are not yet implemented.

## Connecting the dashboard to real CMS authentication

For a local run, start PostgreSQL and the API as above. In the Next.js environment set:

```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
```

Then restart Next.js, sign in with the administrator created from `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and open `/apps-cms/content`. The template's `fake` login remains the default until this variable is explicitly changed.

## CMS boundaries

This increment wires the CMS-specific screens to real API endpoints; it does not replace the legacy mock backend of every e-commerce/CRM/task/template screen. Fine-grained permissions, media storage, taxonomies, menus, page-builder blocks, redirects/sitemap/hreflang, rich-text sanitization and durable serverless scheduling remain required before a production launch.


### Published website and SEO

- The frontend renders published CMS entries at `/content/:typeKey/:localeCode/:slug` and reads only the public published snapshot API.
- The API sitemap is `GET /api/v1/public/cms/sitemap.xml`; the frontend also exposes it at `/sitemap.xml`.
- Set `PUBLIC_SITE_URL` to the canonical website URL (for example `https://www.example.com`) before deployment. The sitemap includes active published translations and language alternate links.
- Public rich text is presented as text instead of injecting author-provided HTML. For rich formatting, replace that renderer with a maintained HTML sanitizer and a reviewed allowlist before allowing raw HTML.

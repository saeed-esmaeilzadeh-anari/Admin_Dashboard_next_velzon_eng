# Velzon Enterprise CMS — Architecture

## Product deployment boundary

The current product target is one independently installed CMS per customer organization. PostgreSQL data and object storage are dedicated to that installation. There is no shared-tenant ID or cross-tenant authorization model in this release. SaaS multi-tenancy is a future design exercise, not an implicit capability.

## Runtime components

### Next.js frontend

- Next.js 15 App Router with React 19 and TypeScript.
- The `(with-layout)/apps-cms` route group contains authenticated CMS management pages.
- Public content routes are rendered at `/content/:typeKey/:localeCode/:slug`.
- `src/helpers/cmsApi.ts` is the CMS API contract/client.
- Browser requests use `src/helpers/backendApi.ts` and the same-origin `/backend-api/*` BFF.
- The BFF stores the short-lived backend token in an HttpOnly cookie and forwards it as a Bearer token on the server.
- Public CMS reads invoked from Server Components use the private `BACKEND_API_URL` absolute URL; browser public reads still use the same-origin BFF.

### NestJS API

- Global prefix: `/api/v1`.
- Swagger UI: `/docs`; OpenAPI JSON: `/docs-json`.
- Global DTO ValidationPipe enables transform, whitelist and forbidNonWhitelisted.
- Prisma errors have a global exception filter.
- Helmet and CORS origin allowlisting are configured in `backend/src/main.ts`.
- Auth validates user active state and JWT. CMS permissions are checked in `CmsPermissionsGuard`.

### Persistence

PostgreSQL is the authoritative store. Prisma schema/migrations define users, CMS definitions, localized content, revisions/publication snapshots, media metadata, taxonomies, menus, redirects, forms/submissions, webhooks/deliveries, permissions and audit rows.

Schema changes must be additive and migrated with checked-in SQL migrations. Production deploys use `prisma migrate deploy`, never `prisma db push`.

### Media storage

- Local adapter: development and persistent single-server deployments.
- S3-compatible adapter: recommended for serverless and horizontally scaled installations.
- The database stores metadata and storage keys; the storage adapter owns binary persistence.
- The local filesystem is not assumed durable on serverless hosts.

### Scheduled work

- Always-on Node.js deployment: NestJS minute scheduler.
- Serverless deployment: call the token-protected internal job endpoints through an external scheduler.
- Checked-in GitHub Actions workflow calls publication and webhook dispatch every five minutes when `CMS_API_BASE_URL` and `CMS_JOB_TOKEN` secrets are configured. GitHub schedules can be delayed and are not exact-time schedulers.

## CMS data flow

1. An administrator authenticates through the Next.js BFF.
2. The BFF stores the 15-minute JWT in an HttpOnly cookie and returns a user profile only.
3. Browser API calls remain same-origin and are forwarded by the BFF.
4. NestJS validates the JWT and reads the active user from PostgreSQL.
5. CMS controllers require action-level permission codes; ADMIN has an explicit bypass.
6. Content changes are stored as draft/revision/translation records.
7. Review, publish, schedule, unpublish and archive actions are validated in the backend service.
8. Public content endpoints return published localized snapshots only.
9. The public Next.js route obtains the published item, locale alternates and public menu and renders the page.

## Localization

There are two separate localization concerns:
- UI localization via i18next dictionaries in `src/components/Common/locales`.
- Content localization via the database Locale, translation and localized slug records.

The CMS seed creates Persian and English locales. UI dictionaries include additional template languages. UI translation coverage is not yet complete for every screen/state.

## Authorization model

The current roles are installation-level roles from the Prisma Role enum: ADMIN, MANAGER and USER. CMS permission grants map these roles to action codes. The current model is not a complete user-defined role engine and does not implement content ownership/team or reviewer assignment scoping.

## Boundaries and deliberate non-goals

- No SaaS tenancy in the independent-install release.
- No full-featured email/notification subsystem.
- No refresh-token/session-revocation service.
- No unrestricted custom HTML/script renderer.
- No universal drag/drop page designer; the current builder is a bounded block renderer.
- Legacy Velzon demo modules are not part of the CMS release scope.

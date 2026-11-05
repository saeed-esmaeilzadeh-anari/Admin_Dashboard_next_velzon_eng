# Enterprise CMS — API Reference

## Source of truth

The NestJS controllers, DTOs and Swagger document are the authoritative API definition. This guide groups the implemented route areas; use `GET /docs-json` from the deployed API for exact request/response schemas and current method definitions.

Base URL in local development: `http://localhost:3001/api/v1`.

Swagger UI: `/docs`. OpenAPI JSON: `/docs-json`.

## Authentication

- `POST /auth/register`: creates a standard USER account and returns `{ user }`; it does not sign the user in or issue a token. Client-supplied roles are not accepted.
- `POST /auth/login`: creates a persisted 15-minute AuthSession and returns a Bearer access token and user profile.
- `POST /auth/logout`: requires the current Bearer token and revokes only the matching server-side session.
- `GET /auth/me`: requires a valid, unexpired and unrevoked session-bound Bearer token; its response does not expose the internal session ID.

Browser CMS calls use the Next.js same-origin BFF under `/backend-api/*`. The BFF stores the access token in an HttpOnly cookie and forwards Authorization server-side. Postman calls the backend API directly and can keep the token in a local Postman environment; do not use that pattern for browser storage.

## Core CMS routes

The following groups are implemented under `/api/v1`:

| Area | Controller route group |
|---|---|
| CMS dashboard/content | `/cms/dashboard/summary`, `/cms/contents` |
| Locales | `/cms/locales` |
| Content types/fields | `/cms/content-types` |
| Content translations/workflow | `/cms/contents/:id/translations/:localeCode/*` |
| Revision history | nested content revision/version operations |
| Taxonomies/terms | `/cms/taxonomies`, `/cms/taxonomy-terms` |
| Menu management | `/cms/menus` |
| Redirect management | `/cms/redirects` |
| Forms/submissions | `/cms/forms` |
| Webhooks/deliveries | `/cms/webhooks` |
| Media | `/cms/media` |
| Permissions | `/cms/permissions` |
| Audit | `/cms/audit-logs` |
| Import/export | `/cms/import-export` |

Administrative CMS controllers require JWT authentication and action-level CMS permission grants. ADMIN is explicitly allowed by the CMS permission guard. The route summary is not a substitute for Swagger DTO definitions.

## Administrator user management

The UsersController is protected by `JwtAuthGuard`, `RolesGuard` and `@Roles(Role.ADMIN)`:
- `GET /api/v1/users?page=1&limit=20&search=`: returns a server-paginated user list and `meta`.
- `PATCH /api/v1/users/:id`: updates supported `name`, `role` or `isActive` fields.

The current Prisma roles are `ADMIN`, `MANAGER` and `USER`. The update service prevents an administrator from changing their own role/deactivating their own account and prevents removal of the final active ADMIN. These checks run inside a serializable transaction. There is no user invite/create, password reset, email verification or MFA endpoint in this release.

## Public routes

- `GET /public/cms/sitemap`
- `GET /public/cms/sitemap.xml`
- `GET /public/cms/:typeKey/:localeCode`
- `GET /public/cms/:typeKey/:localeCode/:slug`
- `GET /public/cms/menus/:key/:localeCode`
- `GET /public/cms/forms/:key`
- `POST /public/cms/forms/:key/submissions`
- `GET /public/cms/redirects/resolve`

Public content endpoints are intended to return published content only. Public form submissions are schema-validated and throttled. Do not place private user/submission information in public payloads.

## Internal jobs

- `POST /internal/cms/jobs/publish-scheduled`
- `POST /internal/cms/jobs/dispatch-webhooks`

These require `Authorization: Bearer <CMS_JOB_TOKEN>`; keep the token only in backend/scheduler secrets.

## Conventions and constraints

- Global prefix is `/api/v1`.
- DTO whitelist and forbidden unknown properties are enabled globally.
- List endpoints generally use bounded page/limit parameters; inspect the individual DTO/controller for exact bounds and filters.
- UUID route parameters use Nest ParseUUIDPipe where applied.
- Content field validation is dynamic and based on the persisted content type schema.
- Import/export uses a versioned bounded JSON package; media binaries are not embedded.
- Webhook destinations are restricted to HTTPS DNS hostnames with public-address checks.

## Postman

Import:
- `postman/Velzon-Admin-API.postman_collection.json`
- `postman/Velzon-Local.postman_environment.json`

The collection contains backend API request examples and login scripts. Use real IDs returned by prior requests. Do not use fabricated IDs or run destructive requests against production.

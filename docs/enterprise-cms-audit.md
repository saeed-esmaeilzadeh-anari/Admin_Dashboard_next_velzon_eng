# Enterprise CMS Repository Audit

Audit date: 2026-11-05
Repository: `saeed-esmaeilzadeh-anari/Admin_Dashboard_next_velzon_eng`
Default branch baseline: `main@5ef8f23a390342703fec773a42d3be39ba4bec5b`
Working branch: `feat/enterprise-cms-production-v2`

## 1. Repository and technology baseline

| Area | Verified repository state |
|---|---|
| Frontend | Next.js 15.5.28, React/React DOM 19.2.7, TypeScript 5.x |
| UI | Bootstrap 5.3.6, Reactstrap, existing Velzon component/layout library |
| State | Redux Toolkit 2.8.2, redux-persist |
| UI internationalization | i18next 25.2.0, react-i18next 15.5.2; existing en/fa/ar/fr/gr/it/ru/sp/ch dictionaries |
| Backend | NestJS 10, TypeScript |
| ORM | Prisma 6.12.0 |
| Database | PostgreSQL; CI uses PostgreSQL 16 |
| API | REST, global prefix `/api/v1`, Swagger at `/docs` |
| Authentication | JWT Bearer at NestJS; Next.js BFF with HttpOnly session cookie for browser requests |
| Storage | Local development storage and S3-compatible adapter |
| Scheduler | NestJS in-process jobs plus authenticated external job endpoints |
| API collection | `postman/Velzon-Admin-API.postman_collection.json` and local environment |

## 2. Implemented CMS surface found in the repository

### Frontend pages

The App Router contains CMS pages for:
- CMS overview and content list;
- content creation, editing, translation and preview;
- content types and fields;
- languages/locales;
- media;
- taxonomies;
- menus;
- redirects;
- forms/submissions;
- webhooks;
- import/export;
- CMS permissions;
- audit logs.

Public routes include localized content pages under `/content/:typeKey/:localeCode/:slug`, `/sitemap.xml` and `/robots.txt`.

### Backend modules and data areas

The NestJS application includes Auth, Users, Business, CMS, Prisma and Health modules. CMS controllers cover content, public content, content administration, public menus/forms, media and internal jobs.

The Prisma schema and migrations include users/roles, locales, content types/fields, content, translations, revisions/publication snapshots, media, taxonomies/terms, menus, redirects, forms/submissions, webhooks/deliveries, role-permission grants and audit records.

### Existing real behaviors

- Content and translations are persisted with Prisma.
- Backend DTO validation uses a global ValidationPipe with whitelist and rejection of unknown properties.
- CMS actions use a server-side CMS permission guard; ADMIN bypasses role grants.
- Published pages are loaded from public CMS endpoints; draft records are not intended to be exposed through public content controllers.
- Media upload validates a declared MIME against an allowlist and checks supported file signatures.
- Media deletion checks current content, published snapshots and historical revisions for references.
- Webhook requests use HMAC-SHA256, HTTPS-only endpoints, DNS checks and pinned resolved addresses.
- Scheduled publication and webhook dispatch have internal token-protected endpoints.
- The browser BFF keeps the backend token in an HttpOnly cookie and adds the Bearer header server-side.

## 3. Gaps and release risks

| Priority | Finding | Current disposition |
|---|---|---|
| High | Public content Server Components used an Axios client with a relative `/backend-api` base URL, which is not an absolute URL in the Node.js server runtime | Fixed in this branch with server-side public API reads; CI server-render smoke test added and must pass |
| High | An administrator could demote/deactivate their own account or remove the last active ADMIN | Fixed in this branch with actor-aware checks and a serializable transaction; unit tests added and must pass |
| Medium | Webhook destination classification omitted certain reserved IPv4/IPv6 ranges | Fixed in this branch; tests added for 192.88.99.0/24, ORCHIDv2 and 3fff::/20 |
| Medium | CMS audit interceptor records request-level method/route/role but does not provide full before/after field history, IP/request correlation or failed security-event coverage | Partially implemented; broader audit model and tests remain |
| High | No content owner/team-level authorization or reviewer assignment boundary | Not implemented; existing permissions are role/grant based |
| High | Refresh-token rotation, persistent session revocation, password reset, email verification and MFA are absent | Not implemented |
| High | Legacy e-commerce/CRM/projects/tasks/tickets and demo pages are not all migrated from fake/template data | Not implemented outside CMS scope |
| Medium | Public forms have server-side schema validation and throttling, but configurable CAPTCHA/honeypot, retention and privacy workflows are incomplete | Partially implemented |
| Medium | Webhook delivery is persisted and retried, but durable queue infrastructure and cross-instance operational coordination require deployment validation | Partially implemented |
| High | No end-to-end browser suite, frontend component tests, accessibility audit, load test or penetration test was present in the baseline repository | Not yet complete; current CI covers type-check/build/BFF smoke plus backend tests |
| High | Production storage, backup automation, restore rehearsal, monitoring and incident response have not been verified | Not verified / operational work required |
| Medium | White-label organization settings, email notifications and notification center have no complete backend modules/API/UI in the audited tree | Not implemented |
| Low | Root README version badges and product description were stale relative to package.json | Updated in this branch |

## 4. Fake/demo boundary

The CMS pages listed above use the database-backed `cmsApi` helper. The repository also retains many original Velzon template screens and mock helpers. Those screens are not certified as real business functions.

In backend auth mode, the commercial navigation now exposes the CMS Dashboard, CMS section and Profile entry. This hides the demo catalogue from the primary navigation; it does not delete the source routes or make those routes part of the product acceptance scope.

## 5. Tests and CI

Backend CI runs Prisma validation/generation, migrations on PostgreSQL 16, migration status, seed, database smoke validation, TypeScript, Jest, Nest build and API runtime/auth smoke.

The frontend package has TypeScript and build scripts but no frontend `test` script in the audited package.json. No Playwright/Cypress/Vitest component/E2E suite was found in the audited tree. Frontend CI runs TypeScript, production build and BFF production-server smoke tests; this branch adds a public CMS Server Component smoke test.

The backend suite contains unit specs for CMS services, media references, permissions, audit interceptor, job controller and webhook safety, with user-account safety tests added in this branch.

## 6. Changes introduced by this branch

- Server-rendered public content and menu reads use an absolute server-side backend URL; browser calls remain same-origin through the BFF.
- Frontend CI includes a public published-content page rendering test against a disposable mock API.
- Administrator updates cannot change the acting administrator's own role/account activation or remove the last active administrator. Checks execute in a serializable database transaction.
- Added unit tests for self-lockout, last-admin protections and non-admin updates.
- Webhook SSRF destination checks now reject reserved/deprecated IPv4 and IPv6 ranges covered by new tests.
- In backend auth mode, the navigation presents the CMS product surface rather than the full template/demo catalogue.
- Rewrote the root README with actual package versions, working local setup commands and explicit release limitations.

## 7. Release decision

**Not Production Ready.** The branch must pass both CI workflows on its exact final HEAD. The remaining high-priority security, authorization, account lifecycle, operational recovery, browser E2E, accessibility, performance and staging gates must be completed and evidenced before commercial launch. No production deployment or merge is performed by this branch.

# Full-stack implementation progress

## Added to branch feat/full-stack-foundation

- [x] Inspected repository metadata, branch head, package manifest, API helper, auth configuration and environment example.
- [x] Confirmed the legacy helper imports mock behavior unconditionally.
- [x] Added a NestJS REST API project under backend.
- [x] Added Prisma/PostgreSQL models and an initial migration for users, categories, products, customers, orders/order items, CRM leads, projects/tasks, tickets and audit logs.
- [x] Added administrator seed using environment values; no default password is committed.
- [x] Added JWT authentication, public registration restricted to USER, current-user endpoint and admin user management.
- [x] Added DTO validation, CORS allow-list, Helmet and Swagger.
- [x] Added dashboard summary and endpoints for products/categories, customers, leads, projects, tasks, tickets and orders.
- [x] Added transactional order creation, server-side price calculation and atomic stock decrements.
- [x] Added initial implementation audit, data dictionary and relationship documentation.
- [ ] Frontend page-by-page integration with the new endpoints.
- [x] Backend CI: Prisma validation/generation, TypeScript check, unit tests and build have passed for the CMS core.\n- [ ] Frontend production type-check/build is still pending on the latest branch tip.
- [ ] Password reset/email verification, refresh-token rotation, rate limiting, detailed audit writes and file storage.
- [ ] Add jobs, invoices, messaging, file manager, settings and other workflows after analyzing their source forms.
- [ ] Deployment and production database provisioning.

## Verification status

The repository was changed through GitHub's API because a local clone was not possible in this environment. Do not treat the source edits alone as proof of a successful build. Backend CI has subsequently passed (see the dated CMS increment below); the latest frontend CI needs its final type-check/build result before the PR is considered verified.


## Multilingual CMS core and management UI — 2026-10-28

### Implemented on this feature branch

- [x] Added versioned migration and Prisma models for locales, content types, dynamic fields, stable content identities, per-locale translations, publication snapshots and revision history.
- [x] Seeded `fa-IR` as default RTL locale and `en-US` as LTR, plus starter `page` and `article` content types.
- [x] Added CMS REST APIs for locale administration, content-type/field management, content creation/list/detail, translation create/update, shared-field updates, draft-review-publish-schedule-reject/archive/unpublish/restore and revisions.
- [x] Added public read APIs that return published snapshots only.
- [x] Added unit tests for dynamic field validation and CI checks for Prisma validation, client generation, type-check, tests and backend build.
- [x] Added dashboard CMS navigation and management pages for content list, content create/edit/translation workflow, content types/fields and languages.
- [x] Added a typed frontend API client and opt-in real backend login via `NEXT_PUBLIC_DEFAULT_AUTH=backend`; template fake auth remains the default.
- [x] Added Persian and English UI dictionary entries for the new CMS interface and sync document language/direction on language switch.

### CI verification

- Backend CI run https://github.com/saeed-esmaeilzadeh-anari/Admin_Dashboard_next_velzon_eng/actions/runs/40660666166 completed successfully at commit `9801924b839d53494219bb7a3efc086b125935d8` (Prisma validate/generate, TypeScript type-check, unit tests and backend build).
- Frontend CI was introduced and initially exposed a pre-existing peer-dependency conflict (`react-dual-listbox@6` declares React 16–18 peers while this repo has React 19); the workflow now uses `npm install --legacy-peer-deps` to match the repo's existing npm compatibility configuration. Its type-check/build result must be read from the latest run before claiming it is green.

### Explicitly not complete yet

- The CMS has a real backend and several real frontend admin pages, but the full legacy dashboard is **not** converted. Existing e-commerce, CRM, projects, tasks and other template pages still need their own page-by-page integration and regression testing.
- Media library and local/S3 storage, taxonomies, menus, redirects/sitemap/hreflang, visual page-builder blocks/repeaters, import/export, forms, webhooks/notifications, and detailed permission editor remain unimplemented.
- The current role enforcement is coarse (ADMIN/MANAGER on CMS write endpoints). Fine-grained per-action and per-content permission policies are required before a production CMS rollout.
- Rich text is not sanitized by the backend; public rendering must sanitize untrusted rich-text/HTML before injection.
- In-process minute scheduler is not durable on serverless runtimes; use an external cron or durable worker there.
- No production database or frontend/backend deployment has been provisioned or smoke-tested by this increment.

Do not describe the complete enterprise scope as finished until these limitations are addressed and tests cover the real workflows.

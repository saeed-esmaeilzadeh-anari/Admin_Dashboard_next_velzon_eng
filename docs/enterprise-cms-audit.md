# Enterprise CMS Repository Audit

Audit date: 2026-11-04  
Repository: `saeed-esmaeilzadeh-anari/Admin_Dashboard_next_velzon_eng`  
Default branch baseline: `main@5ef8f23a390342703fec773a42d3be39ba4bec5b`  
Working branch: `feat/enterprise-cms-production-finalization`

## 1. Audit method and boundaries

The audit used the repository tree, package manifests, Prisma schema and migrations, controllers, services, DTOs, Redux/API helpers, App Router pages, middleware, CI workflows, Postman collection and existing documentation.

Repository changes were made against GitHub refs in a dedicated feature branch. A local workstation checkout was not available to this execution, so a local `git rev-parse`, `git status`, or local `git remote -v` result is not claimed. The GitHub default branch SHA and feature branch ancestry were checked before editing. No local user files were changed.

The installation target remains one database and one CMS deployment per customer organization. Multi-tenancy was not introduced.

## 2. Confirmed stack

| Layer | Repository evidence |
|---|---|
| Frontend | Next.js 15.5.28, React 19.2.7, TypeScript |
| UI | Bootstrap 5.3.6, Reactstrap, existing Velzon component system |
| State | Redux Toolkit and Redux Persist |
| Localization | i18next/react-i18next; en and fa resource dictionaries |
| Fonts | Local HK Grotesk and IRANSansWeb WOFF2 assets |
| Backend | NestJS 10.4.15 |
| Database | PostgreSQL 16 in CI; Prisma 6.12.0 |
| API | Nest REST API under /api/v1 with Swagger |
| Authentication | bcrypt, JWT access tokens, Next.js BFF |
| Media | Local and S3-compatible storage adapters |
| Automation | GitHub Actions, scheduled jobs and protected job endpoints |

The repository uses the existing frameworks and ORM. They were not replaced.

## 3. CMS capability inventory

| Capability | Repository state | Assessment |
|---|---|---|
| CMS dashboard | Real summary API reads counts and recent translations from PostgreSQL | Implemented; browser/staging regression still required |
| Content CRUD | CMS API and UI for create, list, update and translations | Implemented for current content model |
| Dynamic content types | Database content types and JSON-backed field definitions | Implemented for enumerated field types |
| Editorial workflow | Draft, in-review, scheduled, published and archived states; submit/review/publish/schedule/unpublish/archive/restore operations | Implemented; concurrency and role matrix need further E2E tests |
| Revision history | Revision records, restore API and published snapshots | Implemented; visual diff/history UX is limited |
| Page builder | Hero, rich text, image, gallery, CTA, FAQ and card-grid blocks; add/edit/reorder/remove | First-generation implementation, not a full visual website designer |
| Media | MIME signature checks, size limits, randomized storage keys, metadata and referenced-asset delete protection | Implemented; production persistence and private media authorization need environment validation |
| Taxonomy | Taxonomies, hierarchical terms, localized term data and content assignment | Implemented |
| Menus | Localized nested menu trees; hierarchy validation and public menu endpoint | Implemented; customer navigation must be configured |
| Redirects | Database resolver, locale matching and redirect target validation | Implemented; staging behavior needs verification |
| Public rendering | Published content route, localized metadata, alternate URLs and published sitemap | Implemented for current renderer; SEO/browser regression required |
| Forms | Dynamic schema, server validation, submissions, status and internal notes | Implemented core; CAPTCHA/honeypot and richer spam controls are missing |
| Webhooks | HMAC-SHA256, public HTTPS destination checks, delivery rows and retry operations | Implemented core; durable distributed queue/worker is not present |
| Permissions | Database catalog and role-permission grants enforced by backend guard | Implemented for fixed role vocabulary; content ownership/team scope is missing |
| User management | User list, role update and activation/deactivation with administrator safety checks | Implemented in current branch; invitation/create/password recovery are missing |
| Audit | Request interceptor and selected business events | First-generation audit coverage; not every sensitive action has been proven covered |
| Import/export | Versioned JSON package with partial-failure results; imports create drafts | Implemented; media binaries are not included |
| White label | Public site name and existing theme settings are configurable in parts | Partial; centralized organization branding/settings module is not complete |
| Notifications/email | No complete SMTP-backed notification center and durable mail queue verified | Not implemented as a complete product module |

## 4. Issues discovered and addressed in this branch

1. **Demo product scope:** template CRM, e-commerce, crypto, NFT, job, charts and utility pages appeared in the main navigation. The commercial sidebar now exposes CMS modules and user/permission/audit administration; template routes are redirected to the CMS dashboard instead of deleted.
2. **Home session marker:** the home page read the legacy JavaScript-readable `authUser` marker after the BFF migration. It now checks the server-managed `velzon_session` cookie.
3. **Template dashboard:** `/dashboard` was an e-commerce demo page. It is now routed to `/apps-cms`.
4. **Header/profile demo controls:** the header included demo Web Apps, cart, notifications and search controls; the profile menu included demo balance, taskboard, messages and settings links. Those controls were removed from the commercial header/profile.
5. **Role vocabulary:** the Prisma role enum contained only ADMIN, MANAGER and USER. The branch adds SUPER_ADMIN, CONTENT_MANAGER, EDITOR, AUTHOR, REVIEWER, MEDIA_MANAGER, ANALYST and READ_ONLY plus a PostgreSQL enum migration.
6. **Permission grant persistence:** the service re-applied a default MANAGER grant set on each backend start, which could undo a deliberate permission revocation. Startup now ensures the permission catalogue without re-granting role permissions. Seed defaults are applied only to roles with no existing grants.
7. **Authentication throttling:** public login and registration did not have route-level throttling. The branch adds explicit limits.
8. **bcrypt byte limit:** DTO character-count checks alone do not guarantee bcrypt's 72-byte input limit for UTF-8 passwords. Register/login now reject values exceeding 72 UTF-8 bytes.
9. **Administrator safety:** user changes could demote/deactivate the last active admin. The branch uses a serializable transaction, prevents self-demotion/deactivation and protects the last active ADMIN/SUPER_ADMIN; an ADMIN cannot manage SUPER_ADMIN accounts.
10. **User administration UI:** the branch adds a database-backed paginated user list with search, role editing and activation controls.

## 5. Fake/demo integration review

The original template still contains mock-backed pages and example datasets. They are not converted into CMS modules and are not presented in the commercial navigation. The commercial middleware redirects known legacy template route roots to `/apps-cms`.

This does **not** mean every template controller, reducer or demo component has been removed from the source tree. Future CRM, commerce, project management or ticket products require separate implementation, permissions, integration and test scopes.

## 6. Remaining product and security gaps

- User invite/create flows, password reset, email verification, MFA, refresh-token rotation and persistent session revocation.
- Content ownership/team scoping and systematic IDOR/cross-user integration tests.
- Arbitrary customer-defined role CRUD. Current roles are a predefined enum; permission grants are configurable per supported role.
- Full visual drag-and-drop Page Builder, responsive preview editing, reusable layout templates and sanitized custom HTML support.
- Dedicated PHONE, RADIO and CHECKBOX field types in the current Prisma enum/editor.
- CAPTCHA/honeypot and stronger spam/abuse controls for public forms.
- SMTP provider management, email templates, notification center and durable mail queue.
- Durable distributed job queue or lease/lock strategy for multi-instance workers.
- Private-media access policies and signed URLs where customer media must not be public.
- Complete audit coverage review, monitoring/alerting, retention and incident runbook.
- Performance baselines, load tests, accessibility audits, cross-browser tests, frontend component tests and real browser E2E.
- Production S3/PostgreSQL provisioning, TLS, backup/restore rehearsal and staging validation.
- Commercial license/asset redistribution review for the Velzon source and bundled third-party assets.

## 7. Release acceptance boundary

A successful CI build does not certify production readiness. The exact release commit must pass both GitHub Actions workflows, and a staging deployment must exercise login, permissions, content workflow, media persistence, localized public rendering, forms, webhooks and scheduled jobs. Backup restoration and security/accessibility/load tests must also be evidenced.

No Production deployment or merge to `main` was performed by this branch.

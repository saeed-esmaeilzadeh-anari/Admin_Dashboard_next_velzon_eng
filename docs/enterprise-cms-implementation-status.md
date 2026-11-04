# Velzon Enterprise CMS — Implementation Status

Last updated: 2026-11-04  
Base: `main@5ef8f23a390342703fec773a42d3be39ba4bec5b`  
Working branch: `feat/enterprise-cms-production-finalization`

## Product boundary

The current product target is a self-hosted CMS installation for one customer organization. SaaS/multi-tenancy is a later extension. Legacy Velzon template modules are retained in source control but are not part of the commercial CMS navigation.

## Work completed in this branch

### Phase 0 — Repository baseline and audit
- [x] Confirmed GitHub repository, default branch and baseline SHA.
- [x] Created a separate feature branch from the current `main`.
- [x] Reviewed frontend/backend manifests, BFF/auth, Prisma schema/migrations, CMS modules, UI routes, docs, CI and Postman.
- [x] Added `docs/enterprise-cms-audit.md` with implemented/partial/missing inventory.
- [x] Replaced the old template-focused README with a CMS setup and limitations guide.

### Phase 1 — Authentication and security hardening
- [x] The previously merged BFF uses a host-only HttpOnly session cookie; browser JS never receives the access token.
- [x] Login and registration have explicit route-level throttling.
- [x] bcrypt's 72-byte UTF-8 input limit is enforced by the API.
- [x] Logout only redirects after the server reports that the session was cleared.
- [x] BFF responses are marked private/no-store; a protected API 401 expires the cookie.
- [ ] Refresh-token rotation, persistent session revocation, password reset, email verification and MFA remain unimplemented.

### Phase 2 — Enterprise roles and permissions
- [x] Added predefined roles: SUPER_ADMIN, ADMIN, MANAGER, CONTENT_MANAGER, EDITOR, AUTHOR, REVIEWER, MEDIA_MANAGER, ANALYST, READ_ONLY and USER.
- [x] Added an additive PostgreSQL enum migration.
- [x] SUPER_ADMIN is recognized by CMS permission guards and privileged controllers.
- [x] ADMIN and SUPER_ADMIN retain administrator-level access.
- [x] Permission initialization no longer re-grants removed MANAGER permissions on each backend restart.
- [x] Seed defaults are applied only to roles with no existing grants.
- [x] Permission matrix UI supports configurable grants for non-administrator roles.
- [ ] Arbitrary customer-created role definitions and delegation policies remain future work.

### Phase 3 — User administration
- [x] User API supports paginated/searchable listing and safe field updates.
- [x] Prevents an ADMIN from changing SUPER_ADMIN accounts.
- [x] Prevents self-demotion/deactivation and removal of the last active administrator.
- [x] Uses a serializable transaction for administrator account changes.
- [x] Added unit tests for administrator safety rules.
- [x] Added a CMS user administration page for list/search/role/active-state management.
- [ ] User invitation/create, password recovery, email verification and session revocation are not implemented.

### Phase 4 — Commercial CMS product scope and UX
- [x] Sidebar now contains CMS overview, content, schemas, languages, media, taxonomy, menus, redirects, forms, webhooks, import/export, users, permissions and audit.
- [x] Known legacy template/demo route roots redirect to the CMS dashboard; source files are retained.
- [x] Root route and post-login destinations use `/apps-cms`, not the legacy e-commerce dashboard.
- [x] Removed demo search, web apps, cart and template profile shortcuts from the commercial header/profile.
- [x] Footer no longer advertises the original template author.
- [x] Persian is the initial interface locale; Persian and English are the exposed initial interface languages.
- [x] Locale selection is stored for client and server-side routing.
- [x] Existing local font assets and global font stack are retained.
- [ ] Complete visual QA for mobile/tablet, keyboard navigation and screen readers remains.

### Phase 5 — Documentation and delivery preparation
- [x] Added audit, architecture, security, deployment, backup/restore, user, administrator, API, testing and release-note docs.
- [x] Added a placeholder staging Postman environment; no real secrets are included.
- [ ] Verify Swagger/Postman alignment against a deployed Staging API.

## Test evidence

- **Backend CI:** passed on commit `f48440edaabc97ffb0ee52a8e508c425de2031d1`. The run executed Prisma validation/generation, PostgreSQL 16 migration deploy/status, seed, database smoke, TypeScript, Jest tests, Nest build and API runtime smoke.
- **Frontend CI:** earlier run on commit `0078c7f700a4d37053e068a9c7e0dcb54c6c0de3` failed TypeScript checking on two new UI typing issues. Those issues were corrected in commits `7fd975d` and `9ff0355`. The subsequent run on `9ff0355` must be checked on completion; its result is not assumed here.
- No Production or Staging deployment was performed.
- No database restore rehearsal, real object-storage persistence test, browser E2E, penetration test, load test or accessibility audit is evidenced yet.

## Remaining release gates

1. Frontend TypeScript, lint review, Production build and BFF/CMS route smoke must pass on the exact final branch HEAD.
2. Backend migration, seed, unit tests, database smoke, Nest build and runtime auth tests must pass on the exact backend code in the final HEAD.
3. Deploy to a disposable Staging environment and exercise user permissions, content workflow, media persistence, localized public rendering, forms, webhooks and scheduled jobs.
4. Add browser E2E coverage for Persian/English and RTL/LTR.
5. Test ownership/IDOR rules, private media access, auth recovery, webhook retry/overlap and complete audit coverage.
6. Configure production PostgreSQL backups, media backup, external scheduler/worker, monitoring and a successful restore rehearsal.
7. Confirm commercial distribution rights for the template and all bundled assets.

## Release policy

A capability is not marked Production Ready only because code or UI exists. It requires verified API/database behavior, positive and negative authorization tests, usable loading/error/empty/success states, automated checks and operational recovery instructions.

This branch is not merged into `main` and has not been deployed.

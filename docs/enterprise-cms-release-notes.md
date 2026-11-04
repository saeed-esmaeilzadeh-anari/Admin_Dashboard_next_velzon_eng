# Enterprise CMS Release Notes

## Unreleased — 2026-11-04

Working branch: `feat/enterprise-cms-production-finalization`

### Product scope and UX
- Replaced the original template-focused README with an Enterprise CMS installation, architecture, testing and limitations guide.
- Reduced the commercial sidebar to CMS modules, user management, role permissions and audit log.
- Redirected known template/demo route roots to the CMS overview; source code for those modules is retained.
- Changed the home and post-login destinations to `/apps-cms`.
- Removed demo search, web apps, cart, notification and profile shortcuts from the commercial header/profile.
- Updated footer branding to Velzon Enterprise CMS.

### Localization
- Set Persian as the initial interface locale.
- Exposed Persian and English as the initial supported interface language choices.
- Persisted the locale in local storage and a non-sensitive `NEXT_LOCALE` cookie for server-side routing.
- Added Persian and English labels for the new enterprise roles and user administration page.

### Security and administration
- Added predefined CMS roles and a PostgreSQL enum migration.
- Updated the CMS permissions guard to recognize SUPER_ADMIN.
- Changed permission initialization so backend startup does not re-grant removed MANAGER permissions.
- Added role default grants to the seed, without overwriting already-configured roles.
- Added authentication route throttling and bcrypt's 72-byte UTF-8 input guard.
- Protected the last active administrator and restricted ADMIN from managing SUPER_ADMIN accounts.
- Added tests for administrator safety rules.
- Added a paginated/searchable user administration UI for role and activation changes.

### Validation
- Backend CI passed on an earlier branch commit covering migrations, seed, TypeScript, unit tests, database smoke and API runtime tests. A later run including additional administrator tests must be checked on the latest branch HEAD.
- An earlier frontend run exposed two TypeScript errors; fixes were committed and a fresh frontend run is in progress.
- No Staging or Production deployment was performed.

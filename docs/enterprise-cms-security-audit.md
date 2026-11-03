# Enterprise CMS — Initial Security and Repository Audit

Audit date: 2026-11-03
Repository: saeed-esmaeilzadeh-anari/Admin_Dashboard_next_velzon_eng
Default branch baseline: `main`
Baseline commit: `27783dac1cbc19b39eca1f2579be294bd8b3d21e`
Working branch: `feat/enterprise-cms-production`

## Baseline confirmed

- The GitHub repository is public and the connected account has push/admin permissions.
- The default branch is `main`; the baseline had no open pull requests at the time the work branch was created.
- The working branch was created from the exact baseline SHA above. Changes are isolated from `main`.
- Frontend: Next.js 15.5.28, React 19.2.7, TypeScript, Bootstrap 5.3.6 and Redux Toolkit.
- Backend: NestJS 10, Prisma 6.12.0 and PostgreSQL.
- CMS-specific pages and APIs already exist for content, content types, translations, workflow, revisions, media, taxonomies, menus, redirects, forms, webhooks, permissions, audit logs and import/export.
- The project already has a Postman collection containing 115 requests.
- Existing e-commerce, CRM, projects/tasks, tickets and several legacy template screens are not all connected to the database-backed API.
- Production infrastructure, persistent media storage, deployed E2E/browser checks, accessibility/load tests and a backup/restore rehearsal have not been verified by this audit.

## Security finding — backend access token exposure

Before this branch:
- The backend login thunk stored the login response (including `accessToken`) in a JavaScript-readable `authUser` cookie.
- It also stored the same response in `sessionStorage`.
- The backend API client read the token from `sessionStorage` and added it to browser Axios requests.
- Middleware used the presence of the JavaScript-readable `authUser` cookie as the dashboard session marker.
- The API proxy was a Next.js rewrite, so it could not attach or manage a server-side HttpOnly session cookie.

Risk: an XSS flaw could read the token from browser storage. A client-controlled cookie was also being used as an authentication gate marker. The NestJS API still validates Bearer tokens, but this storage pattern did not meet the required browser session security boundary.

## Changes implemented on this branch

- Added `src/app/backend-api/[...path]/route.ts` as a same-origin Next.js BFF/API proxy.
- Login now stores the NestJS access token only in a host-only `velzon_session` cookie marked HttpOnly, SameSite=Lax, Path=/ and Secure in production. Cookie lifetime is capped at 15 minutes.
- Login and registration responses are sanitized so `accessToken` is not returned to browser JavaScript. Registration does not silently sign the new user in.
- The BFF ignores browser-supplied Authorization headers and derives the Bearer token only from the HttpOnly cookie.
- Unsafe BFF methods reject a supplied cross-origin Origin.
- A protected backend 401 expires the session cookie. A 403 does not clear the session.
- Logout expires the HttpOnly cookie and the legacy JavaScript-readable marker.
- The browser backend API client no longer reads the token from sessionStorage or writes Authorization headers.
- Middleware uses the HttpOnly session marker for the backend auth provider; legacy demo auth providers retain their legacy marker.
- Removed the API rewrite from next.config.js so /backend-api traffic is handled by the BFF Route Handler.
- Added the private server-side `BACKEND_API_URL` configuration and documented the deployment contract.
- Expanded frontend CI smoke coverage for successful and rejected login, HttpOnly cookie attributes, token non-disclosure, authenticated API proxying and logout.

## Remaining security work

- The current NestJS access token has a 15-minute lifetime, but no refresh-token rotation/session revocation flow is implemented in this first slice. Expiration requires a new login.
- Middleware checks for a session cookie's presence; the backend remains the authority that cryptographically validates each protected API request. The cookie marker alone is not authorization.
- Per-content ownership/team-level authorization and comprehensive cross-user authorization integration tests remain open.
- Password reset, email verification, account recovery and MFA are not implemented.
- Rate limiting, audit coverage, log retention, monitoring and incident response require deployment-specific verification.
- CORS, TLS, storage ACLs, backup/restore and external scheduler configuration still require real staging/production validation.

## Verification status

- GitHub Actions frontend CI has been updated to exercise the BFF login/session lifecycle. Its result must be checked on this branch before merge.
- No Production deployment was performed.
- No production secrets or customer data were changed.

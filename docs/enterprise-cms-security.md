# Velzon Enterprise CMS — Security Model and Limitations

## Browser session boundary

The browser authenticates through the same-origin Next.js BFF:
- Cookie name: `velzon_session`.
- Attributes: HttpOnly, SameSite=Lax, Path=/, Secure in Production.
- Maximum cookie lifetime: 15 minutes.
- Login response contains the user profile, not the backend access token.
- BFF derives the Bearer header from the HttpOnly cookie and ignores browser-supplied Authorization.
- Logout calls the authenticated backend revocation endpoint using the HttpOnly session token, then expires the cookie. If the backend is unreachable, the cookie is still cleared and the original 15-minute JWT expiry remains the upper bound. An upstream protected API 401 also expires it; a 403 does not.
- Unsafe BFF requests compare a supplied Origin with the current origin.

NestJS remains authoritative for JWT signature/expiry, active account and route permissions. Middleware's cookie-presence check is a navigation gate only; it is not authorization.

## Backend controls present

- Password hashes use bcrypt.
- Login is limited to 5 requests per minute and public registration to 3 requests per minute per tracked client.
- Public registration is disabled by default when `NODE_ENV=production`; enabling it requires `PUBLIC_REGISTRATION_ENABLED=true`.
- JWT has a 15-minute expiry; the JWT strategy also verifies that its persisted AuthSession belongs to the user, is not revoked and has not expired.
- DTO ValidationPipe uses whitelist, forbidNonWhitelisted and transformation.
- CMS permission guard maps role grants to action codes.
- ADMIN has an explicit CMS permission bypass.
- User update requires ADMIN.
- CMS upload allowlists MIME types, validates file signatures and limits size.
- Media deletion checks current fields, published snapshots and saved revisions for references.
- Public form submissions are schema-validated and throttled to 10 requests per minute using the Nest throttler.
- Webhooks require HTTPS DNS hostnames, validate DNS results against reserved/private ranges, pin lookup results for the TLS request and use HMAC-SHA256 signatures.
- Internal scheduler endpoints require a private `CMS_JOB_TOKEN` and compare token bytes with timing-safe comparison.
- Helmet and CORS allowlisting are configured in the backend bootstrap.
- Separate liveness (`/api/v1/health/live`) and PostgreSQL readiness (`/api/v1/health/ready`) probes are available; the legacy `/api/v1/health` remains a readiness check.
- NestJS graceful shutdown hooks are enabled so application lifecycle hooks can close Prisma connections.

## Additional hardening in this branch

- Adds a PostgreSQL-backed AuthSession for every successful login and binds the session ID into the JWT.
- Requires a matching, active, unexpired session for every JWT-authenticated request.
- Adds authenticated logout that revokes the caller's session and integrates it with the Next.js BFF.
- Public registration now creates the account without issuing an authenticated token; users explicitly sign in afterward.
- CMS audit failures now persist the actual HTTP exception status (or 500 for unexpected errors).

- Protects the installation from accidental removal/demotion of its final active administrator.
- Prevents an administrator from deactivating their own account or changing their own role through the user update endpoint.
- Runs the critical admin-count check and update inside a serializable Prisma transaction.
- Extends webhook IPv4/IPv6 special-use destination filtering and tests.
- Moves server-rendered public CMS requests to an absolute server-side backend URL; browser requests remain BFF-proxied.

## Known security gaps — release blockers or explicit acceptance items

1. Persisted access sessions are revoked on authenticated logout. Refresh-token rotation, cross-device session listing/revocation and a session-management UI are not implemented.
2. Password reset, email verification, MFA and account recovery are not implemented.
3. Content ownership, reviewer assignment and team-level authorization are not implemented; current grants are role-wide.
4. CMS request audit records now include generated request ID, reported client IP, outcome and HTTP status, and record both success and failure for authenticated CMS-controller requests. They still do not provide complete before/after field diffs, cover every authentication/authorization rejection outside those controllers, or guarantee immutable retention.
5. Webhook secrets are stored as application data; encryption-at-rest/key rotation and secret reveal/rotation UX require separate design.
6. Authentication and public-form throttling use in-process storage in the current configuration. Multiple API replicas require a shared throttler store and trusted proxy/IP tracking; a configurable CAPTCHA/honeypot and retention/privacy workflow are also incomplete.
7. No completed external penetration test, dependency audit sign-off, XSS/CSRF/IDOR test suite or threat-model sign-off is recorded.
8. No customer-specific TLS, reverse-proxy trust, CORS, storage bucket ACL or secrets-manager configuration has been verified.

## Production rules

- Use HTTPS for frontend, API and webhook endpoints.
- Put `BACKEND_API_URL`, `DATABASE_URL`, `JWT_SECRET`, `CMS_JOB_TOKEN` and S3 credentials in the hosting secrets manager.
- Never commit `.env` files, tokens, webhook secrets, passwords or production data.
- Use a persistent S3-compatible object store for serverless hosting.
- Restrict `CORS_ORIGINS` to exact frontend origins.
- Back up PostgreSQL before migrations and rehearse restore separately.
- Do not enable raw HTML/JavaScript from CMS content without a reviewed sanitizer, strict allowlist and security tests.
- Review the exact final commit's GitHub Actions results before merge.

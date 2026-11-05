# Velzon Enterprise CMS — Security Model and Limitations

## Browser session boundary

The browser authenticates through the same-origin Next.js BFF:
- Cookie name: `velzon_session`.
- Attributes: HttpOnly, SameSite=Lax, Path=/, Secure in Production.
- Maximum cookie lifetime: 15 minutes.
- Login response contains the user profile, not the backend access token.
- BFF derives the Bearer header from the HttpOnly cookie and ignores browser-supplied Authorization.
- Logout expires the cookie. An upstream protected API 401 also expires it; a 403 does not.
- Unsafe BFF requests compare a supplied Origin with the current origin.

NestJS remains authoritative for JWT signature/expiry, active account and route permissions. Middleware's cookie-presence check is a navigation gate only; it is not authorization.

## Backend controls present

- Password hashes use bcrypt.
- JWT has a 15-minute expiry; user active status is rechecked by JWT strategy.
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

## Additional hardening in this branch

- Protects the installation from accidental removal/demotion of its final active administrator.
- Prevents an administrator from deactivating their own account or changing their own role through the user update endpoint.
- Runs the critical admin-count check and update inside a serializable Prisma transaction.
- Extends webhook IPv4/IPv6 special-use destination filtering and tests.
- Moves server-rendered public CMS requests to an absolute server-side backend URL; browser requests remain BFF-proxied.

## Known security gaps — release blockers or explicit acceptance items

1. No refresh-token rotation, persistent session revocation or device/session management.
2. Password reset, email verification, MFA and account recovery are not implemented.
3. Content ownership, reviewer assignment and team-level authorization are not implemented; current grants are role-wide.
4. Audit records are request-level. They do not yet provide complete before/after field diffs, request ID/IP correlation or a full trail of rejected/failed security events.
5. Webhook secrets are stored as application data; encryption-at-rest/key rotation and secret reveal/rotation UX require separate design.
6. Public-form throttling is process-local unless the deployment is configured with a shared limiter; a configurable CAPTCHA/honeypot and retention/privacy workflow are not complete.
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

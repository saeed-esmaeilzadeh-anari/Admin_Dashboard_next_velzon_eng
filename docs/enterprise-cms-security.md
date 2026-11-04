# Enterprise CMS Security Notes

## Controls present in the repository

### Authentication
- Passwords are hashed using bcrypt.
- API access tokens are short-lived (15 minutes).
- Root/UI authentication uses a same-origin Next.js BFF.
- The BFF stores the token in a host-only HttpOnly cookie; Secure in Production; SameSite=Lax; Path=/; max age capped at 15 minutes.
- Login and registration have explicit throttling.
- Passwords longer than 72 UTF-8 bytes are rejected to avoid bcrypt truncation ambiguity.
- The browser API helper does not read or store backend access tokens.

### Authorization
- NestJS guards enforce JWT authentication, roles and CMS action grants.
- ADMIN and SUPER_ADMIN have administrator-level CMS access.
- Non-administrator role grants are stored in PostgreSQL.
- User changes protect the last active administrator, prevent self-demotion/deactivation and prevent an ADMIN from managing SUPER_ADMIN accounts.
- Authorization must be tested on direct API requests, not only by hiding UI buttons.

### Request and API protection
- DTO validation is enabled globally.
- CORS is configured from explicit backend origins.
- Helmet/security headers are configured in the API.
- Public form submissions are throttled and schema-validated.
- Unsafe BFF requests validate an Origin header when supplied.
- BFF API responses are marked private/no-store; a protected 401 expires the session.
- Database access uses Prisma parameterized operations.

### Media
- Upload MIME must be on an allowlist and binary signatures are checked for supported types.
- Upload size is configurable.
- Storage keys use random UUID names rather than user-provided paths.
- Media records cannot be deleted while referenced by CMS content.
- Storage adapter supports local and S3-compatible backends.

### Webhooks
- Deliveries use HMAC-SHA256 signing.
- Destination validation requires public HTTPS hosts and checks resolved addresses.
- Delivery history and retry records are stored.
- Job-trigger endpoints require a timing-safe compared bearer token.

## Important limitations

- No refresh-token rotation or server-side session table/revocation endpoint; expiry currently requires a new login.
- No password reset, email verification, invitation flow or MFA.
- Middleware cookie presence is only a route gate; NestJS is the authority that verifies JWT and authorization.
- Content ownership/team-level scoping and comprehensive IDOR tests remain.
- Private media authorization/signed URLs need review for customers who store confidential files.
- CAPTCHA/honeypot and advanced public-form spam defense are absent.
- Security audit logging coverage, retention, central log aggregation, alerting and incident response need operational work.
- No external penetration test or systematic dependency/security scan result is claimed.

## Production requirements

1. Set private `BACKEND_API_URL`, `DATABASE_URL`, `JWT_SECRET`, `CMS_JOB_TOKEN` and object-storage credentials in the hosting secret manager.
2. Use HTTPS for frontend, API and public media.
3. Set exact CORS origins.
4. Use a persistent PostgreSQL service and S3-compatible media storage or a persistent volume.
5. Configure an external scheduler for serverless job execution.
6. Test session expiry, 401/403, origin rejection, role grants and cross-user authorization on staging.
7. Rotate secrets after any suspected exposure.

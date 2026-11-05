# Portfolio Readiness Hardening

This document records the first post-audit hardening increment for the portfolio version of Velzon Enterprise CMS.

## Scope

- Authentication endpoint throttling: login is limited to 5 requests per minute and public registration to 3 requests per minute per tracked client.
- Public registration policy: disabled by default in production unless `PUBLIC_REGISTRATION_ENABLED=true` is explicitly configured. Local development remains enabled by default; set the flag to `false` to disable it.
- Health endpoints: `GET /api/v1/health/live` is a process liveness check; `GET /api/v1/health/ready` verifies PostgreSQL connectivity. The existing `GET /api/v1/health` remains a backward-compatible database readiness check.
- Graceful shutdown hooks are enabled so NestJS lifecycle hooks, including Prisma disconnect, can run on termination.

## Persisted authentication sessions

- Each successful login persists an `AuthSession` row in PostgreSQL and binds its UUID into the JWT through the `sid` claim.
- The JWT strategy verifies that the session belongs to the user, has not been revoked and has not expired on every authenticated request.
- `POST /api/v1/auth/logout` revokes only the current session. The Next.js BFF forwards the HttpOnly cookie token to that endpoint and then clears the cookie.
- Public registration creates an account and returns a profile only. It does not silently create a login session; the user signs in explicitly.
- The additive migration is `20261105090000_auth_sessions`; existing user and CMS records are not modified. Existing JWTs without a `sid` must be replaced by a new sign-in after deployment.
- Expired/revoked sessions are pruned for the signing-in user at their next login. A scheduled global cleanup, refresh-token rotation and multi-device session management UI are not included.

## Security and deployment notes

The built-in Nest throttler storage is process-local. It protects a single API process and is useful as a baseline control, but does not provide a shared quota across multiple API replicas or serverless instances. Before horizontal scaling, configure a shared throttler storage backend (for example Redis) and validate proxy/IP tracking so all requests from a client are identified consistently.

Public registration should remain disabled for organization installations that use administrator-provisioned accounts. Enabling it is an explicit product decision; it does not replace email verification, invitation workflows, abuse monitoring or account lifecycle management.

The liveness endpoint intentionally avoids a database query so an orchestrator can distinguish a live process from a process that is not ready to serve database-backed traffic. Use the readiness endpoint for traffic admission.

CMS audit events now include a generated `X-Request-Id`, client IP (as reported by the configured HTTP adapter), outcome and HTTP status code. The interceptor records both successful and failed authenticated CMS requests, does not persist request bodies or credentials, and preserves the original response/error if audit persistence fails. This improves request correlation but does not replace a dedicated security-event pipeline or immutable audit retention.

## Verification

The backend CI runtime smoke test is extended to verify both health endpoints and the login/registration rate limits against the actual NestJS server and the CI PostgreSQL service. Unit tests cover production registration defaults and explicit configuration behavior.

A passing CI run validates this code in the disposable CI environment only. It does not constitute a penetration test, multi-replica rate-limit validation, staging deployment or production readiness approval.

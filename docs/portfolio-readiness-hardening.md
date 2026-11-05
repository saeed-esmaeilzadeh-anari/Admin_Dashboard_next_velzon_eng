# Portfolio Readiness Hardening

This document records the first post-audit hardening increment for the portfolio version of Velzon Enterprise CMS.

## Scope

- Authentication endpoint throttling: login is limited to 5 requests per minute and public registration to 3 requests per minute per tracked client.
- Public registration policy: disabled by default in production unless `PUBLIC_REGISTRATION_ENABLED=true` is explicitly configured. Local development remains enabled by default; set the flag to `false` to disable it.
- Health endpoints: `GET /api/v1/health/live` is a process liveness check; `GET /api/v1/health/ready` verifies PostgreSQL connectivity. The existing `GET /api/v1/health` remains a backward-compatible database readiness check.
- Graceful shutdown hooks are enabled so NestJS lifecycle hooks, including Prisma disconnect, can run on termination.

## Security and deployment notes

The built-in Nest throttler storage is process-local. It protects a single API process and is useful as a baseline control, but does not provide a shared quota across multiple API replicas or serverless instances. Before horizontal scaling, configure a shared throttler storage backend (for example Redis) and validate proxy/IP tracking so all requests from a client are identified consistently.

Public registration should remain disabled for organization installations that use administrator-provisioned accounts. Enabling it is an explicit product decision; it does not replace email verification, invitation workflows, abuse monitoring or account lifecycle management.

The liveness endpoint intentionally avoids a database query so an orchestrator can distinguish a live process from a process that is not ready to serve database-backed traffic. Use the readiness endpoint for traffic admission.

## Verification

The backend CI runtime smoke test is extended to verify both health endpoints and the login/registration rate limits against the actual NestJS server and the CI PostgreSQL service. Unit tests cover production registration defaults and explicit configuration behavior.

A passing CI run validates this code in the disposable CI environment only. It does not constitute a penetration test, multi-replica rate-limit validation, staging deployment or production readiness approval.

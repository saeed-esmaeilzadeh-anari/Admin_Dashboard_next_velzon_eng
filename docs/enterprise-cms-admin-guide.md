# Enterprise CMS Administrator Guide

## First installation

1. Provision PostgreSQL 16+ and configure the backend environment.
2. Apply the checked-in Prisma migrations.
3. Run the seed command with a dedicated initial administrator.
4. Configure the frontend BFF target using private `BACKEND_API_URL`.
5. Sign in and confirm the CMS overview uses real database summary data.

Detailed commands and environment names are in the repository README and deployment guide.

## Initial configuration

### Languages
The seed provides Persian and English starter locales. Verify their locale codes, display names, default status, fallback and direction (fa-IR RTL, en-US LTR).

### Content types
Review the seeded Page/Article schemas and add fields required by the customer. Only field types represented in the current Prisma enum and editor should be considered supported.

### Media storage
Local storage is intended for development or persistent-volume deployments. Configure S3-compatible storage for serverless/production. Verify permissions, public URL configuration and persistence across redeploy.

### Menu
Create localized menus and add links to published content or safe external HTTPS destinations. Menu data is stored by locale.

### Forms
Create a schema, publish/activate it and test valid, invalid and rate-limited submissions. Do not collect sensitive personal data without an approved privacy and retention policy.

### Webhooks
Create an endpoint, secret and event subscription. Use a controlled public HTTPS receiver. Inspect delivery status and retry failures only after understanding idempotency at the receiver.

### Role grants
Use the CMS permission matrix to grant only the actions required by each role. ADMIN and SUPER_ADMIN retain administrator-level access. The current roles are a predefined enum, not arbitrary custom role records.

## Manage users

The user page supports listing/search, role assignment and active/inactive control. The API prevents an administrator from managing a SUPER_ADMIN account, prevents self-demotion/deactivation and protects the last active administrator.

User creation/invitation, password reset, email verification and session revocation must be completed before a high-assurance enterprise account lifecycle is available.

## Audit and operations

Review CMS audit records for management operations. Ensure operational logs do not include passwords, access tokens, webhook secrets or raw sensitive form bodies. Configure log aggregation, alerting and retention outside the application.

## Production operations

Use the production readiness and backup/restore guides. A successful CI run does not replace a staging acceptance test or restore rehearsal.

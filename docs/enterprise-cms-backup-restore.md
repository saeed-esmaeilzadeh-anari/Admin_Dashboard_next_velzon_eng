# Velzon Enterprise CMS — Backup and Restore Runbook

## Current capability status

The repository has PostgreSQL migrations and local/S3 media storage adapters. It does **not** provide a complete automatic production backup service, retention policy, off-site backup system or verified disaster-recovery process. Those must be configured by the operator/hosting provider.

## What must be protected

1. PostgreSQL database, including users, content, translations, revisions/publication snapshots, media metadata, taxonomies, menus, redirects, forms/submissions, webhooks/deliveries, permissions and audit records.
2. S3-compatible media objects and their object metadata.
3. Backend and frontend deployment configuration, without exporting secrets into unsecured files.
4. The exact application commit and Prisma migration status corresponding to the backup.

A database-only backup is insufficient when media objects are stored outside PostgreSQL.

## Recommended policy to define before production

The customer/operator must set:
- Recovery Point Objective (RPO).
- Recovery Time Objective (RTO).
- Full backup cadence and retention.
- Point-in-time recovery/WAL retention where supported.
- Object storage versioning and lifecycle policy.
- Encrypted off-site backup destination.
- Access control and audit for backup operators.
- Retention and deletion policy for form submissions and other personal data.

The repository does not prescribe customer-specific RPO/RTO values.

## Pre-migration backup

1. Stop or quiesce writes when operationally possible.
2. Create a database snapshot or provider-managed PITR restore point.
3. Record database identity, time, migration status and application commit.
4. Verify backup integrity using provider tooling.
5. Confirm media-object backup/versioning is aligned with the database snapshot.
6. Apply migrations using `npm run prisma:deploy` only after this checkpoint.

## Restore rehearsal

Run this procedure in an isolated recovery environment, never directly over a live customer database:

1. Provision a new PostgreSQL database and credentials.
2. Restore the selected database snapshot.
3. Restore or point to the matching object-storage snapshot/version.
4. Deploy the application version associated with the backup.
5. Check Prisma migration status.
6. Verify user login and role permissions.
7. Verify a known Persian and English published page and its media.
8. Verify a draft remains private.
9. Verify content revisions and restore history.
10. Verify menus, redirects, form submissions and webhook delivery history.
11. Verify scheduled content is not published twice or prematurely.
12. Record elapsed recovery time, data loss window and defects.

Do not dispatch pending production webhooks from a recovery rehearsal. Use test endpoints/secrets or disable outbound delivery.

## Recovery cautions

- Restore the database and media store to a consistent point. Mismatched snapshots can create missing media or orphan files.
- If the application schema is newer than the restored database, deploy the compatible application version or apply migrations after evaluating backup compatibility.
- Rotating JWT, S3 or webhook secrets may invalidate existing sessions/deliveries. Document the rotation plan.
- Review personal-data retention and deletion obligations before retaining form-submission backups indefinitely.

## Acceptance evidence

A production release is not backup-ready until an operator can provide:
- A completed backup job record.
- An integrity check result.
- A successful isolated restore log.
- A media verification result.
- Measured RPO/RTO.
- Named operational ownership and escalation procedure.

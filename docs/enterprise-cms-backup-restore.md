# Enterprise CMS Backup and Restore

This document provides an operational pattern. The commands below are examples and have **not** been run against a customer database or storage bucket.

## What must be backed up

1. PostgreSQL database: CMS records, users, role grants, revisions, publication snapshots, media metadata, forms, webhook delivery history and audit logs.
2. Media objects: every object referenced by MediaAsset records, plus any required retained/unreferenced files.
3. Private configuration/secrets: store in a separate secret manager backup process, never in the database dump or Git.
4. Operational configuration: external scheduler configuration, canonical URLs, CORS origins, storage bucket configuration and retention policy.

A database-only backup is not a complete CMS backup because media binaries are stored outside PostgreSQL.

## PostgreSQL backup example

```bash
pg_dump --format=custom --no-owner --no-acl \
  --dbname="$DATABASE_URL" \
  --file="velzon-cms-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Protect the dump with encryption at rest and restrictive access. Store copies in a separate failure domain and define retention according to customer and legal requirements.

## Validate a backup

```bash
pg_restore --list velzon-cms-backup.dump
```

A readable archive listing is not proof of a successful restore.

## Restore rehearsal

1. Provision an isolated restore database with the same PostgreSQL major version.
2. Restore the dump into that isolated database:

```bash
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-acl velzon-cms-backup.dump
```

3. Apply any required owner/grant configuration separately.
4. Verify Prisma migration status against the restored schema.
5. Verify user login, content counts, translation counts, role grants, revision reads, menus/forms/webhooks and the public sitemap.
6. Verify media keys resolve to actual objects from the media backup.
7. Record restore duration and any recovery gaps.

Do not restore over Production as a test. Destructive flags such as `--clean` require a separately approved maintenance procedure.

## S3-compatible media backup

Use the storage provider's versioning/replication or an approved object-copy tool. Example with AWS CLI-compatible storage:

```bash
aws s3 sync s3://SOURCE_BUCKET/ ./cms-media-backup/ --only-show-errors
aws s3 sync ./cms-media-backup/ s3://RESTORE_BUCKET/ --only-show-errors
```

For S3-compatible endpoints, add the provider's `--endpoint-url` and credentials from a secure runtime environment. Do not store these credentials in shell history or a checked-in script.

## Recovery objectives

Define and document with each customer:

- RPO (maximum acceptable data loss).
- RTO (maximum acceptable recovery time).
- Backup frequency and retention.
- Object versioning/replication.
- Who may authorize restore.
- How webhook and scheduled-job activity is paused/reconciled during recovery.

## Current verification status

No production backup service is configured by the repository. No restore rehearsal has been run as part of this implementation. Treat backup/restore as a launch gate until the customer environment demonstrates a successful isolated restore.

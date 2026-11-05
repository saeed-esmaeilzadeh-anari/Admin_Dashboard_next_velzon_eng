# Enterprise CMS — Administrator Guide

## Audience and scope

This guide covers the CMS modules that exist in the current repository. It does not describe legacy Velzon template screens as completed CMS features. The current installation model is one CMS installation for one customer organization.

## First installation

1. Configure PostgreSQL and backend environment using `backend/.env.example`.
2. Apply checked-in migrations with `npm run prisma:deploy`.
3. Run the seed command with a dedicated administrator email and a strong bootstrap password.
4. Configure the frontend with `NEXT_PUBLIC_DEFAULT_AUTH=backend` and a private server-side `BACKEND_API_URL`.
5. Sign in through the Next.js frontend. Do not use the raw NestJS access token in browser storage.
6. Confirm API health at `/api/v1/health` and inspect Swagger at `/docs`.

Do not use a production database for initial testing. Take a verified backup before applying migrations to an existing installation.

## Roles and permissions

The current Prisma role enum contains:
- ADMIN
- MANAGER
- USER

CMS permissions are action codes such as `cms.content.read`, `cms.content.create`, `cms.content.edit`, `cms.content.submit`, `cms.content.publish`, `cms.media.upload`, `cms.menus.manage`, `cms.forms.manage` and `cms.audit.read`.

The CMS Permission page can manage grants for supported non-admin roles. ADMIN has an explicit server-side permission bypass. The current implementation is not a full custom-role designer and does not provide content-owner/team scoping or reviewer assignment.

Use least privilege. Do not grant publish, permission-management or webhook-management operations to author-only users.

## Content types and fields

The seeded installation contains Page and Article content types. Administrators can manage content types and dynamic fields from **CMS → Content Types and Fields**.

Each field has a key, label, type, required/localized flags, active state, sort order and optional JSON configuration. The current field model supports the enum types defined in `backend/prisma/schema.prisma`; not every field type has an equally mature UI editor or end-to-end test.

When changing a field schema, test creation, editing, validation, public rendering, import/export and old-content compatibility using disposable data first. Avoid changing a field key after it has been used by content without a migration plan.

## Languages

The seed creates Persian and English CMS locales. Each locale has a code and text direction. UI translations come from i18next dictionaries; UI language and CMS content locale are separate settings.

Before publishing localized content:
- verify the locale is active;
- create a translation for that locale;
- use a unique localized slug;
- verify the public URL, language alternate and RTL/LTR direction.

## Editorial workflow

The backend exposes workflow operations for submit, publish, reject, schedule, unpublish, archive and restore-to-draft. Backend permission checks are authoritative.

Expected operating sequence:
1. Author creates or edits a draft translation.
2. Author submits the translation for review.
3. A user with the appropriate review grant reviews it.
4. A user with publish permission publishes or schedules it.
5. Public visitors see only a published translation/snapshot.

The current code does not yet implement reviewer assignment or owner/team-based queue filtering. Test scheduled publication on staging with the actual scheduler configuration before relying on time-critical publishing.

## Revisions and publication snapshots

Content translation edits create revision records and publication snapshots are stored separately from the editable draft. Use revision history and restore actions deliberately. A restored revision should be reviewed before publishing again.

Media referenced by current content, published snapshots or historical revisions is protected from deletion by the backend.

## Media library

The CMS supports file upload, media metadata (alt text and caption), search/filter, and deletion checks. Uploads are constrained by an allowed MIME list, file signature checks and `CMS_MAX_UPLOAD_BYTES`.

- Local storage is for development or a persistent server filesystem.
- Serverless deployments need S3-compatible storage or a persistent mounted volume.
- Do not assume that a local ephemeral filesystem survives redeployments.
- Do not delete an asset until its references have been removed from drafts, published snapshots and revisions.

The current media URL/storage configuration must be tested for the customer's CDN/bucket access policy before launch.

## Taxonomies, navigation and redirects

Taxonomies/terms support content classification. Menus can be managed per locale and the public menu endpoint returns an active localized menu tree. Redirect rules are resolved by the public middleware path and the backend redirect service.

Test nested menus for cycles and test every redirect change for loops and safe destinations. Prefer internal relative URLs for internal pages. The public menu renderer validates href destinations.

## Forms and submissions

Administrators can create form definitions and review submissions. Public submissions are DTO/schema-validated and the endpoint has throttling. A configurable CAPTCHA/honeypot and a complete retention/privacy lifecycle are not currently implemented; use additional perimeter spam controls where required.

Treat submission values as personal/customer data. Restrict who can read submissions, define a retention policy and never copy sensitive values into audit metadata or logs.

## Webhooks

Webhook configuration stores endpoint, events and a secret; delivery rows track attempts, status, response code/error and retry time. Outbound requests use HMAC-SHA256 and destination validation.

Use only public HTTPS endpoints under the customer's control. Rotate webhook secrets when exposure is suspected. Validate DNS and endpoint behavior from staging before enabling production delivery. Durable multi-instance queue semantics and operational alerting still require deployment-level validation.

## Audit and import/export

The audit page lists CMS request-level activity. It is not yet a full field-level before/after audit system.

JSON export is bounded; import creates drafts and reports partial/failing records. Media binaries are not included in export packages. Make destination media available before importing content that references it.

## Operational warnings

Do not represent the installation as Production Ready until the exact release has passed the documented testing checklist, storage persistence, backup/restore rehearsal, security review, accessibility review and staging smoke tests.

# CMS Architecture — Initial Core

## Scope of this increment

The CMS is a modular API added to the existing Next.js dashboard. The frontend still has legacy demo screens and is not yet fully wired to the CMS APIs. This document describes the backend slice that exists in the current branch, not a claim that the entire CMS is complete.

## Main data concepts

- `Locale`: unique locale code, native/display names, RTL/LTR direction, active/default flags and optional fallback locale.
- `ContentType`: stable machine key and display metadata for a type such as `page` or `article`.
- `ContentTypeField`: a type-safe field definition. A field is marked as either shared across translations or locale-specific.
- `Content`: stable identity plus shared field values.
- `ContentTranslation`: localized title, slug, SEO fields, locale-specific values, workflow status and revision counter.
- `ContentRevision`: historical snapshot, author, version and change note.

Structured fields are currently stored in PostgreSQL JSONB with server validation driven by field definitions. This is a pragmatic first step for flexible content types; media relationships, rich relation fields, repeaters and page-builder blocks remain future work.

## Publication behavior

Draft/review/scheduled values are separate from the published snapshot. When a published translation is edited, the working translation can return to draft while the public API still reads the last published snapshot until that snapshot is explicitly unpublished or replaced by a later publication. Public reads only include entries with a published slug for an active locale and active content type.

## Routes

- `GET/POST/PATCH /api/v1/cms/locales`
- `GET/POST/PATCH /api/v1/cms/content-types`
- `POST/PATCH /api/v1/cms/content-types/:id/fields`
- `GET/POST /api/v1/cms/contents`
- `PATCH /api/v1/cms/contents/:id/translations/:localeCode`
- `PATCH /api/v1/cms/contents/:id/shared-fields`
- Workflow actions under `/api/v1/cms/contents/:id/translations/:localeCode`: submit, publish, reject, schedule, unpublish, archive and restore-to-draft.
- Revision list and restore routes under the same translation route.
- Public reads: `GET /api/v1/public/cms/:typeKey/:localeCode` and `GET /api/v1/public/cms/:typeKey/:localeCode/:slug`.

## Deployment note

The scheduled publisher currently uses an in-process Nest schedule every minute. It is suitable for a continuously running app process, not a guarantee for a serverless runtime. A production serverless deployment needs a durable scheduler/worker or an external cron trigger.

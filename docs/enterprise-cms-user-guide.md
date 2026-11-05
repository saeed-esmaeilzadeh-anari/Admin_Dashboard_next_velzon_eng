# Enterprise CMS — Editor and User Guide

## What this guide covers

This guide explains the content workflow and CMS pages that exist in the current repository. Available operations depend on the role grants assigned by the administrator. A visible button is not a substitute for server-side authorization.

## Sign-in and profile

Sign in through the Next.js application using your organization account. The browser session is held in an HttpOnly cookie; the access token is not meant to be copied or stored manually.

Use the profile menu to open your profile or sign out. If your session expires, sign in again. Password recovery, MFA and session-device management are not currently implemented.

## Create a page or article

1. Open **CMS → Content**.
2. Select **Create content**.
3. Choose an active content type (for example Page or Article).
4. Enter the shared fields and at least one localized translation.
5. Select the target CMS locale, enter a title and unique slug, and complete required fields.
6. Save the draft.
7. Preview the content before submitting it for review.

The fields shown by the editor depend on the content type schema. The backend validates field type and required values; unsupported or inactive keys are rejected.

## Add another language

Open the existing content record and add a translation for the required locale. Enter a localized title and slug, then fill the localized fields. The page direction comes from the locale (RTL for Persian, LTR for English).

The dashboard UI language selector is not the same as the content translation selector. Changing the UI language does not translate a page automatically.

## Edit and preview

Edit only fields you have permission to change. Review the preview after modifying block data, media or localized fields. The current page builder supports a bounded set of block types; arbitrary custom scripts/HTML are not supported.

If another editor changes the record at the same time, compare the latest revision before continuing. A complete conflict-resolution UI for all concurrent editing cases is not currently provided.

## Submit, review and publish

The expected editorial process is:
- Save work as Draft.
- Submit it for review when it is ready.
- A reviewer with the appropriate grant can review/reject it.
- A publisher with `cms.content.publish` can publish or schedule it.

Publishing is enforced by NestJS permissions and workflow service, not only by the page UI. A user who receives 403 does not have the required grant.

The current release does not include reviewer assignment or ownership-based review queues. Follow your organization's editorial procedure for assigning reviewers outside the software.

## Media

Upload files through the Media Library. Add descriptive alt text for images and a caption when useful. Use only supported file formats and respect the configured maximum size.

Do not delete media that is still referenced by content or revisions. The backend checks references and rejects deletion while they remain.

## Taxonomies and menus

Select the appropriate categories/tags when assigning terms to content. Menu editors manage localized navigation; verify that internal links resolve and external links use HTTPS. Do not create cyclic nested menu items.

## Forms and submissions

Public forms are configured by administrators. Users who have submission-read permission can review incoming entries, update their processing status and add internal notes according to policy. Treat submissions as confidential customer data.

## Help and current limitations

Contact your installation administrator for missing permissions or unavailable locales. Password recovery, MFA, content-owner/team filtering, complete reviewer assignment and a full field-level change history are not part of the current delivered foundation.

# Enterprise CMS User Guide

## Sign in

Open the customer CMS URL and sign in with the account provided by the administrator. The browser session is stored in an HttpOnly cookie; the access token is not exposed to browser JavaScript.

## Choose interface language

The initial interface languages are Persian and English. Use the language control in the header. The selection is stored in browser storage and the `NEXT_LOCALE` cookie so the UI and server-side locale-aware routing can use the selected language.

Persian uses RTL layout and IRANSansWeb; English uses LTR layout and HK Grotesk.

## Content workflow

The current CMS workflow includes:

1. Choose a content type.
2. Create a content record and first language version.
3. Add language versions from the editor.
4. Save draft edits.
5. Submit the version for review if the role allows it.
6. A reviewer can review/reject or an authorized publisher can publish/schedule.
7. Public rendering serves the last published snapshot; draft edits are not automatically public.
8. Use revision history to inspect/restore a previous revision where supported.

Exact available actions depend on role grants and the current status.

## Page builder

The first-generation builder supports these structured blocks:

- Hero
- Rich text / Markdown
- Image
- Gallery
- Call to action
- FAQ
- Card grid

Blocks can be added, edited, reordered and removed. It is not a general-purpose drag-and-drop designer; arbitrary HTML/JavaScript is not enabled.

## Media library

Upload an allowed media file, add alt text/caption and select it in supported content fields or page-builder blocks. The API checks file type/signature and size. Referenced assets cannot be deleted while still in use.

For customer deployments, ask the administrator to configure persistent S3-compatible storage. Local development storage may be ephemeral on serverless hosts.

## Forms and submissions

Forms are configured in the CMS and exposed through public form endpoints. Submissions are validated by the API and are rate limited. The admin UI supports reviewing and updating submission status/internal notes. CAPTCHA and advanced spam controls are not currently included.

## Roles and permissions

The current predefined roles are SUPER_ADMIN, ADMIN, MANAGER, CONTENT_MANAGER, EDITOR, AUTHOR, REVIEWER, MEDIA_MANAGER, ANALYST, READ_ONLY and USER. Available actions depend on the role's CMS permission grants.

The role list is predefined; administrators cannot yet create arbitrary new role names.

## What is not yet available

User invitations, self-service password recovery, email verification, MFA, refresh-session management and a complete notification center are not part of this release slice. Contact the system administrator for account and credential changes.

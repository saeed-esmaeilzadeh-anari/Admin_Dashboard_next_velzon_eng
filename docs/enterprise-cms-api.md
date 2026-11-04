# Enterprise CMS API Guide

## Base URLs

- NestJS API: `https://api.example.com/api/v1`
- Swagger UI: `https://api.example.com/docs`
- OpenAPI JSON: `https://api.example.com/docs-json`
- Browser/BFF API path: same-origin `/backend-api/*`

Use Swagger generated from the deployed API as the authoritative list of routes and schemas. Do not invent routes from this guide.

## Authentication

For direct API/Postman testing:

1. Call `POST /api/v1/auth/login` with the login DTO.
2. Capture the returned short-lived Bearer access token in a local Postman secret/environment variable.
3. Send `Authorization: Bearer <token>` for protected NestJS routes.

For the browser application:

1. Call same-origin `POST /backend-api/auth/login`.
2. The Next.js BFF sets the HttpOnly `velzon_session` cookie and removes `accessToken` from the JSON response.
3. Call other `/backend-api/*` routes with same-origin credentials; do not add a browser-managed Authorization header.
4. Call `POST /backend-api/auth/logout` to expire the cookie.

## API groups present in the repository

- Health
- Authentication and current user
- Users
- CMS dashboard summary
- Locales and content types/fields
- Content, translations, workflow, revisions and import/export
- CMS media
- Taxonomies and terms
- Menus and public menu output
- Redirects and redirect resolver
- Forms, submissions and public submission
- Webhooks and delivery retry/history
- CMS permissions
- Audit logs
- Public content and sitemap
- Internal scheduled-publish and webhook-dispatch jobs

The exact route/DTO definitions are published through Swagger.

## Postman

Import:

- `postman/Velzon-Admin-API.postman_collection.json`
- `postman/Velzon-Local.postman_environment.json` for localhost
- `postman/Velzon-Staging.postman_environment.json` as a placeholder template

The staging environment intentionally contains example URLs and blank secret variables. Replace them locally; do not commit production passwords, access tokens or job tokens.

## Error handling

NestJS validation and exception handlers return HTTP error responses. Clients must handle 400 validation failures, 401 unauthenticated/expired sessions, 403 insufficient authorization, 404 missing records, 409 state conflicts and 429 rate limits. Never treat a successful frontend route render as proof of backend permission.

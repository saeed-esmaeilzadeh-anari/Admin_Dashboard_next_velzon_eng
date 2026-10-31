# Postman setup — Velzon Admin API

## Import into Postman
1. Choose **Import** and import `Velzon-Admin-API.postman_collection.json`.
2. Import `Velzon-Local.postman_environment.json` and select it.
3. Start PostgreSQL and the backend, then run **00 - Diagnostics → API health + database check**.
4. Set `adminEmail` and `adminPassword` in the selected environment to the administrator created by the backend seed.
5. Run **01 - Authentication → Login**. Its test script stores `accessToken` in the active environment.
6. Use the relevant ID variables after creating records. Most route variables expect real UUIDs.

## Backend environment
Copy `backend/.env.example` to `backend/.env` and set at least:
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: unique random string, minimum 32 characters.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: seed administrator; password minimum 12 characters.
- `CORS_ORIGINS`: exact frontend origins, comma-separated, without path segments.
- `PUBLIC_SITE_URL`: canonical frontend origin.

Then, from `backend/`:
```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

API base: `http://localhost:3001/api/v1`  
Swagger UI: `http://localhost:3001/docs`  
OpenAPI JSON: `http://localhost:3001/docs-json`  
Health check: `GET /api/v1/health`

## Frontend environment
The repository root already provides `.env.example`. Copy it to `.env.local` and verify these values:
```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Velzon
```
Restart Next.js after changing environment variables.

## Authentication, permissions and security
- `POST /auth/register` always creates a `USER`; it does not accept a role.
- The seed bootstraps the administrator from backend environment variables.
- CMS administration requires Bearer JWT plus a matching CMS permission; ADMIN bypasses CMS grants.
- User management requires ADMIN. Business mutation routes are role-gated (mainly ADMIN/MANAGER).
- Public CMS content, menus, form schema, form submission and redirect resolution do not require a Bearer token.
- Internal scheduled-job routes require `Authorization: Bearer <CMS_JOB_TOKEN>`. Store it only in the backend and scheduler secret stores; never use a `NEXT_PUBLIC_*` variable.
- CMS media upload uses `multipart/form-data` with field name `file`; optional fields are `altText` and `caption`.

## Notes
- All API requests in this collection use the verified global prefix `/api/v1`; Swagger endpoints are at the server root.
- Do not use placeholder IDs; set each ID variable to the UUID returned by the previous create/list request.
- CMS sample payloads are based on the DTO definitions; schema-dependent forms should be adapted to the configured form schema.
- A local file upload directory is not persistent on ephemeral serverless runtimes. Use durable volume or configured S3-compatible storage before deploying.
- Production credentials, PostgreSQL provisioning, host environment variables and S3 credentials must be set in your hosting/provider accounts; they cannot safely be committed in this repository.
- This collection documents backend endpoints. It does not imply that every legacy template screen is connected to the API; backend README documents which older modules still use fake data.

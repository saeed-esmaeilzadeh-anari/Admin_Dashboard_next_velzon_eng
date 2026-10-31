# Postman setup — Velzon Admin API

## Import
1. In Postman choose **Import**.
2. Import `Velzon-Admin-API.postman_collection.json`.
3. Import `Velzon-Local.postman_environment.json` and select that environment.
4. Start the backend, then run **00 - Health → Health check**.
5. Run **01 - Authentication → Login**. The collection automatically saves `accessToken` from the API response.
6. Use the CMS and business folders. Replace the ID variables after creating records.

## Local backend configuration
Copy `backend/.env.example` to `backend/.env`, then set:
- `DATABASE_URL`: PostgreSQL connection string for a database you control.
- `JWT_SECRET`: unique random secret, minimum 32 characters.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: bootstrap admin; password minimum 12 characters.
- `CORS_ORIGINS`: exact frontend origin, e.g. `http://localhost:3000`.
- `PUBLIC_SITE_URL`: canonical frontend origin.

From `backend/`:
```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

Backend base URL: `http://localhost:3001/api/v1`; Swagger: `http://localhost:3001/docs`.

Frontend root environment (copy to `.env.local`):
```dotenv
NEXT_PUBLIC_DEFAULT_AUTH=backend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Velzon
```
Restart Next.js after changing environment variables.

## Roles and permissions
- Register always creates a `USER`; it does not accept a role.
- Seeded administrator is configured via backend seed environment variables.
- CMS management routes require a valid Bearer token and action permission; ADMIN bypasses CMS grants.
- User management routes require ADMIN. Business write access is role-dependent (mostly ADMIN/MANAGER).
- Public CMS routes do not require a token.
- Internal scheduled-job routes require `Authorization: Bearer <CMS_JOB_TOKEN>`; keep this secret only in backend/scheduler secret stores.

## Important
- API prefix is `/api/v1`. Do not append another `/api` segment.
- Use real UUIDs in ID variables. Requests with placeholder IDs will return validation/not-found errors until replaced.
- CMS request bodies in this collection are examples. Open Swagger for exact DTO schemas and additional routes.
- Local file storage is suitable for development only; serverless deployments need persistent storage or S3-compatible storage.
- This repository does not contain your PostgreSQL credentials or provision hosting resources. Configure secrets and run migrations/seed against your own intended database before use.

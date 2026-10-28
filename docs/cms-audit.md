# CMS Implementation Audit (working ledger)

| Area | Current state | Evidence / next action |
|---|---|---|
| Existing Next.js routes | Large dashboard template with e-commerce, CRM, projects, tasks, tickets and demo pages | Page-by-page field/API audit is still required |
| Backend foundation | Implemented | NestJS, Prisma/PostgreSQL, JWT, existing business APIs |
| Locale metadata API | Implemented in CMS core branch slice | Verify schema validation and CI |
| Persian/English seed locales | Implemented in seed | fa-IR defaults to RTL, en-US to LTR |
| Dynamic content types / fields | Backend API implemented for initial field types | Field schema and validation tests added |
| Translation records | Backend data model and write API implemented | Frontend editing/translation switcher not yet wired |
| Workflow and revision API | Backend methods/routes implemented | CI and integration tests still needed |
| Public published-content API | Backend API reads published snapshot | HTML sanitization/rendering and end-to-end tests required |
| Legacy Fake Backend removal | Not complete | Replace page-by-page only after API wiring and test coverage |
| Media Library / storage | Not implemented | Design local/S3 interface and metadata lifecycle |
| Taxonomy / menus / redirects / SEO sitemap | Not implemented | Follow after the content UX is connected |
| Page builder / blocks | Not implemented | Build only after core content editor contract stabilizes |
| Fine-grained RBAC | Not implemented | Replace coarse role checks with permission matrix |
| Production scheduler | Not solved for serverless | Use durable scheduler or external cron trigger |

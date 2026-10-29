# CMS Implementation Audit (working ledger)

| Area | Current state | Evidence / next action |
|---|---|---|
| Existing Next.js routes | Large dashboard template with e-commerce, CRM, projects, tasks, tickets and demo pages | Page-by-page field/API audit is still required |
| Backend foundation | Implemented | NestJS, Prisma/PostgreSQL, JWT, existing business APIs |
| Locale metadata API | Implemented in CMS core branch slice | Verify schema validation and CI |
| Persian/English seed locales | Implemented in seed | fa-IR defaults to RTL, en-US to LTR |
| Dynamic content types / fields | Backend API implemented for initial field types | Field schema and validation tests added |
| Translation records | Backend data model and write API implemented | Editor supports selecting an existing locale or creating a new language version; UI test coverage still needed |
| Workflow and revision API | Backend methods/routes implemented | CI and integration tests still needed |
| Public published-content API | Backend API + public Next.js content route | Published snapshots only; structured preview renders safe text; full browser/E2E verification remains required |
| Legacy Fake Backend removal | Not complete | New CMS screens use the real API client; existing template business pages still require page-by-page migration after tests |
| Media Library / storage | Local storage + media API/UI implemented | Use persistent disk or external provider for deployment; media files are not bundled into JSON exports |
| Taxonomy / menus / redirects / SEO sitemap | Not implemented | Follow after the content UX is connected |
| Page builder / blocks | Initial block editor implemented | Hero, text/Markdown, image, gallery, CTA, FAQ and card grid; block design/template extensions remain possible |
| CMS management UI | Initial real screens implemented | Content list/create/edit, dynamic content-type fields and language administration; responsive/manual QA still needed |
| Fine-grained RBAC | Not implemented | Replace coarse role checks with permission matrix |
| Production scheduler | In-process worker implemented | Add external durable scheduler/worker for serverless production |


## CI notes

- Backend CI completed successfully at commit `9801924b839d53494219bb7a3efc086b125935d8`: [workflow run](https://github.com/saeed-esmaeilzadeh-anari/Admin_Dashboard_next_velzon_eng/actions/runs/40660666166).
- Frontend CI status should be checked on the latest run before the CMS UI is treated as validated.

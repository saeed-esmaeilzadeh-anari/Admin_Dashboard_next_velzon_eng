# Enterprise CMS — Release Notes

## Current development line

Branch: `feat/enterprise-cms-production-v2`  
Base commit: `main@5ef8f23a390342703fec773a42d3be39ba4bec5b`  
Release state: development; not approved for production.

## Changes in this development increment

- Fixed server-rendered public CMS reads to use an absolute server-side backend URL instead of a browser-relative Axios base URL.
- Added a frontend production smoke test for the public published-content Server Component route.
- Added serializable administrator account safety checks: an administrator cannot change their own role/deactivate themselves, and the final active administrator cannot be demoted/deactivated.
- Added unit tests for administrator lockout prevention and ordinary user updates.
- Extended webhook SSRF destination filtering and test coverage for reserved IPv4/IPv6 ranges.
- Limited the backend-auth product navigation to CMS overview, CMS administration and profile; legacy template/demo screens remain in the repository but are not presented in the CMS primary navigation.
- Rewrote the root README with the actual dependency versions, local setup instructions, architecture and known limitations.
- Added enterprise CMS audit, architecture, security, deployment, backup/restore, administrator, user, API, testing and release documentation.

## Important limitations

This increment does not complete a full enterprise CMS product. Session refresh/revocation, password reset, MFA, content ownership/team-level permission, reviewer assignment, full email/notification service, universal drag/drop page builder, durable multi-instance job queue, complete audit coverage, frontend E2E/accessibility/performance testing, production provisioning and backup/restore rehearsal remain open.

## Previous merged security baseline

The HttpOnly BFF authentication slice was merged into main through PR #15 before this branch was created. This branch is based on that merged main commit and continues from it.

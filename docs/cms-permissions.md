> **Current-state note (2026-11-04):** This document is retained as an earlier engineering snapshot. For the current product scope, verified implementation inventory, role model, deployment requirements and open release gates, use [Enterprise CMS Audit](enterprise-cms-audit.md), [Implementation Status](enterprise-cms-implementation-status.md), [Architecture](enterprise-cms-architecture.md), [Security](enterprise-cms-security.md) and [Deployment](enterprise-cms-deployment.md). Where this historical note differs from those current documents, the current documents take precedence.

# CMS Permissions — Current Slice and Gaps

## Current server enforcement

- CMS management controllers require an authenticated Bearer JWT.
- Locale creation and updates require the `ADMIN` role.
- Content-type, dynamic-field and content-write/workflow operations require `ADMIN` or `MANAGER`.
- Read endpoints in the admin CMS controller require authentication; public content endpoints do not, but return only active-locale, active-type entries with a published slug and a stored published snapshot.
- The existing role enum is still coarse-grained: `ADMIN`, `MANAGER`, `USER`. The finer-grained user/role/permission editor from the full brief is not implemented in this increment.

## Required next hardening

- Split content edit, translation edit, review, publish and unpublish into individual permissions rather than treating managers as one broad group.
- Enforce per-content ownership/team scopes if the product needs them.
- Add security tests for unauthenticated requests, forbidden writes and draft leakage.
- Sanitize rich-text output in the rendering layer before injecting HTML.
- Add rate limiting and security-event logging for sensitive authentication operations.

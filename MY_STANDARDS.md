# MY_STANDARDS.md — Universal Engineering Standards

These 14 standards apply to every project I own. All agents and contributors must follow them.

---

## 1. Real Implementations, Never Mocks
Ship real, working code. Never use fake data, placeholder responses, or stubbed services in production paths. Mocks belong only in tests.

## 2. Mobile Is the First Test
Every UI must look and work correctly on a 375px-wide screen before any other viewport. Touch targets must be at least 44×44px. Bottom navigation is preferred for primary actions.

## 3. Soft Delete Over Hard Delete
Never permanently erase user-visible data. Add a `deleted_at` timestamp column and filter it out in queries. Provide "archive" or "trash" UI instead of irreversible deletion.

## 4. Audit Trails
Every mutation to important data must be logged: who changed what, when, and from what value to what value. Admin actions, settings changes, and record edits all need an audit log. Provide a history view in the UI.

## 5. Centralize Shared Logic
Duplicate code is a bug. Shared utilities, types, hooks, and components must live in a single shared location and be imported everywhere they are used.

## 6. Plan Before Building
Every non-trivial feature must have a written plan (task file, RFC, or design doc) before implementation begins. Plans must include scope, approach, and acceptance criteria.

## 7. Settings Per-Tenant
All configuration and preferences must be scoped to the tenant (store, org, user). Never use a single global settings table that mixes tenants.

## 8. Security Defaults
Use secure defaults everywhere: HTTP-only cookies, encrypted secrets at rest, scoped tokens, RBAC, input validation, CSRF/XSS protection, timing-safe comparisons. Security is not optional.

## 9. TypeScript Strictness
Enable strict mode in every TypeScript project. Zero `any` casts. All functions must have explicit return types or be inferable. Use `unknown` instead of `any`.

## 10. Dark Mode
Every UI must support dark mode from day one. Use CSS custom properties for theming. Provide a user-facing toggle and respect the system preference as the default.

## 11. Design Reference (Pipedrive)
Follow Pipedrive's design language: clean, data-first layouts. No emojis in the UI. Information hierarchy must be scan-friendly with clear visual grouping. Prioritize density and utility over decoration.

## 12. Real-Time Updates
Data that changes should update in the UI without requiring a page refresh. Use WebSockets, SSE, or polling as appropriate. Settings changes, new records, and status updates should all appear live.

## 13. Background Work Survives Restarts
Any background job or scheduled task must handle SIGTERM/SIGINT gracefully. In-progress work must be recoverable after a restart. Use a persistent job queue, not in-memory timers, for important work.

## 14. One Source of Truth Per Data
Every piece of data must have exactly one authoritative source. No dual-write patterns. If data lives in an external system (e.g., Shopify), treat it as the owner and cache locally with clear invalidation rules.

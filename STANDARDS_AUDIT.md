# STANDARDS_AUDIT.md — Codebase Gap Analysis

Audit of the Shopify MCP AI Shopping Agent codebase against the 14 universal engineering standards defined in `MY_STANDARDS.md`.

**Audit date:** 2026-04-05
**Codebase:** Shopify MCP AI Shopping Agent (pnpm monorepo)

---

## Summary

| # | Standard | Verdict |
|---|----------|---------|
| 1 | Real Implementations, Never Mocks | **PASS** |
| 2 | Mobile Is the First Test | **PARTIAL** |
| 3 | Soft Delete Over Hard Delete | **FAIL** |
| 4 | Audit Trails | **FAIL** |
| 5 | Centralize Shared Logic | **PARTIAL** |
| 6 | Plan Before Building | **PASS** |
| 7 | Settings Per-Tenant | **PASS** |
| 8 | Security Defaults | **PASS** |
| 9 | TypeScript Strictness | **PASS** |
| 10 | Dark Mode | **PARTIAL** |
| 11 | Design Reference (Pipedrive) | **PARTIAL** |
| 12 | Real-Time Updates | **PARTIAL** |
| 13 | Background Work Survives Restarts | **FAIL** |
| 14 | One Source of Truth Per Data | **PASS** |

**Pass: 7 | Partial: 4 | Fail: 3**

---

## Detailed Findings

### 1. Real Implementations, Never Mocks — PASS

**Evidence:**
- All production code paths use real Shopify MCP, real LLM provider SDKs (OpenAI, Anthropic, xAI), and real PostgreSQL queries.
- Mocked data exists only in `load-tests/` (for stress testing) and `artifacts/mockup-sandbox/` (for component design previews). Both are appropriate non-production contexts.
- No placeholder or stubbed API responses in the API server or frontend.

**Remediation:** None required.

---

### 2. Mobile Is the First Test — PARTIAL

**Evidence:**
- Tailwind CSS responsive classes (`sm:`, `md:`, `lg:`) are used throughout the frontend.
- The embed modes (chat widget, product assistant) are designed for in-store use on mobile Shopify themes.
- `artifacts/shopify-agent/src/index.css` includes responsive font sizes and spacing.

**Gaps:**
- No evidence of systematic 375px viewport testing or documented mobile-first QA process.
- Touch target sizes are not explicitly enforced (no min-height/min-width utility classes targeting 44×44px).
- Primary navigation does not use a bottom-nav pattern on mobile — the sidebar collapses but there is no mobile-optimized bottom bar.

**Remediation:**
1. Add a mobile-first testing step to QA (screenshot tests or Playwright at 375px viewport).
2. Audit all interactive elements for 44×44px minimum touch targets.
3. Evaluate adding a bottom navigation bar for the main merchant dashboard on mobile viewports.

---

### 3. Soft Delete Over Hard Delete — FAIL

**Evidence:**
- **Stores:** `DELETE /stores/:storeDomain` in `artifacts/api-server/src/routes/stores.ts` performs a hard `db.delete(sessionsTable)` followed by `db.delete(storesTable)` (lines 207–208). Cascade deletes propagate to conversations, knowledge, and analytics. No recovery possible.
- **Conversations:** `DELETE /stores/:storeDomain/conversations/:conversationId` in `artifacts/api-server/src/routes/conversations.ts` performs a hard `db.delete(conversationsTable)` (lines 107–116). No `deleted_at` column exists.
- **Knowledge:** `DELETE /stores/:storeDomain/knowledge/:knowledgeId` in `artifacts/api-server/src/routes/knowledge.ts` performs a hard `db.delete(shopKnowledgeTable)` (lines 122–129). No `deleted_at` column exists.
- **DB Maintenance:** `artifacts/api-server/src/services/db-maintenance.ts` permanently deletes expired sessions, old analytics, and old conversations in batch loops.
- No schema table has a `deleted_at` column: confirmed in `lib/db/src/schema/stores.ts`, `conversations.ts`, `knowledge.ts`, `analytics.ts`.

**Remediation:**
1. Add `deletedAt: timestamp("deleted_at", { withTimezone: true })` column to `storesTable`, `conversationsTable`, and `shopKnowledgeTable`.
2. Replace all `db.delete(...)` calls with `db.update(...).set({ deletedAt: new Date() })` for user-initiated deletions.
3. Add `.where(isNull(table.deletedAt))` to all SELECT queries for these tables.
4. Add a "Trash" or "Archived" view in the merchant dashboard for stores, conversations, and knowledge entries.
5. DB maintenance can still hard-delete records where `deletedAt` is older than a retention period (e.g., 30 days past soft-delete).

---

### 4. Audit Trails — FAIL

**Evidence:**
- `analytics_logs` table (`lib/db/src/schema/analytics.ts`) tracks chat events (`event_type`, `query`, `session_id`) but only for customer-facing interactions.
- No audit log table exists for admin/merchant actions.
- Store settings changes (`PATCH /stores/:storeDomain`) in `artifacts/api-server/src/routes/stores.ts` update the record in-place with no history of previous values.
- Knowledge entry edits (`PATCH /stores/:storeDomain/knowledge/:knowledgeId`) overwrite fields with no change log.
- No UI to view change history for any entity.

**Remediation:**
1. Create an `audit_logs` table with columns: `id`, `store_domain`, `actor` (session/user ID), `action` (e.g., "store.update", "knowledge.delete"), `entity_type`, `entity_id`, `old_values` (JSONB), `new_values` (JSONB), `created_at`.
2. Add audit log writes to all mutation endpoints: store create/update/delete, knowledge CRUD, conversation delete, settings changes.
3. Add a "History" or "Activity Log" view in the merchant dashboard showing recent changes with who/what/when details.

---

### 5. Centralize Shared Logic — PARTIAL

**Evidence (good):**
- Domain logic is well centralized: `lib/api-spec/` (OpenAPI spec), `lib/db/` (Drizzle schema), `lib/api-client-react/` (generated API client with Orval), `lib/api-zod/` (Zod validation schemas).
- The monorepo structure with `@workspace/*` packages ensures type-safe sharing across artifacts.

**Gaps:**
- The `cn()` utility function is **duplicated identically** in `artifacts/shopify-agent/src/lib/utils.ts` and `artifacts/mockup-sandbox/src/lib/utils.ts`. Both files import `clsx` and `twMerge` and export the same function.
- shadcn/ui components are installed separately in both `shopify-agent` and `mockup-sandbox` rather than shared from a common UI library package.
- SSE streaming for chat is handled outside the generated `lib/api-client-react/` client (which covers REST endpoints only). The SSE parsing and session management code lives directly in the frontend artifacts.

**Remediation:**
1. Create a shared `lib/ui/` package containing `cn()`, common hooks (e.g., `use-toast`), and shared shadcn/ui components.
2. Update both `shopify-agent` and `mockup-sandbox` to import from `@workspace/ui` instead of maintaining local copies.
3. Evaluate whether SSE parsing can be encapsulated in a shared utility in `lib/api-client-react/` or a new `lib/sse/` package.

---

### 6. Plan Before Building — PASS

**Evidence:**
- The project uses structured task planning with `.local/tasks/` directory containing 42+ task files.
- Each task file includes title, scope, approach details, acceptance criteria, and relevant files.
- Tasks are numbered and tracked systematically.

**Remediation:** None required.

---

### 7. Settings Per-Tenant — PASS

**Evidence:**
- All settings are scoped to `store_domain` as the tenant key: `storesTable` uses `storeDomain` as primary key, `shopKnowledgeTable` references `storeDomain`, `conversationsTable` references `storeDomain`.
- User preferences are scoped to store + session.
- No global settings table exists that mixes tenant data.
- All API routes validate tenant scope via `validateStoreDomain` and `validateMerchantAuth` middleware.

**Remediation:** None required.

---

### 8. Security Defaults — PASS

**Evidence:**
- HTTP-only cookies for session management.
- AES-256-GCM encryption for API keys at rest (`artifacts/api-server/src/services/encryption.ts`).
- Scoped merchant tokens with validation middleware (`validateMerchantAuth`, `validateMerchantAuthForStoreList`).
- RBAC via tenant isolation — merchants can only access their own store domain.
- HMAC verification for Shopify webhooks.
- Timing-safe comparisons for secret validation.
- Prompt injection filtering on user messages.
- Input validation with Zod schemas on all endpoints.
- Body size limits and CORS configuration.
- User message truncation to 10,000 chars.
- `DEV_AUTH_SECRET` warning in non-development environments.

**Remediation:** None required.

---

### 9. TypeScript Strictness — PASS

**Evidence:**
- `tsconfig.base.json` enables near-full strict mode via individual flags: `noImplicitAny`, `noImplicitThis`, `strictNullChecks`, `strictBindCallApply`, `strictPropertyInitialization`, `useUnknownInCatchVariables`, `alwaysStrict`, `noImplicitReturns`. `load-tests/tsconfig.json` uses `strict: true` directly.
- Zero `as any` casts found in the codebase.
- All packages have `typecheck` scripts in their `package.json`.
- Zod schemas provide runtime type validation in addition to compile-time types.
- `strictFunctionTypes` is opted out in the base config (a common and acceptable exception for callback-heavy Express patterns).

**Remediation:** None required.

---

### 10. Dark Mode — PARTIAL

**Evidence (good):**
- `artifacts/shopify-agent/src/index.css` defines a complete set of CSS custom properties for both light and dark themes using `@custom-variant dark (&:is(.dark *))`.
- HSL-based color system with `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--chart-*`, and `--sidebar-*` variables all have dark mode values.
- Many components use Tailwind `dark:` variant classes.

**Gaps:**
- No `ThemeProvider` component or theme context exists in the main `shopify-agent` app.
- No user-facing toggle to switch between light/dark/system modes.
- The `.dark` class is never dynamically applied to the document root — dark mode is "ready" in CSS but not activatable.
- System preference (`prefers-color-scheme`) is not being detected or respected.

**Remediation:**
1. Add a `ThemeProvider` component that manages theme state (light/dark/system) and applies the `.dark` class to the document root.
2. Add a theme toggle in the merchant dashboard UI (e.g., settings or header).
3. Default to `system` preference using `window.matchMedia('(prefers-color-scheme: dark)')`.
4. Persist the user's theme choice in local storage or user preferences.

---

### 11. Design Reference (Pipedrive) — PARTIAL

**Evidence (good):**
- Clean, data-first layouts in the merchant dashboard (store settings, analytics, knowledge management).
- No emojis in the UI chrome.
- Tabular/list-based data presentation.

**Gaps:**
- No formal design audit against Pipedrive's specific patterns (information density, scan-friendly grouping, visual hierarchy).
- Some views may prioritize aesthetics over data density (e.g., large card layouts instead of compact tables for knowledge entries).
- Need to verify consistent use of data-first hierarchy across all merchant-facing views.

**Remediation:**
1. Conduct a side-by-side design review comparing key merchant dashboard views against Pipedrive's layouts.
2. Ensure all data-heavy views (analytics, knowledge, conversations) use compact, scan-friendly layouts with clear visual grouping.
3. Minimize decorative elements and maximize information density in merchant-facing screens.

---

### 12. Real-Time Updates — PARTIAL

**Evidence (good):**
- SSE (Server-Sent Events) streaming works well for chat responses — the AI's reply streams token-by-token to the UI.
- Chat conversations update in real-time during active sessions.

**Gaps:**
- No WebSocket or push infrastructure for non-chat data.
- Settings changes (e.g., store configuration, LLM provider updates) require a page refresh to appear in the UI.
- Analytics data does not update in real-time — merchants must refresh the dashboard to see new data.
- Knowledge entry changes made in one tab/session are not pushed to other open sessions.
- Store enable/disable toggles (chat, embed) don't broadcast to other connected clients.

**Remediation:**
1. Add a WebSocket or SSE channel for merchant dashboard events (settings changes, new analytics, knowledge updates).
2. Implement optimistic UI updates with server confirmation for settings changes.
3. Add polling as a simpler alternative for less critical data (e.g., analytics refresh every 30 seconds).
4. Consider a pub/sub pattern for multi-tab/multi-user consistency on merchant settings.

---

### 13. Background Work Survives Restarts — FAIL

**Evidence:**
- `artifacts/api-server/src/services/db-maintenance.ts` uses `setInterval` (line 101) for scheduling hourly cleanup. This interval is lost on process restart with no recovery mechanism.
- `artifacts/api-server/src/index.ts` has no `SIGTERM` or `SIGINT` signal handlers. The process does not gracefully shut down — in-progress HTTP requests, SSE streams, and database operations are abruptly terminated.
- No persistent job queue (e.g., BullMQ, pg-boss) is used. All background work relies on in-memory scheduling.
- The startup sequence (`start()` in `index.ts`) does run `backfillMessageCounts()` and `startDbMaintenance()`, which provides some resilience by re-running work on restart. However, if a maintenance batch is mid-execution when the process is killed, the partial state is not tracked.
- No circuit breaker or deduplication for maintenance runs — if the process restarts rapidly, maintenance could run multiple times concurrently.

**Remediation:**
1. Add `SIGTERM` and `SIGINT` handlers in `artifacts/api-server/src/index.ts` that:
   - Stop accepting new connections.
   - Wait for in-progress requests to complete (with a timeout).
   - Call `stopDbMaintenance()`.
   - Close the database connection pool.
   - Exit cleanly.
2. Replace `setInterval`-based maintenance with a persistent job scheduler (e.g., `pg-boss` which uses PostgreSQL for job storage).
3. Add job deduplication to prevent concurrent maintenance runs after rapid restarts.
4. Track maintenance run timestamps in the database so work can resume from where it left off.

---

### 14. One Source of Truth Per Data — PASS

**Evidence:**
- Clear ownership boundaries: Shopify is the authority for product catalog, pricing, and inventory data. The local PostgreSQL database owns configuration (stores, settings), sessions, conversations, knowledge entries, and analytics.
- No dual-write patterns — product data is always fetched from Shopify via MCP at query time, not replicated locally.
- LRU caches exist for stores, sessions, knowledge, and MCP tools, but these are read-through caches with explicit invalidation (e.g., `invalidateStoreCache()`, `invalidateToolsListCache()`, `invalidateKnowledgeCache()`) called on every mutation.
- The `mcp_connections` table stores OAuth tokens for Customer Account MCP but treats Shopify as the authority for customer data — tokens are just access credentials.

**Remediation:** None required.

---

## Priority Remediation Roadmap

### High Priority (address first)
1. **Standard 3 — Soft Delete:** Add `deleted_at` columns and replace hard deletes. This protects against accidental data loss and is foundational.
2. **Standard 13 — Graceful Shutdown:** Add signal handlers and consider a persistent job queue. Critical for production reliability.
3. **Standard 4 — Audit Trails:** Create audit log infrastructure. Important for merchant trust and debugging.

### Medium Priority
4. **Standard 5 — Centralize Shared Logic:** Extract shared UI utilities into a `lib/ui` package. Reduces maintenance burden.
5. **Standard 10 — Dark Mode:** Wire up the existing CSS custom properties with a ThemeProvider and toggle. Most of the work is already done.
6. **Standard 12 — Real-Time Updates:** Add push/polling for non-chat data. Start with settings and analytics.

### Lower Priority
7. **Standard 2 — Mobile-First Testing:** Add systematic 375px viewport testing. The foundation is there, needs process enforcement.
8. **Standard 11 — Pipedrive Design:** Conduct a formal design audit. Mostly a review exercise.

# Backend Performance Audit Report

## 1. Database Query Analysis

### Stores (`stores` table)
- **Primary key**: `store_domain` (text) — all lookups use `eq(storesTable.storeDomain, ...)` which hits the PK index directly.
- **No sequential scans**: Every store query filters by PK. Index-only scan expected.

### Sessions (`sessions` table)
- **Primary key**: `id` (text UUID).
- **Indexes**: `idx_sessions_expires_at` (for cleanup), `idx_sessions_store_expires` (storeDomain, expiresAt composite).
- **Session validation query** (`session-validator.ts`): Filters by `id = ? AND storeDomain = ? AND expiresAt > NOW()` — uses PK on `id` for the initial seek, then filters.
- **Merchant auth query** (`merchant-auth.ts`): Filters by `id = ? AND expiresAt > NOW()` — PK index seek.
- **Cleanup query** (`db-maintenance.ts`): Filters by `expiresAt < NOW()` — uses `idx_sessions_expires_at`.

### Conversations (`conversations` table)
- **Primary key**: `id` (serial).
- **Index**: `idx_conversations_store_session_updated` (storeDomain, sessionId, updatedAt).
- **Load query**: Filters by `id = ? AND storeDomain = ? AND sessionId = ?` — PK seek on `id` with row filter.
- **Save query**: Updated from full JSONB replacement to JSONB append (`messages || $1::jsonb`), eliminating read-modify-write overhead. (FIXED)

### Analytics Logs (`analytics_logs` table)
- **Indexes**: `idx_analytics_store_created` (storeDomain, createdAt), `idx_analytics_event_type` (eventType).
- **New index**: `idx_analytics_query_normalized` on `lower(trim(query)) WHERE query IS NOT NULL` — supports the top-queries aggregation without a sequential scan. (FIXED)
- **Analytics route**: Uses `Promise.all` for 3 parallel queries with proper index coverage.

### Knowledge (`shop_knowledge` table)
- **Index**: `idx_shop_knowledge_store_category` (storeDomain, category).
- **Knowledge fetch**: Filters by `storeDomain = ?` — uses the composite index prefix.

## 2. Cache Effectiveness

| Cache | Max Size | TTL | Purpose | Status |
|-------|----------|-----|---------|--------|
| `storeCache` | 500 | 60s | Tenant validation | Effective. Invalidated on store update/delete. |
| `sessionCache` | 5,000 | 30s | Shopper session validation | Effective. Invalidated on domain delete. |
| `knowledgeCache` | 500 | 120s | Shop knowledge for system prompts | Effective. Invalidated on store delete. |
| `toolsListCache` | 500 | 5min | MCP tools/list results | Effective. Invalidated on storefront token or UCP config change. |
| `ucpCache` | 1,000 | 5min | UCP discovery documents | Effective. Null results are cached to avoid repeated failed fetches. |
| `merchantSessionCache` | 1,000 | 10s | Merchant dashboard auth | NEW — previously uncached, every merchant request hit the DB. Short TTL (10s) minimizes stale-session window. Invalidation hooks exported for logout/revocation. (FIXED) |

### Cache invalidation paths verified:
- Store update (`PATCH /stores/:storeDomain`): Invalidates store cache, tools cache (when token/UCP changes).
- Store delete (`DELETE /stores/:storeDomain`): Invalidates store, session, merchant session, knowledge, and tools caches.

## 3. Conversation Storage Efficiency

**Before (issue)**: `persistChatResult` received the full `existingMessages` array and wrote it as a complete JSONB replacement via Drizzle's `.set({ messages })`. For a conversation with N messages, this transferred ~N * avg_message_size bytes in both directions on every turn.

**After (fixed)**: Uses SQL `messages || $1::jsonb` to append only the new user + assistant messages. The server sends only 2 message objects per turn regardless of conversation length. Postgres performs the concatenation server-side without the client reading the full blob.

## 4. SSE Streaming — Memory Audit

- **Abort controller**: Created per-request, signals on client disconnect.
- **Client disconnect handling**: `req.on("close")` sets `clientDisconnected` flag and aborts the controller.
- **`safeSend`**: Checks `clientDisconnected` before every write, preventing writes to closed connections.
- **`res.end()`**: Called in `finally` block, ensuring stream cleanup regardless of success/error.
- **String accumulation**: `fullAssistantContent += event.data` grows with the response, but this is bounded by the LLM's max output tokens (~4-8K tokens) and is necessary for persistence.
- **No interval timers**: No keepalive heartbeat timer that could leak.
- **Verdict**: No memory leak risk identified. Stream cleanup is thorough.

## 5. N+1 and Redundant Query Analysis

### Chat endpoint (`POST /stores/:storeDomain/chat`)
Request lifecycle:
1. `validateStoreDomain` — cached store lookup (0-1 DB queries)
2. `validateSession` — cached session lookup (0-1 DB queries)
3. `getCachedKnowledge` — cached knowledge fetch (0-1 DB queries)
4. `loadOrCreateConversation` — 1 DB query (select or insert)
5. `listTools` — cached MCP + UCP HTTP calls (0 DB queries)
6. LLM streaming — no DB queries
7. `persistChatResult` — 2 DB queries (update conversation, insert analytics)

**Total**: 2-5 DB queries per chat request (optimal path: 2 with warm caches).
**No N+1 patterns detected.**

### Store listing (`GET /stores`)
- 1 DB query (filtered by merchant's domain). No N+1.

### Analytics (`GET /stores/:storeDomain/analytics`)
- 3 parallel DB queries via `Promise.all`. No N+1.

### Merchant auth
- Previously: 1 uncached DB query per request. Now cached with LRU (FIXED).

## 6. MCP/UCP Parallel Execution

**Before (issue)**: `listTools` called MCP `tools/list` HTTP endpoint first, waited for the response, then called `discoverUCPCapabilities` sequentially. Two independent HTTP calls serialized.

**After (fixed)**: Both HTTP calls now fire concurrently via `Promise.all([mcpPromise, ucpPromise])`. When both caches are cold, this saves up to 10 seconds of wall time (UCP discovery timeout).

## 7. Connection Pool Configuration

```
max: 20 (env: DB_POOL_MAX)
idleTimeoutMillis: 30,000 (env: DB_POOL_IDLE_TIMEOUT)
connectionTimeoutMillis: 5,000 (env: DB_POOL_CONNECTION_TIMEOUT)
```

- **Pool size**: 20 connections is appropriate for the workload. Most requests use 2-5 queries, and caching reduces DB load significantly.
- **Idle timeout**: 30s is reasonable — keeps connections warm during active periods without holding them indefinitely.
- **Connection timeout**: 5s fail-fast prevents request stacking during DB outages.
- **Connection release**: Drizzle/pg `Pool` releases connections after each query automatically.

## 8. Database Maintenance

- **Expired session cleanup**: Batched deletes (1,000 rows per batch) prevent lock contention. Runs hourly.
- **Analytics pruning**: Configurable retention (default 90 days), same batched delete pattern.
- **Maintenance uses `ctid`-based subquery**: Efficient for batch deletion without requiring `ORDER BY`.

## 9. Response Time Baseline (Estimated)

| Endpoint | Warm Cache | Cold Cache |
|----------|-----------|------------|
| `POST /stores/:storeDomain/chat` | ~50ms + LLM stream | ~100ms + LLM stream |
| `GET /stores` | ~20ms | ~30ms |
| `GET /stores/:storeDomain` | ~10ms (cached) | ~20ms |
| `PATCH /stores/:storeDomain` | ~30ms | ~40ms |
| `GET /stores/:storeDomain/analytics` | ~50ms | ~80ms |
| `POST /sessions` | ~30ms | ~40ms |
| `GET /stores/:storeDomain/public` | ~10ms | ~20ms |

Note: Chat endpoint response time is dominated by LLM streaming latency (typically 1-30 seconds depending on provider and model).

## Summary of Fixes Applied

1. **Conversation JSONB append** — Eliminated full read-modify-write cycle by using SQL `||` operator for message append.
2. **MCP + UCP parallelization** — Both HTTP discovery calls now run concurrently via `Promise.all`.
3. **Merchant auth caching** — Added LRU cache (1,000 entries, 10s TTL) for merchant session validation. Short TTL minimizes stale-session authorization window. Invalidation hooks exported; merchant cache cleared on store deletion.
4. **Analytics functional index** — Added `idx_analytics_query_normalized` on `lower(trim(query))` for the top-queries aggregation.

## Remaining Observations (No Action Required)

- **Store cache includes encrypted API key**: The `storeCache` caches the full `Store` object including the encrypted `apiKey` field. This is intentional — the chat route needs the encrypted key for decryption. The encrypted key in memory is no worse than having it in the database, and stripping it from the cache would require a separate DB fetch on every chat request.
- **`deleteByPrefix` on session cache**: The `invalidateSessionCacheForDomain` function iterates all cache keys to find prefix matches. This is O(n) on cache size but only called on store deletion (rare operation).
- **No request-level connection pooling**: Each query acquires and releases a pool connection independently. For the chat endpoint's 2-5 queries, this is fine given pg Pool's efficient connection reuse.

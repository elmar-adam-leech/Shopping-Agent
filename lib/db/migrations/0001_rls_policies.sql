-- Migration: Row Level Security (RLS) policies for multi-tenant isolation
-- Tables: conversations, sessions, analytics_logs, shop_knowledge, user_preferences, mcp_connections
-- 
-- Tenant isolation is enforced via the session variable `app.current_store_domain`.
-- All tenant-scoped queries MUST use withTenantScope() which sets this variable
-- inside a transaction (SET LOCAL). Without it, no rows are visible (fail-closed).
--
-- Administrative/maintenance operations use withAdminBypass() which sets
-- `app.rls_bypass = 'on'` inside a transaction for cross-tenant access.
--
-- FORCE ROW LEVEL SECURITY ensures policies apply even to the table owner role.

DO $$ BEGIN

  -- conversations
  ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "conversations";
  CREATE POLICY tenant_isolation_select ON "conversations"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "conversations";
  CREATE POLICY tenant_isolation_insert ON "conversations"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "conversations";
  CREATE POLICY tenant_isolation_update ON "conversations"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "conversations";
  CREATE POLICY tenant_isolation_delete ON "conversations"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "conversations";
  CREATE POLICY tenant_bypass_owner ON "conversations"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

  -- sessions
  ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "sessions";
  CREATE POLICY tenant_isolation_select ON "sessions"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "sessions";
  CREATE POLICY tenant_isolation_insert ON "sessions"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "sessions";
  CREATE POLICY tenant_isolation_update ON "sessions"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "sessions";
  CREATE POLICY tenant_isolation_delete ON "sessions"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "sessions";
  CREATE POLICY tenant_bypass_owner ON "sessions"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

  -- analytics_logs
  ALTER TABLE "analytics_logs" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_logs" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "analytics_logs";
  CREATE POLICY tenant_isolation_select ON "analytics_logs"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "analytics_logs";
  CREATE POLICY tenant_isolation_insert ON "analytics_logs"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "analytics_logs";
  CREATE POLICY tenant_isolation_update ON "analytics_logs"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "analytics_logs";
  CREATE POLICY tenant_isolation_delete ON "analytics_logs"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "analytics_logs";
  CREATE POLICY tenant_bypass_owner ON "analytics_logs"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

  -- shop_knowledge
  ALTER TABLE "shop_knowledge" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "shop_knowledge" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "shop_knowledge";
  CREATE POLICY tenant_isolation_select ON "shop_knowledge"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "shop_knowledge";
  CREATE POLICY tenant_isolation_insert ON "shop_knowledge"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "shop_knowledge";
  CREATE POLICY tenant_isolation_update ON "shop_knowledge"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "shop_knowledge";
  CREATE POLICY tenant_isolation_delete ON "shop_knowledge"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "shop_knowledge";
  CREATE POLICY tenant_bypass_owner ON "shop_knowledge"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

  -- user_preferences
  ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_preferences" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "user_preferences";
  CREATE POLICY tenant_isolation_select ON "user_preferences"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "user_preferences";
  CREATE POLICY tenant_isolation_insert ON "user_preferences"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "user_preferences";
  CREATE POLICY tenant_isolation_update ON "user_preferences"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "user_preferences";
  CREATE POLICY tenant_isolation_delete ON "user_preferences"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "user_preferences";
  CREATE POLICY tenant_bypass_owner ON "user_preferences"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

  -- mcp_connections
  ALTER TABLE "mcp_connections" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "mcp_connections" FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS tenant_isolation_select ON "mcp_connections";
  CREATE POLICY tenant_isolation_select ON "mcp_connections"
    FOR SELECT
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_insert ON "mcp_connections";
  CREATE POLICY tenant_isolation_insert ON "mcp_connections"
    FOR INSERT
    WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_update ON "mcp_connections";
  CREATE POLICY tenant_isolation_update ON "mcp_connections"
    FOR UPDATE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_isolation_delete ON "mcp_connections";
  CREATE POLICY tenant_isolation_delete ON "mcp_connections"
    FOR DELETE
    USING (store_domain = current_setting('app.current_store_domain', true));

  DROP POLICY IF EXISTS tenant_bypass_owner ON "mcp_connections";
  CREATE POLICY tenant_bypass_owner ON "mcp_connections"
    FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'on')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'on');

END $$;

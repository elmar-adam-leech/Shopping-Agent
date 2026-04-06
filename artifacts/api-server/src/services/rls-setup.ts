interface PoolLike {
  connect(): Promise<{ query(sql: string): Promise<unknown>; release(): void }>;
}

const RLS_TABLES = [
  "conversations",
  "sessions",
  "analytics_logs",
  "shop_knowledge",
  "user_preferences",
  "mcp_connections",
];

const SETUP_SQL = `
DO $$ BEGIN
  ${RLS_TABLES.map(
    (table) => `
    ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_select ON "${table}";
    CREATE POLICY tenant_isolation_select ON "${table}"
      FOR SELECT
      USING (store_domain = current_setting('app.current_store_domain', true));

    DROP POLICY IF EXISTS tenant_isolation_insert ON "${table}";
    CREATE POLICY tenant_isolation_insert ON "${table}"
      FOR INSERT
      WITH CHECK (store_domain = current_setting('app.current_store_domain', true));

    DROP POLICY IF EXISTS tenant_isolation_update ON "${table}";
    CREATE POLICY tenant_isolation_update ON "${table}"
      FOR UPDATE
      USING (store_domain = current_setting('app.current_store_domain', true));

    DROP POLICY IF EXISTS tenant_isolation_delete ON "${table}";
    CREATE POLICY tenant_isolation_delete ON "${table}"
      FOR DELETE
      USING (store_domain = current_setting('app.current_store_domain', true));

    DROP POLICY IF EXISTS tenant_bypass_owner ON "${table}";
    CREATE POLICY tenant_bypass_owner ON "${table}"
      FOR ALL
      USING (current_setting('app.rls_bypass', true) = 'on')
      WITH CHECK (current_setting('app.rls_bypass', true) = 'on');
  `
  ).join("\n")}
END $$;
`;

export async function applyRlsPolicies(dbPool: PoolLike): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query(SETUP_SQL);
    console.log("[rls-setup] RLS policies applied successfully to tables:", RLS_TABLES.join(", "));
  } catch (err) {
    console.error("[rls-setup] Failed to apply RLS policies:", err instanceof Error ? err.message : err);
    throw err;
  } finally {
    client.release();
  }
}

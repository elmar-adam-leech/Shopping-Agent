interface PoolLike {
  connect(): Promise<{ query(sql: string): Promise<unknown>; release(): void }>;
}

const ENSURE_SCHEMA_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experiment_status') THEN
    CREATE TYPE experiment_status AS ENUM ('active', 'completed', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS prompt_experiments (
  id TEXT PRIMARY KEY,
  store_domain TEXT NOT NULL REFERENCES stores(store_domain) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  split_ratio INTEGER NOT NULL DEFAULT 50,
  status experiment_status NOT NULL DEFAULT 'active',
  winner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'experiment_id'
  ) THEN
    ALTER TABLE sessions ADD COLUMN experiment_id TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'experiment_variant'
  ) THEN
    ALTER TABLE sessions ADD COLUMN experiment_variant TEXT;
  END IF;
END $$;
`;

const RLS_TABLES = [
  "conversations",
  "sessions",
  "analytics_logs",
  "shop_knowledge",
  "user_preferences",
  "mcp_connections",
  "user_consents",
  "prompt_experiments",
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
    await client.query(ENSURE_SCHEMA_SQL);
    console.log("[rls-setup] Schema ensured for prompt_experiments and session columns");
    await client.query(SETUP_SQL);
    console.log("[rls-setup] RLS policies applied successfully to tables:", RLS_TABLES.join(", "));
  } catch (err) {
    console.error("[rls-setup] Failed to apply RLS policies:", err instanceof Error ? err.message : err);
    throw err;
  } finally {
    client.release();
  }
}

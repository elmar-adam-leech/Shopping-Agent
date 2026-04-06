import { execSync } from "child_process";
import app from "./app";
import { startDbMaintenance, stopDbMaintenance, waitForMaintenance } from "./services/db-maintenance";
import { backfillMessageCounts } from "./services/db-backfill";
import { pool } from "@workspace/db";
import { applyRlsPolicies } from "./services/rls-setup";
import { gracefulShutdown } from "./services/shutdown";

async function start() {
  try {
    console.log("Running database migrations...");
    execSync("pnpm --filter @workspace/db run push-force", {
      stdio: "inherit",
      cwd: process.env["REPL_HOME"] || process.cwd(),
      timeout: 30_000,
    });
    console.log("Database migrations complete.");
  } catch (err) {
    console.warn("Database migration warning (may be interactive prompt):", err instanceof Error ? err.message : "timeout or error");
    console.log("Continuing with existing schema...");
  }

  try {
    await applyRlsPolicies(pool);
  } catch (err) {
    console.error("RLS policy migration failed:", err);
    process.exit(1);
  }

  await backfillMessageCounts();

  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  if (process.env.DEV_AUTH_SECRET && process.env.NODE_ENV !== "development") {
    console.warn("[security] DEV_AUTH_SECRET is set in a non-development environment. This endpoint should not be accessible in production.");
  }

  const replitAppUrl = process.env.REPLIT_APP_URL;
  if (!replitAppUrl) {
    console.warn("[customer-account-mcp] REPLIT_APP_URL is not set. OAuth callbacks for Customer Account MCP will fail. Set this to your app's public URL.");
  }

  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    startDbMaintenance();
  });

  const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || "10000", 10);

  const handleShutdown = (signal: string) => {
    console.log(`[shutdown] Received ${signal}`);
    gracefulShutdown(server, async () => {
      stopDbMaintenance();
      console.log("[shutdown] Waiting for in-flight maintenance to complete...");
      await waitForMaintenance();
      console.log("[shutdown] Closing database pool...");
      await pool.end();
      console.log("[shutdown] Database pool closed.");
    }, shutdownTimeoutMs);
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

start();

import { execSync } from "child_process";
import app from "./app";
import { startDbMaintenance } from "./services/db-maintenance";

async function start() {
  try {
    console.log("Running database migrations...");
    execSync("pnpm --filter @workspace/db run push", {
      stdio: "inherit",
      cwd: process.env["REPL_HOME"] || process.cwd(),
    });
    console.log("Database migrations complete.");
  } catch (err) {
    console.error("Database migration failed:", err);
    process.exit(1);
  }

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

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    startDbMaintenance();
  });
}

start();

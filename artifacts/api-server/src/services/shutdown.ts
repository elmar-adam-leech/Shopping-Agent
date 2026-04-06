import type { Response } from "express";
import type { Server } from "http";

const activeSSEConnections = new Set<Response>();
let isShuttingDown = false;

export function trackSSEConnection(res: Response): void {
  activeSSEConnections.add(res);
  res.on("close", () => {
    activeSSEConnections.delete(res);
  });
}

export function getActiveSSECount(): number {
  return activeSSEConnections.size;
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

export function drainSSEConnections(): void {
  for (const res of activeSSEConnections) {
    try {
      res.write(`data: ${JSON.stringify({ type: "error", data: "Server is restarting. Please retry your request." })}\n\n`);
      res.end();
    } catch {
    }
  }
  activeSSEConnections.clear();
}

export function gracefulShutdown(
  server: Server,
  onCleanup: () => Promise<void>,
  timeoutMs = 10_000
): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("[shutdown] Graceful shutdown initiated, stopping new connections...");

  drainSSEConnections();
  console.log("[shutdown] SSE connections drained.");

  let cleanupDone = false;

  const runCleanup = async () => {
    if (cleanupDone) return;
    cleanupDone = true;

    try {
      await onCleanup();
    } catch (err) {
      console.error("[shutdown] Cleanup error:", err instanceof Error ? err.message : err);
    }

    console.log("[shutdown] Shutdown complete, exiting.");
    process.exit(0);
  };

  const forceTimer = setTimeout(() => {
    console.warn(`[shutdown] Graceful shutdown timed out after ${timeoutMs}ms, forcing exit.`);
    process.exit(1);
  }, timeoutMs);

  server.close(() => {
    console.log("[shutdown] All connections closed.");
    clearTimeout(forceTimer);
    runCleanup();
  });
}

import { Router, type IRouter, type Request, type Response } from "express";
import { validateStoreDomain, loadFullStore } from "../middleware";
import { validateSession } from "../middleware";
import { sendError } from "../lib/error-response";
import {
  discoverCustomerAccountMCP,
  resolveClientId,
  initiateOAuth,
  handleOAuthCallback,
  revokeConnection,
  getActiveConnection,
} from "../services/customer-account-mcp";

const router: IRouter = Router();

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

router.get(
  "/stores/:storeDomain/mcp/discover",
  validateStoreDomain,
  validateSession,
  async (req: Request, res: Response): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    const sessionId = (req as Request & { validatedSessionId: string }).validatedSessionId;

    try {
      const discovery = await discoverCustomerAccountMCP(storeDomain);
      if (!discovery) {
        res.json({
          available: false,
          connected: false,
        });
        return;
      }

      const connection = await getActiveConnection(storeDomain, sessionId);

      res.json({
        available: true,
        connected: !!connection,
        mcpApiUrl: discovery.mcp_api,
      });
    } catch (err) {
      console.error(`[mcp-discover] Error for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to discover MCP endpoints");
    }
  }
);

router.post(
  "/stores/:storeDomain/mcp/connect",
  validateStoreDomain,
  validateSession,
  async (req: Request, res: Response): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    const sessionId = (req as Request & { validatedSessionId: string }).validatedSessionId;

    const rateLimitKey = `${storeDomain}:${sessionId}`;
    if (!checkRateLimit(rateLimitKey)) {
      sendError(res, 429, "Too many connection attempts. Please wait a moment.");
      return;
    }

    try {
      const store = req.store ?? await loadFullStore(storeDomain);
      if (!store) {
        sendError(res, 404, "Store not found");
        return;
      }

      const discovery = await discoverCustomerAccountMCP(storeDomain);
      if (!discovery) {
        sendError(res, 404, "Customer Accounts MCP is not available for this store");
        return;
      }

      const clientId = resolveClientId(store);
      if (!clientId) {
        sendError(res, 400, "No Customer Account API client ID configured");
        return;
      }

      const result = await initiateOAuth(storeDomain, sessionId, clientId, discovery);
      res.json({ authorizationUrl: result.authorizationUrl });
    } catch (err) {
      console.error(`[mcp-connect] Error for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to initiate OAuth flow");
    }
  }
);

router.get("/auth/mcp/callback", async (req: Request, res: Response): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  if (error) {
    console.warn(`[mcp-callback] OAuth error: ${error}`);
    res.status(400).send(renderCallbackPage(false, "", error));
    return;
  }

  if (!code || !state) {
    res.status(400).send(renderCallbackPage(false, "", "Missing required parameters"));
    return;
  }

  try {
    const { storeDomain } = await handleOAuthCallback(code, state);
    res.send(renderCallbackPage(true, storeDomain));
  } catch (err) {
    console.error("[mcp-callback] Error:", err instanceof Error ? err.message : err);
    res.status(400).send(renderCallbackPage(false, "", err instanceof Error ? err.message : "OAuth callback failed"));
  }
});

router.delete(
  "/stores/:storeDomain/mcp/connection",
  validateStoreDomain,
  validateSession,
  async (req: Request, res: Response): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    const sessionId = (req as Request & { validatedSessionId: string }).validatedSessionId;

    try {
      const revoked = await revokeConnection(storeDomain, sessionId);
      if (revoked) {
        res.json({ success: true });
      } else {
        sendError(res, 404, "No active connection found");
      }
    } catch (err) {
      console.error(`[mcp-revoke] Error for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to revoke connection");
    }
  }
);

function renderCallbackPage(success: boolean, storeDomain: string, errorMessage?: string): string {
  const appUrl = process.env.REPLIT_APP_URL || "";
  let targetOrigin = "*";
  try {
    if (appUrl) targetOrigin = new URL(appUrl).origin;
  } catch {
  }

  const dataPayload = JSON.stringify({
    success,
    storeDomain,
    error: errorMessage || "Unknown error",
    targetOrigin,
  }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html>
<head><title>Customer Account Connection</title></head>
<body>
<p id="status"></p>
<script>
  var data = ${dataPayload};
  document.getElementById('status').textContent = data.success
    ? 'Connected successfully! This window will close automatically.'
    : 'Error: ' + data.error;
  try {
    if (window.opener) {
      var msg = data.success
        ? { type: 'mcp-connected', storeDomain: data.storeDomain }
        : { type: 'mcp-error', error: data.error };
      window.opener.postMessage(msg, data.targetOrigin);
    }
  } catch (e) {}
  setTimeout(function() { window.close(); }, 1500);
</script>
</body>
</html>`;
}

export default router;

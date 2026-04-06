import { Router, type IRouter } from "express";
import { validateStoreDomain, validateSession } from "../middleware";
import { checkForAbandonedCheckout, logRecoveryEvent } from "../services/checkout-recovery-service";
import { sendError } from "../lib/error-response";

const router: IRouter = Router();

router.get("/stores/:storeDomain/checkout-recovery", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = (req as unknown as { validatedSessionId: string }).validatedSessionId;

  try {
    const recoveryData = await checkForAbandonedCheckout(storeDomain, sessionId);

    if (recoveryData.hasAbandonedCheckout) {
      await logRecoveryEvent(storeDomain, sessionId, "prompted", {
        cartItemCount: recoveryData.cartItems?.length ?? 0,
        cartTotal: recoveryData.cartTotal ?? 0,
      });
    }

    res.json(recoveryData);
  } catch (err) {
    console.error(`[checkout-recovery] Error checking abandoned checkout for store="${storeDomain}":`, err instanceof Error ? err.message : err);
    sendError(res, 500, "Failed to check for abandoned checkout");
  }
});

router.post("/stores/:storeDomain/checkout-recovery/action", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = (req as unknown as { validatedSessionId: string }).validatedSessionId;

  const { action, metadata } = req.body as {
    sessionId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  };

  const validActions = ["resumed", "dismissed", "converted"];
  if (!action || !validActions.includes(action)) {
    sendError(res, 400, "Invalid action. Must be one of: resumed, dismissed, converted");
    return;
  }

  try {
    await logRecoveryEvent(storeDomain, sessionId, action as "resumed" | "dismissed" | "converted", metadata);
    res.json({ success: true });
  } catch (err) {
    console.error(`[checkout-recovery] Error logging recovery action for store="${storeDomain}":`, err instanceof Error ? err.message : err);
    sendError(res, 500, "Failed to record recovery action");
  }
});

export default router;

import { Router, type IRouter } from "express";
import { validateStoreDomain, loadFullStore, validateSession } from "../middleware";
import { callTool } from "../services/mcp-client";
import { sendError } from "../lib/error-response";

const router: IRouter = Router();

router.post("/stores/:storeDomain/cart/quick-add", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const store = req.store ?? await loadFullStore(storeDomain);

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  if (!store.storefrontToken) {
    sendError(res, 400, "Store has no Storefront Access Token configured.");
    return;
  }

  const { variantId, cartId, quantity } = req.body as {
    variantId?: string;
    cartId?: string;
    quantity?: number;
  };

  if (!variantId || typeof variantId !== "string") {
    sendError(res, 400, "variantId is required");
    return;
  }

  const qty = typeof quantity === "number" && quantity > 0 ? quantity : 1;

  try {
    let activeCartId = cartId;

    if (!activeCartId) {
      const createResult = await callTool(
        store.storeDomain,
        store.storefrontToken,
        "create_cart",
        { lines: [{ merchandiseId: variantId, quantity: qty }] },
        !!store.ucpCompliant,
      );

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(createResult);
      } catch {
        // not JSON
      }

      if (parsed && parsed.error) {
        sendError(res, 502, `Failed to create cart: ${parsed.error}`);
        return;
      }

      res.json({ success: true, result: createResult, action: "created_cart" });
      return;
    }

    const addResult = await callTool(
      store.storeDomain,
      store.storefrontToken,
      "add_to_cart",
      { cartId: activeCartId, lines: [{ merchandiseId: variantId, quantity: qty }] },
      !!store.ucpCompliant,
    );

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(addResult);
    } catch {
      // not JSON
    }

    if (parsed && parsed.error) {
      sendError(res, 502, `Failed to add to cart: ${parsed.error}`);
      return;
    }

    res.json({ success: true, result: addResult, action: "added_to_cart" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cart] quick-add error for ${storeDomain}:`, message);
    sendError(res, 500, "Failed to add item to cart. Please try again.");
  }
});

export default router;

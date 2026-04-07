import { eq, and } from "drizzle-orm";
import { db, wishlistsTable } from "@workspace/db";
import type { WishlistItem } from "@workspace/db/schema";

const MAX_WISHLIST_ITEMS = 50;

export async function getWishlist(storeDomain: string, sessionId: string): Promise<WishlistItem[]> {
  const [row] = await db
    .select()
    .from(wishlistsTable)
    .where(
      and(
        eq(wishlistsTable.storeDomain, storeDomain),
        eq(wishlistsTable.sessionId, sessionId)
      )
    );

  if (!row?.items || !Array.isArray(row.items)) return [];
  return row.items as WishlistItem[];
}

export async function addToWishlist(
  storeDomain: string,
  sessionId: string,
  item: WishlistItem
): Promise<{ items: WishlistItem[]; added: boolean }> {
  const existing = await getWishlist(storeDomain, sessionId);

  const alreadyExists = existing.some(
    (i) => i.productId === item.productId && (!item.variantId || i.variantId === item.variantId)
  );

  if (alreadyExists) {
    return { items: existing, added: false };
  }

  if (existing.length >= MAX_WISHLIST_ITEMS) {
    return { items: existing, added: false };
  }

  const updated = [...existing, { ...item, addedAt: item.addedAt || new Date().toISOString() }];

  await db
    .insert(wishlistsTable)
    .values({
      storeDomain,
      sessionId,
      items: updated,
    })
    .onConflictDoUpdate({
      target: [wishlistsTable.storeDomain, wishlistsTable.sessionId],
      set: { items: updated, updatedAt: new Date() },
    });

  return { items: updated, added: true };
}

export async function removeFromWishlist(
  storeDomain: string,
  sessionId: string,
  productId: string
): Promise<{ items: WishlistItem[]; removed: boolean; removedTitle?: string }> {
  const existing = await getWishlist(storeDomain, sessionId);

  const itemToRemove = existing.find((i) => i.productId === productId || i.handle === productId);
  if (!itemToRemove) {
    return { items: existing, removed: false };
  }

  const updated = existing.filter((i) => i !== itemToRemove);

  await db
    .insert(wishlistsTable)
    .values({
      storeDomain,
      sessionId,
      items: updated,
    })
    .onConflictDoUpdate({
      target: [wishlistsTable.storeDomain, wishlistsTable.sessionId],
      set: { items: updated, updatedAt: new Date() },
    });

  return { items: updated, removed: true, removedTitle: itemToRemove.title };
}

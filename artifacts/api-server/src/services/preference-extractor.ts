import { eq, and } from "drizzle-orm";
import { db, userPreferencesTable } from "@workspace/db";

const PREFERENCE_PATTERNS: Array<{
  pattern: RegExp;
  key: string;
  extract: (match: RegExpMatchArray) => string;
}> = [
  { pattern: /(?:i(?:'m| am) (?:a )?size |my size is |i wear (?:a )?size |i wear )(xs|s|m|l|xl|xxl|xxxl|\d+)/i, key: "topSize", extract: (m) => m[1].toUpperCase() },
  { pattern: /(?:shoe size|foot size)(?:\s+is)?\s+(\d+(?:\.\d+)?)/i, key: "shoeSize", extract: (m) => m[1] },
  { pattern: /(?:waist|bottom|pants?)(?:\s+size)?(?:\s+is)?\s+(\d+(?:\s*x\s*\d+)?)/i, key: "bottomSize", extract: (m) => m[1] },
  { pattern: /(?:i (?:prefer|like|love|want) )?(organic cotton|cotton|silk|linen|wool|cashmere|polyester|denim|leather|suede|synthetic|hemp|bamboo)/i, key: "materials", extract: (m) => m[1].toLowerCase() },
  { pattern: /(?:budget|spend|price range)(?:\s+is)?(?:\s+around)?\s+\$?(\d+(?:\s*-\s*\$?\d+)?)/i, key: "budget", extract: (m) => m[1] },
  { pattern: /(?:favo(?:u)?rite colo(?:u)?r|i (?:prefer|like|love) (?:the colo(?:u)?r )?)(black|white|red|blue|green|navy|grey|gray|pink|purple|beige|brown|cream|ivory|olive|burgundy|teal|coral|mustard)/i, key: "colors", extract: (m) => m[1].toLowerCase() },
  { pattern: /(?:i(?:'m| am) )?(vegan|vegetarian|eco-friendly|sustainable|organic|cruelty-free|fair trade|zero waste)/i, key: "lifestyle", extract: (m) => m[1].toLowerCase() },
];

export function extractPreferencesFromText(text: string): Record<string, string> {
  const extracted: Record<string, string> = {};

  for (const { pattern, key, extract } of PREFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      extracted[key] = extract(match);
    }
  }

  return extracted;
}

export async function extractAndSavePreferences(
  storeDomain: string,
  sessionId: string,
  userMessage: string,
  assistantMessage: string
): Promise<Record<string, string> | null> {
  const extracted = extractPreferencesFromText(userMessage);

  if (Object.keys(extracted).length === 0) {
    return null;
  }

  try {
    const [existing] = await db
      .select()
      .from(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.storeDomain, storeDomain),
          eq(userPreferencesTable.sessionId, sessionId)
        )
      );

    const currentPrefs = (existing?.prefs ?? {}) as Record<string, unknown>;

    const mergedPrefs: Record<string, unknown> = { ...currentPrefs };
    for (const [key, value] of Object.entries(extracted)) {
      const existing = currentPrefs[key];
      if (typeof existing === "string" && (key === "materials" || key === "colors" || key === "brands")) {
        const existingItems = existing.split(",").map(s => s.trim().toLowerCase());
        if (!existingItems.includes(value.toLowerCase())) {
          mergedPrefs[key] = `${existing}, ${value}`;
        }
      } else {
        mergedPrefs[key] = value;
      }
    }

    await db
      .insert(userPreferencesTable)
      .values({
        storeDomain,
        sessionId,
        prefs: mergedPrefs,
      })
      .onConflictDoUpdate({
        target: [userPreferencesTable.storeDomain, userPreferencesTable.sessionId],
        set: { prefs: mergedPrefs, updatedAt: new Date() },
      });

    return extracted;
  } catch (err) {
    console.error("[preference-extractor] Failed to save extracted preferences:", err instanceof Error ? err.message : err);
    return null;
  }
}

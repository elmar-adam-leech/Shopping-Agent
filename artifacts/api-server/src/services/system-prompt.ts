import type { ShopKnowledge } from "@workspace/db";
import type { BrandVoice } from "@workspace/db/schema";
import type { UCPDiscoveryDocument } from "./ucp-client";
import { extractAllCapabilities, generateToolsFromCapabilities } from "./ucp-client";

const UCP_SAFE_PATTERN = /^[a-zA-Z0-9._\-: ]{1,100}$/;

function sanitizeUCPValue(value: string, maxLen = 100): string {
  const trimmed = value.slice(0, maxLen).replace(/[\r\n\t]/g, " ").trim();
  if (UCP_SAFE_PATTERN.test(trimmed)) return trimmed;
  return trimmed.replace(/[^a-zA-Z0-9._\-: ]/g, "");
}

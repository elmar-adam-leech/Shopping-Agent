import type { MCPTool } from "./mcp-client";
import { fetchMCPTools } from "./mcp-client";
import {
  discoverUCPCapabilities,
  generateToolsFromCapabilities,
  getUCPToolNames,
  logNegotiationResult,
  type UCPDiscoveryDocument,
  type UCPNegotiationResult,
} from "./ucp-client";
import { db } from "@workspace/db";
import { analyticsLogsTable } from "@workspace/db/schema";

async function logNegotiationToAnalytics(result: UCPNegotiationResult): Promise<void> {
  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain: result.storeDomain,
      eventType: "ucp_negotiation",
      metadata: {
        success: result.success,
        version: result.version ?? null,
        source: result.source,
        servicesCount: result.servicesCount,
        capabilitiesFound: result.capabilitiesFound,
        paymentMethodsFound: result.paymentMethodsFound,
        error: result.error ?? null,
      },
    });
  } catch (err) {
    console.warn(`[tool-registry] Failed to log UCP negotiation analytics:`, err instanceof Error ? err.message : err);
  }
}

export async function listTools(
  storeDomain: string,
  storefrontToken: string,
  ucpEnabled: boolean = true
): Promise<{ tools: MCPTool[]; ucpDoc: UCPDiscoveryDocument | null; negotiation: UCPNegotiationResult | null }> {
  const [mcpToolsResult, ucpResult] = await Promise.all([
    fetchMCPTools(storeDomain, storefrontToken),
    ucpEnabled
      ? discoverUCPCapabilities(storeDomain)
      : Promise.resolve(null),
  ]);

  let mcpTools = [...mcpToolsResult];
  const ucpDoc = ucpResult?.doc ?? null;
  const negotiation = ucpResult?.negotiation ?? null;

  if (negotiation) {
    logNegotiationResult(negotiation);
    logNegotiationToAnalytics(negotiation);
  }

  if (ucpEnabled && ucpDoc) {
    const ucpTools = generateToolsFromCapabilities(ucpDoc);
    const existingNames = new Set(mcpTools.map(t => t.name));
    for (const tool of ucpTools) {
      if (!existingNames.has(tool.name)) {
        mcpTools.push(tool);
      }
    }
  } else if (!ucpEnabled) {
    const ucpToolNameSet = getUCPToolNames();
    mcpTools = mcpTools.filter(t => !ucpToolNameSet.has(t.name));
  }

  return { tools: mcpTools, ucpDoc, negotiation };
}

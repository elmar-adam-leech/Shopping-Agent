import type { MCPTool } from "./mcp-client";
import { fetchMCPTools } from "./mcp-client";
import { discoverUCPCapabilities, getUCPTools, getUCPToolsForCapabilities, type UCPDiscoveryDocument } from "./ucp-client";

export async function listTools(storeDomain: string, storefrontToken: string, ucpEnabled: boolean = true): Promise<{ tools: MCPTool[]; ucpDoc: UCPDiscoveryDocument | null }> {
  const [mcpToolsResult, ucpDocResult] = await Promise.all([
    fetchMCPTools(storeDomain, storefrontToken),
    ucpEnabled ? discoverUCPCapabilities(storeDomain) : Promise.resolve(null),
  ]);

  let mcpTools = [...mcpToolsResult];
  const ucpDoc = ucpDocResult;
  const ucpToolNames = new Set(getUCPTools().map(t => t.name));

  if (ucpEnabled && ucpDoc) {
    const ucpTools = getUCPToolsForCapabilities(ucpDoc);
    const existingNames = new Set(mcpTools.map(t => t.name));
    for (const tool of ucpTools) {
      if (!existingNames.has(tool.name)) {
        mcpTools.push(tool);
      }
    }
  } else if (!ucpEnabled) {
    mcpTools = mcpTools.filter(t => !ucpToolNames.has(t.name));
  }

  return { tools: mcpTools, ucpDoc };
}

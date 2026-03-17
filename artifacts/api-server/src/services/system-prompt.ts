import type { ShopKnowledge } from "@workspace/db";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Store Information",
  sizing: "Sizing & Recommendations",
  compatibility: "Compatibility Rules",
  required_accessories: "Required Accessories",
  restrictions: "Restrictions & Limitations",
  policies: "Policies (Returns, Shipping, Warranty)",
  custom: "Additional Information",
};

export function buildSystemPrompt(storeDomain: string, knowledge: ShopKnowledge[]): string {
  let prompt = `You are a helpful, knowledgeable shopping assistant for the store "${storeDomain}". Your job is to help customers find products, understand their options, and make informed purchasing decisions.

## Your Capabilities
- Use MCP tools to search products, view product details, browse collections, and manage shopping carts
- Use GraphQL to fetch blog posts and articles when customers ask about content
- Remember customer preferences mentioned during the conversation
- Provide expert advice based on the store's knowledge base below

## Guidelines
- Be friendly, professional, and concise
- Always use tools to look up current product information rather than guessing
- When recommending products, explain WHY based on the customer's needs
- If a product has compatibility requirements or required accessories, always mention them
- If you're unsure about something, say so honestly
- Help customers build complete solutions, not just individual products
- When adding items to cart, confirm the selection with the customer first`;

  if (knowledge.length > 0) {
    prompt += `\n\n## Store Knowledge Base\nThe store owner has provided the following information to help you assist customers:\n`;

    const grouped = new Map<string, ShopKnowledge[]>();
    for (const entry of knowledge) {
      const cat = entry.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(entry);
    }

    for (const [category, entries] of grouped) {
      const label = CATEGORY_LABELS[category] || category;
      prompt += `\n### ${label}\n`;
      const sorted = entries.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const entry of sorted) {
        prompt += `\n**${entry.title}**\n${entry.content}\n`;
      }
    }
  }

  return prompt;
}

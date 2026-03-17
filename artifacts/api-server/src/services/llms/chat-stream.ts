import OpenAI from "openai";
import type { LLMMessage, LLMStreamEvent, MCPToolDef } from "./types";

export async function* streamChatWithOpenAISDK(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  baseURL?: string,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  const openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool" as const, content: m.content, tool_call_id: m.tool_call_id || "" };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  let continueLoop = true;

  while (continueLoop) {
    if (signal?.aborted) return;
    continueLoop = false;

    const stream = await client.chat.completions.create({
      model,
      messages: allMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      stream: true,
    }, { signal });

    interface ToolCallAccumulator {
      id: string;
      function: { name: string; arguments: string };
    }

    const currentToolCalls: ToolCallAccumulator[] = [];
    let assistantContent = "";

    for await (const chunk of stream) {
      if (signal?.aborted) return;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantContent += delta.content;
        yield { type: "text", data: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!currentToolCalls[tc.index]) {
              currentToolCalls[tc.index] = { id: "", function: { name: "", arguments: "" } };
            }
            if (tc.id) currentToolCalls[tc.index].id = tc.id;
            if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }
    }

    if (currentToolCalls.length > 0) {
      allMessages.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: currentToolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const tc of currentToolCalls) {
        yield { type: "tool_call", data: { id: tc.id, name: tc.function.name, arguments: tc.function.arguments } };
      }

      const toolResultPromises = currentToolCalls.map(async (tc) => {
        try {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const result = await onToolCall(tc.function.name, args);
          return { id: tc.id, content: result, error: false };
        } catch (err: unknown) {
          const errorMsg = `Error: ${err instanceof Error ? err.message : "Unknown error"}`;
          return { id: tc.id, content: errorMsg, error: true };
        }
      });

      const toolResults = await Promise.all(toolResultPromises);

      for (const result of toolResults) {
        yield { type: "tool_result", data: { toolCallId: result.id, content: result.content } };
        allMessages.push({ role: "tool", tool_call_id: result.id, content: result.content });
      }

      continueLoop = true;
    }
  }

  yield { type: "done", data: null };
}

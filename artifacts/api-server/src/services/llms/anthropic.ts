import Anthropic from "@anthropic-ai/sdk";
import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./openai";

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: "text";
  text: string;
}

type ContentBlock = ToolUseBlock | TextBlock;

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  const client = new Anthropic({ apiKey });

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: "object" as const, ...t.inputSchema },
  }));

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: m.tool_call_id || "",
              content: m.content,
            },
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });

  let continueLoop = true;

  while (continueLoop) {
    if (signal?.aborted) return;
    continueLoop = false;

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    }, { signal });

    let currentToolUse: { id: string; name: string; input: string } | null = null;
    let assistantText = "";
    const contentBlocks: ContentBlock[] = [];

    for await (const event of stream) {
      if (signal?.aborted) return;
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: "" };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          assistantText += event.delta.text;
          yield { type: "text", data: event.delta.text };
        } else if (event.delta.type === "input_json_delta" && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolUse) {
          contentBlocks.push({
            type: "tool_use",
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: JSON.parse(currentToolUse.input || "{}") as Record<string, unknown>,
          });
          currentToolUse = null;
        } else if (assistantText) {
          contentBlocks.push({ type: "text", text: assistantText });
        }
      } else if (event.type === "message_stop") {
        break;
      }
    }

    const toolUseBlocks = contentBlocks.filter((b): b is ToolUseBlock => b.type === "tool_use");

    if (toolUseBlocks.length > 0) {
      anthropicMessages.push({ role: "assistant", content: contentBlocks });

      for (const tu of toolUseBlocks) {
        yield { type: "tool_call", data: { id: tu.id, name: tu.name, arguments: JSON.stringify(tu.input) } };
      }

      const toolResultPromises = toolUseBlocks.map(async (tu) => {
        try {
          const result = await onToolCall(tu.name, tu.input);
          return { type: "tool_result" as const, tool_use_id: tu.id, content: result, error: false };
        } catch (err: unknown) {
          const errorMsg = `Error: ${err instanceof Error ? err.message : "Unknown error"}`;
          return { type: "tool_result" as const, tool_use_id: tu.id, content: errorMsg, error: true };
        }
      });

      const toolResults = await Promise.all(toolResultPromises);

      for (const result of toolResults) {
        yield { type: "tool_result", data: { toolCallId: result.tool_use_id, content: result.content } };
      }

      anthropicMessages.push({
        role: "user",
        content: toolResults.map(r => ({ type: "tool_result" as const, tool_use_id: r.tool_use_id, content: r.content })),
      });
      continueLoop = true;
      assistantText = "";
    }
  }

  yield { type: "done", data: null };
}

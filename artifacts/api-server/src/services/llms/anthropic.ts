import Anthropic from "@anthropic-ai/sdk";
import type { LLMStreamEvent, LLMMessage } from "./openai";

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: any[],
  onToolCall: (name: string, args: any) => Promise<string>
): AsyncGenerator<LLMStreamEvent> {
  const client = new Anthropic({ apiKey });

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
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
    continueLoop = false;

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    let currentToolUse: { id: string; name: string; input: string } | null = null;
    let assistantText = "";
    const contentBlocks: any[] = [];

    for await (const event of stream) {
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
            input: JSON.parse(currentToolUse.input || "{}"),
          });
          currentToolUse = null;
        } else if (assistantText) {
          contentBlocks.push({ type: "text", text: assistantText });
        }
      } else if (event.type === "message_stop") {
        break;
      }
    }

    const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length > 0) {
      anthropicMessages.push({ role: "assistant", content: contentBlocks });

      const toolResults: any[] = [];
      for (const tu of toolUseBlocks) {
        yield { type: "tool_call", data: { id: tu.id, name: tu.name, arguments: JSON.stringify(tu.input) } };

        try {
          const result = await onToolCall(tu.name, tu.input);
          yield { type: "tool_result", data: { toolCallId: tu.id, content: result } };
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
        } catch (err: any) {
          const errorMsg = `Error: ${err.message}`;
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: errorMsg });
          yield { type: "tool_result", data: { toolCallId: tu.id, content: errorMsg } };
        }
      }

      anthropicMessages.push({ role: "user", content: toolResults });
      continueLoop = true;
      assistantText = "";
    }
  }

  yield { type: "done", data: null };
}

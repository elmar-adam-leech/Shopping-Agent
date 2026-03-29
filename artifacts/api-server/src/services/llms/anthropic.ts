import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./types";
import { streamChat as streamChatEngine, type ProviderAdapter, type ProviderRequest, type SSEEvent } from "./chat-stream";

interface AnthropicContentBlock {
  type: "tool_use" | "text";
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
}

interface AnthropicAssistantState {
  text: string;
  contentBlocks: AnthropicContentBlock[];
  currentToolUse: { id: string; name: string; input: string } | null;
}

function createAnthropicAdapter(): ProviderAdapter {
  return {
    formatRequest(apiKey, model, systemPrompt, messages, tools): ProviderRequest {
      const anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: { type: "object" as const, ...t.inputSchema },
      }));

      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: anthropicTools.length > 0 ? anthropicTools : undefined,
          stream: true,
        }),
      };
    },

    parseSSEEvent(event: SSEEvent): LLMStreamEvent[] | null {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return null;
      }

      const eventType = data.type as string;

      if (eventType === "content_block_delta") {
        const delta = data.delta as Record<string, unknown>;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          return [{ type: "text", data: delta.text }];
        }
      }

      return null;
    },

    isDone(event: SSEEvent): boolean {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        return data.type === "message_stop";
      } catch {
        return false;
      }
    },

    formatMessages(_systemPrompt: string, messages: LLMMessage[]): unknown[] {
      return messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          if (m.role === "tool") {
            return {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: m.tool_call_id || "",
                  content: m.content,
                },
              ],
            };
          }
          return { role: m.role, content: m.content };
        });
    },

    createAssistantState(): AnthropicAssistantState {
      return { text: "", contentBlocks: [], currentToolUse: null };
    },

    /**
     * Accumulates streaming SSE events into the assistant state for Anthropic's Messages API.
     *
     * Anthropic streams content as a series of block-level events:
     * - "content_block_start": Signals a new content block (text or tool_use). For tool_use
     *   blocks, we initialize a currentToolUse accumulator to collect streamed JSON input.
     * - "content_block_delta": Delivers incremental content. Text deltas are appended to
     *   the running text, while input_json_delta fragments are concatenated into the
     *   currentToolUse's input string (Anthropic streams tool arguments as partial JSON).
     * - "content_block_stop": Finalizes the current block. For tool_use, the accumulated
     *   JSON input string is parsed into an object and pushed to contentBlocks. For text,
     *   the accumulated text is pushed as a text block. This allows getToolCalls() to later
     *   extract completed tool calls from contentBlocks.
     */
    accumulateAssistantState(state: unknown, event: SSEEvent): void {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      const s = state as AnthropicAssistantState;
      const eventType = data.type as string;

      if (eventType === "content_block_start") {
        const block = data.content_block as Record<string, unknown>;
        if (block?.type === "tool_use") {
          s.currentToolUse = {
            id: block.id as string,
            name: block.name as string,
            input: "",
          };
        }
      } else if (eventType === "content_block_delta") {
        const delta = data.delta as Record<string, unknown>;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          s.text += delta.text;
        } else if (delta?.type === "input_json_delta" && s.currentToolUse) {
          s.currentToolUse.input += delta.partial_json as string;
        }
      } else if (eventType === "content_block_stop") {
        if (s.currentToolUse) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(s.currentToolUse.input || "{}") as Record<string, unknown>;
          } catch {
            console.warn("[anthropic] Failed to parse tool input JSON, using empty object");
          }
          s.contentBlocks.push({
            type: "tool_use",
            id: s.currentToolUse.id,
            name: s.currentToolUse.name,
            input: parsedInput,
          });
          s.currentToolUse = null;
        } else if (s.text) {
          s.contentBlocks.push({ type: "text", text: s.text });
        }
      }
    },

    getToolCalls(state: unknown): Array<{ id: string; name: string; arguments: string }> {
      const s = state as AnthropicAssistantState;
      return s.contentBlocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          id: b.id!,
          name: b.name!,
          arguments: JSON.stringify(b.input),
        }));
    },

    appendAssistantAndToolResults(
      allMessages: unknown[],
      state: unknown,
      toolResults: Array<{ id: string; content: string; error: boolean }>
    ): void {
      const s = state as AnthropicAssistantState;
      const msgs = allMessages as Record<string, unknown>[];

      msgs.push({ role: "assistant", content: s.contentBlocks });

      msgs.push({
        role: "user",
        content: toolResults.map((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content: r.content,
          ...(r.error ? { is_error: true } : {}),
        })),
      });
    },
  };
}

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  const adapter = createAnthropicAdapter();
  yield* streamChatEngine(adapter, apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
}

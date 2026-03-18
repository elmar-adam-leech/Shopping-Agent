import type { LLMMessage, LLMStreamEvent, MCPToolDef } from "./types";
import type { ProviderAdapter, ProviderRequest, SSEEvent } from "./chat-stream";

interface ToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface ChunkDelta {
  content?: string;
  tool_calls?: ToolCallDelta[];
}

interface ChatChunk {
  choices: Array<{ delta: ChunkDelta }>;
}

interface ToolCallAccumulator {
  id: string;
  function: { name: string; arguments: string };
}

interface AssistantState {
  content: string;
  toolCalls: ToolCallAccumulator[];
}

export function createChatAdapter(baseURL: string): ProviderAdapter {
  return {
    formatRequest(apiKey, model, _systemPrompt, messages, tools): ProviderRequest {
      const formattedTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      return {
        url: `${baseURL}/chat/completions`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: formattedTools.length > 0 ? formattedTools : undefined,
          stream: true,
        }),
      };
    },

    parseSSEEvent(event: SSEEvent): LLMStreamEvent[] | null {
      if (event.data === "[DONE]") return null;
      let chunk: ChatChunk;
      try {
        chunk = JSON.parse(event.data) as ChatChunk;
      } catch (err) {
        console.warn("[chat-adapter] Failed to parse SSE event:", err instanceof Error ? err.message : err);
        return null;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return null;

      const events: LLMStreamEvent[] = [];
      if (delta.content) {
        events.push({ type: "text", data: delta.content });
      }
      return events.length > 0 ? events : null;
    },

    isDone(event: SSEEvent): boolean {
      return event.data === "[DONE]";
    },

    formatMessages(systemPrompt: string, messages: LLMMessage[]): unknown[] {
      return [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => {
          if (m.role === "tool") {
            return { role: "tool", content: m.content, tool_call_id: m.tool_call_id || "" };
          }
          if (m.role === "assistant" && m.tool_calls) {
            return { role: "assistant", content: m.content, tool_calls: m.tool_calls };
          }
          return { role: m.role, content: m.content };
        }),
      ];
    },

    createAssistantState(): AssistantState {
      return { content: "", toolCalls: [] };
    },

    accumulateAssistantState(state: unknown, event: SSEEvent): void {
      if (event.data === "[DONE]") return;
      let chunk: ChatChunk;
      try {
        chunk = JSON.parse(event.data) as ChatChunk;
      } catch (err) {
        console.warn("[chat-adapter] Failed to parse accumulated SSE event:", err instanceof Error ? err.message : err);
        return;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;

      const s = state as AssistantState;
      if (delta.content) s.content += delta.content;

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!s.toolCalls[tc.index]) {
              s.toolCalls[tc.index] = { id: "", function: { name: "", arguments: "" } };
            }
            if (tc.id) s.toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) s.toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) s.toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }
    },

    getToolCalls(state: unknown): Array<{ id: string; name: string; arguments: string }> {
      const s = state as AssistantState;
      return s.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    },

    appendAssistantAndToolResults(
      allMessages: unknown[],
      state: unknown,
      toolResults: Array<{ id: string; content: string; error: boolean }>
    ): void {
      const s = state as AssistantState;
      const msgs = allMessages as Record<string, unknown>[];

      msgs.push({
        role: "assistant",
        content: s.content || null,
        tool_calls: s.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const result of toolResults) {
        msgs.push({ role: "tool", tool_call_id: result.id, content: result.content });
      }
    },
  };
}

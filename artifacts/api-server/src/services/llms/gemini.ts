import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./types";
import { streamChat as streamChatEngine, type ProviderAdapter, type ProviderRequest, type SSEEvent } from "../chat-stream";

interface GeminiFunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface GeminiAssistantState {
  text: string;
  functionCalls: GeminiFunctionCall[];
}

function createGeminiAdapter(): ProviderAdapter {
  return {
    formatRequest(apiKey, model, systemPrompt, messages, tools): ProviderRequest {
      const functionDeclarations = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: { type: "object" as const, ...t.inputSchema },
      }));

      const body: Record<string, unknown> = {
        contents: messages,
        systemInstruction: { parts: [{ text: systemPrompt }] },
      };

      if (functionDeclarations.length > 0) {
        body.tools = [{ functionDeclarations }];
      }

      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };
    },

    parseSSEEvent(event: SSEEvent): LLMStreamEvent[] | null {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return null;
      }

      const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
      if (!candidates || candidates.length === 0) return null;

      const content = candidates[0].content as Record<string, unknown> | undefined;
      if (!content) return null;

      const parts = content.parts as Array<Record<string, unknown>> | undefined;
      if (!parts) return null;

      const events: LLMStreamEvent[] = [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text) {
          events.push({ type: "text", data: part.text });
        }
      }

      return events.length > 0 ? events : null;
    },

    isDone(_event: SSEEvent): boolean {
      return false;
    },

    formatMessages(_systemPrompt: string, messages: LLMMessage[]): unknown[] {
      const result: unknown[] = [];
      const idToName = new Map<string, string>();

      for (const m of messages) {
        if (m.role === "assistant" && m.tool_calls) {
          for (const tc of m.tool_calls) {
            idToName.set(tc.id, tc.function.name);
          }
        }
      }

      for (const m of messages) {
        if (m.role === "system") continue;

        if (m.role === "tool") {
          const callId = m.tool_call_id || "";
          result.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  id: callId,
                  name: idToName.get(callId) || callId,
                  response: { content: m.content },
                },
              },
            ],
          });
        } else if (m.role === "assistant") {
          const parts: unknown[] = [];
          if (m.content) {
            parts.push({ text: m.content });
          }
          if (m.tool_calls) {
            for (const tc of m.tool_calls) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
              } catch {
              }
              parts.push({
                functionCall: {
                  id: tc.id,
                  name: tc.function.name,
                  args,
                },
              });
            }
          }
          if (parts.length > 0) {
            result.push({ role: "model", parts });
          }
        } else {
          result.push({
            role: "user",
            parts: [{ text: m.content || "" }],
          });
        }
      }

      return result;
    },

    createAssistantState(): GeminiAssistantState {
      return { text: "", functionCalls: [] };
    },

    accumulateAssistantState(state: unknown, event: SSEEvent): void {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      const s = state as GeminiAssistantState;
      const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
      if (!candidates || candidates.length === 0) return;

      const content = candidates[0].content as Record<string, unknown> | undefined;
      if (!content) return;

      const parts = content.parts as Array<Record<string, unknown>> | undefined;
      if (!parts) return;

      for (const part of parts) {
        if (typeof part.text === "string") {
          s.text += part.text;
        }
        if (part.functionCall) {
          const fc = part.functionCall as Record<string, unknown>;
          const rawId = fc.id as string | undefined;
          const stableId = rawId || `gemini_call_${s.functionCalls.length}`;
          s.functionCalls.push({
            id: stableId,
            name: fc.name as string,
            args: (fc.args as Record<string, unknown>) || {},
          });
        }
      }
    },

    getToolCalls(state: unknown): Array<{ id: string; name: string; arguments: string }> {
      const s = state as GeminiAssistantState;
      return s.functionCalls.map((fc) => ({
        id: fc.id,
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      }));
    },

    appendAssistantAndToolResults(
      allMessages: unknown[],
      state: unknown,
      toolResults: Array<{ id: string; content: string; error: boolean }>
    ): void {
      const s = state as GeminiAssistantState;
      const msgs = allMessages as Record<string, unknown>[];

      const idToName = new Map<string, string>();
      for (const fc of s.functionCalls) {
        idToName.set(fc.id, fc.name);
      }

      const modelParts: unknown[] = [];
      if (s.text) {
        modelParts.push({ text: s.text });
      }
      for (const fc of s.functionCalls) {
        modelParts.push({
          functionCall: {
            id: fc.id,
            name: fc.name,
            args: fc.args,
          },
        });
      }
      msgs.push({ role: "model", parts: modelParts });

      const responseParts = toolResults.map((r) => ({
        functionResponse: {
          id: r.id,
          name: idToName.get(r.id) || "",
          response: { content: r.content },
        },
      }));
      msgs.push({ role: "user", parts: responseParts });
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
  const adapter = createGeminiAdapter();
  yield* streamChatEngine(adapter, apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
}

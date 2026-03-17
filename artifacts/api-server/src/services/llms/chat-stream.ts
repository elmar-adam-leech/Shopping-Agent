import type { LLMMessage, LLMStreamEvent, MCPToolDef } from "./types";

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let currentEvent: string | undefined;
  let currentData: string[] = [];
  let currentId: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line === "") {
          if (currentData.length > 0) {
            yield {
              event: currentEvent,
              data: currentData.join("\n"),
              id: currentId,
            };
          }
          currentEvent = undefined;
          currentData = [];
          currentId = undefined;
        } else if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const value = line.slice(5);
          currentData.push(value.startsWith(" ") ? value.slice(1) : value);
        } else if (line.startsWith("id:")) {
          currentId = line.slice(3).trim();
        }
      }
    }
    if (currentData.length > 0) {
      yield {
        event: currentEvent,
        data: currentData.join("\n"),
        id: currentId,
      };
    }
  } finally {
    reader.releaseLock();
  }
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProviderAdapter {
  formatRequest(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: unknown[],
    tools: MCPToolDef[]
  ): ProviderRequest;

  parseSSEEvent(event: SSEEvent): LLMStreamEvent[] | null;

  isDone(event: SSEEvent): boolean;

  formatMessages(
    systemPrompt: string,
    messages: LLMMessage[]
  ): unknown[];

  appendAssistantAndToolResults(
    allMessages: unknown[],
    assistantState: unknown,
    toolResults: Array<{ id: string; content: string; error: boolean }>
  ): void;

  createAssistantState(): unknown;

  accumulateAssistantState(state: unknown, event: SSEEvent): void;

  getToolCalls(
    state: unknown
  ): Array<{ id: string; name: string; arguments: string }>;
}

export async function* streamChat(
  adapter: ProviderAdapter,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  const allMessages = adapter.formatMessages(systemPrompt, messages);

  let continueLoop = true;

  while (continueLoop) {
    if (signal?.aborted) return;
    continueLoop = false;

    const req = adapter.formatRequest(apiKey, model, systemPrompt, allMessages, tools);

    const response = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      yield { type: "error", data: `API error ${response.status}: ${errorBody}` };
      return;
    }

    if (!response.body) {
      yield { type: "error", data: "No response body from API" };
      return;
    }

    const assistantState = adapter.createAssistantState();

    for await (const sseEvent of parseSSE(response.body)) {
      if (signal?.aborted) return;
      if (adapter.isDone(sseEvent)) break;

      adapter.accumulateAssistantState(assistantState, sseEvent);

      const events = adapter.parseSSEEvent(sseEvent);
      if (events) {
        for (const evt of events) {
          yield evt;
        }
      }
    }

    const toolCalls = adapter.getToolCalls(assistantState);

    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: "tool_call", data: { id: tc.id, name: tc.name, arguments: tc.arguments } };
      }

      const toolResultPromises = toolCalls.map(async (tc) => {
        try {
          const args = JSON.parse(tc.arguments) as Record<string, unknown>;
          const result = await onToolCall(tc.name, args);
          return { id: tc.id, content: result, error: false };
        } catch (err: unknown) {
          const errorMsg = `Error: ${err instanceof Error ? err.message : "Unknown error"}`;
          return { id: tc.id, content: errorMsg, error: true };
        }
      });

      const toolResults = await Promise.all(toolResultPromises);

      for (const result of toolResults) {
        yield { type: "tool_result", data: { toolCallId: result.id, content: result.content } };
      }

      adapter.appendAssistantAndToolResults(allMessages, assistantState, toolResults);
      continueLoop = true;
    }
  }

  yield { type: "done", data: null };
}

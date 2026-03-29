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

const DEFAULT_MAX_TOOL_ROUNDS = 10;

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
  const maxToolRounds = parseInt(process.env.MAX_TOOL_ROUNDS || "", 10) || DEFAULT_MAX_TOOL_ROUNDS;
  const allMessages = adapter.formatMessages(systemPrompt, messages);

  let continueLoop = true;
  let iterations = 0;

  // Tool-call loop: the LLM may request tool calls in its response. When it does,
  // we execute those tools, append the results to the message history, and re-invoke
  // the LLM so it can incorporate the tool output. This loop continues until either
  // the LLM produces a final text response with no tool calls, the iteration limit
  // is reached (preventing infinite loops), or the client disconnects (abort signal).
  while (continueLoop) {
    if (++iterations > maxToolRounds) {
      yield { type: "error", data: `Tool-call loop exceeded maximum of ${maxToolRounds} iterations` };
      return;
    }
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
      const errorBody = await response.text().catch(() => "");
      const status = response.status;

      let userMessage: string;
      if (status === 401 || status === 403) {
        userMessage = "Your AI provider API key is invalid or expired. Please update it in your store settings.";
      } else if (status === 429) {
        let retryAfter = "";
        const retryHeader = response.headers.get("retry-after");
        if (retryHeader) {
          const seconds = parseInt(retryHeader, 10);
          if (!isNaN(seconds)) {
            retryAfter = ` Please wait ${seconds} seconds before trying again.`;
          }
        }
        userMessage = `The AI provider is rate-limiting requests. Please wait a moment and try again.${retryAfter}`;
      } else if (status === 404) {
        userMessage = "The configured AI model was not found. Please check your model name in store settings.";
      } else if (status >= 500) {
        userMessage = "The AI provider is experiencing issues. Please try again in a few moments.";
      } else {
        userMessage = "An unexpected error occurred with the AI provider. Please try again.";
      }

      console.error(`[llm] API error status=${status} body=${errorBody.slice(0, 500)}`);
      yield { type: "error", data: userMessage };
      return;
    }

    if (!response.body) {
      yield { type: "error", data: "No response body from API" };
      return;
    }

    const assistantState = adapter.createAssistantState();

    // Stream SSE events from the provider, accumulating assistant state (text + tool calls)
    // and forwarding parsed events to the caller for real-time SSE delivery to the client.
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

    // If the LLM requested tool calls, execute them all in parallel, yield the results
    // as SSE events, append the assistant message + tool results to the conversation,
    // and set continueLoop=true so the LLM is re-invoked with the updated context.
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

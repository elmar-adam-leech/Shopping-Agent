export interface SSEEvent {
  type: string;
  data: unknown;
}

export type SSEEventHandler = (event: SSEEvent) => void;

export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: SSEEventHandler,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let pendingRetry: string | null = null;

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      if (pendingRetry !== null) {
        lines.unshift(pendingRetry);
      }
      const retryingLine: string | null = pendingRetry;
      pendingRetry = null;

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.substring(6).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          onEvent(event);
        } catch {
          const isRetry = retryingLine !== null && line === retryingLine;
          if (isRetry) {
            console.warn("[sse-parser] Discarding unparseable SSE line after retry:", line.slice(0, 200));
          } else if (pendingRetry === null) {
            pendingRetry = line;
          } else {
            console.warn("[sse-parser] Discarding unparseable SSE line:", line.slice(0, 200));
          }
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      const dataStr = buffer.trim().substring(6).trim();
      if (dataStr && dataStr !== "[DONE]") {
        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          onEvent(event);
        } catch (err) {
          console.warn("[sse-parser] Failed to parse final SSE data:", err instanceof Error ? err.message : err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

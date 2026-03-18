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
  const MAX_FAILED_LINES = 50;
  const failedLines = new Set<string>();

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.substring(6).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          onEvent(event);
          failedLines.delete(line);
        } catch {
          if (failedLines.has(line)) {
            console.warn("[sse-parser] Discarding unparseable SSE line after retry:", line.slice(0, 200));
            failedLines.delete(line);
          } else {
            if (failedLines.size >= MAX_FAILED_LINES) {
              console.warn("[sse-parser] failedLines limit reached, clearing buffer");
              failedLines.clear();
            }
            failedLines.add(line);
            buffer = line + "\n" + buffer;
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

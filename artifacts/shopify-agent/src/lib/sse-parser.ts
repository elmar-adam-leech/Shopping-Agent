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
        } catch {
          // incomplete JSON fragment — will be completed in next chunk
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      const dataStr = buffer.trim().substring(6).trim();
      if (dataStr && dataStr !== "[DONE]") {
        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          onEvent(event);
        } catch {
          // unparseable remainder
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

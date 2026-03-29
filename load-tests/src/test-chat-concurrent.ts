import {
  API_BASE,
  TEST_STORE_DOMAIN,
  CONCURRENCY_LEVELS,
  computeStats,
  printResult,
  createTestSession,
  sleep,
  loadTestHeaders,
} from "./config.js";

const SAMPLE_MESSAGES = [
  "What products do you have?",
  "Show me your best sellers",
  "I'm looking for a gift under $50",
  "What's on sale right now?",
  "Do you have any organic products?",
  "Tell me about your shipping policy",
  "What are your return policies?",
  "Can you recommend something for my mom?",
  "What collections do you have?",
  "Help me find a birthday present",
];

interface ChatTestResult {
  sessionId: string;
  latencyMs: number;
  firstByteMs: number;
  totalBytes: number;
  eventCount: number;
  hadError: boolean;
  errorType?: string;
}

async function sendChatMessage(
  storeDomain: string,
  sessionId: string,
  message: string,
  conversationId?: number
): Promise<ChatTestResult> {
  const start = Date.now();
  let firstByteMs = 0;
  let totalBytes = 0;
  let eventCount = 0;
  let hadError = false;
  let errorType: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const headers = {
      ...loadTestHeaders(),
      Cookie: `session_${storeDomain.replace(/\./g, "_")}=${sessionId}`,
    };
    const res = await fetch(`${API_BASE}/stores/${storeDomain}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        sessionId,
        conversationId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 429) {
      return {
        sessionId,
        latencyMs: Date.now() - start,
        firstByteMs: 0,
        totalBytes: 0,
        eventCount: 0,
        hadError: true,
        errorType: "rate_limited",
      };
    }

    if (!res.ok) {
      return {
        sessionId,
        latencyMs: Date.now() - start,
        firstByteMs: 0,
        totalBytes: 0,
        eventCount: 0,
        hadError: true,
        errorType: `HTTP ${res.status}`,
      };
    }

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          if (firstByteMs === 0) {
            firstByteMs = Date.now() - start;
          }
          totalBytes += value.length;
          const text = decoder.decode(value, { stream: true });
          const events = text.split("\n\n").filter((e) => e.startsWith("data: "));
          eventCount += events.length;
        }
      }
    }
  } catch (err) {
    hadError = true;
    errorType = err instanceof Error ? err.name : "unknown";
  }

  return {
    sessionId,
    latencyMs: Date.now() - start,
    firstByteMs,
    totalBytes,
    eventCount,
    hadError,
    errorType,
  };
}

async function testConcurrentChat(concurrency: number): Promise<void> {
  console.log(`\nPreparing ${concurrency} sessions...`);

  const sessions: string[] = [];
  for (let i = 0; i < concurrency; i++) {
    const sid = await createTestSession(TEST_STORE_DOMAIN);
    if (sid) sessions.push(sid);
    if (i > 0 && i % 10 === 0) {
      await sleep(1000);
    }
  }

  if (sessions.length === 0) {
    console.log(`  SKIP: Could not create any sessions (store may not exist or chat disabled)`);
    return;
  }

  console.log(`  Created ${sessions.length}/${concurrency} sessions`);
  console.log(`  Sending concurrent chat messages...`);

  const latencies: number[] = [];
  const firstByteLatencies: number[] = [];
  const errors: Record<string, number> = {};
  const start = Date.now();

  const workers = sessions.map(async (sessionId, idx) => {
    const msg = SAMPLE_MESSAGES[idx % SAMPLE_MESSAGES.length];
    const result = await sendChatMessage(TEST_STORE_DOMAIN, sessionId, msg);

    if (result.hadError) {
      const key = result.errorType || "unknown";
      errors[key] = (errors[key] || 0) + 1;
    } else {
      latencies.push(result.latencyMs);
      if (result.firstByteMs > 0) {
        firstByteLatencies.push(result.firstByteMs);
      }
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("Concurrent Chat", concurrency, latencies, errors, duration);
  printResult(result);

  if (firstByteLatencies.length > 0) {
    const sorted = firstByteLatencies.sort((a, b) => a - b);
    const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
    console.log(`  First-byte latency: avg=${avg}ms, p50=${sorted[Math.floor(sorted.length * 0.5)]}ms, p95=${sorted[Math.floor(sorted.length * 0.95)]}ms`);
  }
}

async function main() {
  console.log("=== Concurrent Chat Sessions Load Test ===\n");
  console.log(`Target: POST ${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`);
  console.log(`Store: ${TEST_STORE_DOMAIN}\n`);

  for (const c of CONCURRENCY_LEVELS) {
    await testConcurrentChat(c);
    await sleep(2000);
  }
}

main().catch(console.error);

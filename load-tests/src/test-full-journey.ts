import {
  API_BASE,
  TEST_STORE_DOMAIN,
  computeStats,
  printResult,
  timedFetch,
  createTestSession,
  sleep,
  loadTestHeaders,
} from "./config.js";

async function simulateUserJourney(
  storeDomain: string,
  journeyId: number
): Promise<{ latencies: number[]; errors: Record<string, number> }> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};

  const sessionId = await createTestSession(storeDomain);
  if (!sessionId) {
    errors["session_creation_failed"] = 1;
    return { latencies, errors };
  }

  const cookie = `session_${storeDomain.replace(/\./g, "_")}=${sessionId}`;

  try {
    const { status, latencyMs } = await timedFetch(
      `${API_BASE}/stores/${storeDomain}/conversations`,
      { headers: { Cookie: cookie } }
    );
    if (status === 200) {
      latencies.push(latencyMs);
    } else {
      errors[`conversations_list_${status}`] = (errors[`conversations_list_${status}`] || 0) + 1;
    }
  } catch (err) {
    errors["conversations_list_error"] = (errors["conversations_list_error"] || 0) + 1;
  }

  const messages = [
    "Hi, what do you sell?",
    "Show me something under $30",
    "Tell me more about the first one",
  ];

  let conversationId: number | undefined;

  for (const msg of messages) {
    try {
      const start = Date.now();
      const chatHeaders = { ...loadTestHeaders(), Cookie: cookie };
      const res = await fetch(`${API_BASE}/stores/${storeDomain}/chat`, {
        method: "POST",
        headers: chatHeaders,
        body: JSON.stringify({
          message: msg,
          sessionId,
          conversationId,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.status === 429) {
        errors["chat_rate_limited"] = (errors["chat_rate_limited"] || 0) + 1;
        await sleep(5000);
        continue;
      }

      if (!res.ok) {
        errors[`chat_${res.status}`] = (errors[`chat_${res.status}`] || 0) + 1;
        continue;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (!conversationId) {
            const match = text.match(/"conversation_id".*?(\d+)/);
            if (match) conversationId = parseInt(match[1]);
          }
        }
      }

      latencies.push(Date.now() - start);
    } catch (err) {
      errors["chat_error"] = (errors["chat_error"] || 0) + 1;
    }

    await sleep(1000 + Math.random() * 2000);
  }

  try {
    const { status, latencyMs } = await timedFetch(
      `${API_BASE}/stores/${storeDomain}/conversations`,
      { headers: { Cookie: cookie } }
    );
    if (status === 200) latencies.push(latencyMs);
  } catch {}

  return { latencies, errors };
}

async function main() {
  console.log("=== Full User Journey Load Test ===\n");
  console.log(`Target: ${API_BASE}`);
  console.log(`Store: ${TEST_STORE_DOMAIN}`);
  console.log(`Journey: session → list conversations → 3 chat messages → list conversations\n`);

  for (const concurrency of [5, 10, 25]) {
    console.log(`\n--- ${concurrency} Concurrent User Journeys ---`);
    const allLatencies: number[] = [];
    const allErrors: Record<string, number> = {};
    const start = Date.now();

    const journeys = Array.from({ length: concurrency }, (_, i) =>
      simulateUserJourney(TEST_STORE_DOMAIN, i)
    );

    const results = await Promise.all(journeys);

    for (const r of results) {
      allLatencies.push(...r.latencies);
      for (const [k, v] of Object.entries(r.errors)) {
        allErrors[k] = (allErrors[k] || 0) + v;
      }
    }

    const duration = Date.now() - start;
    const result = computeStats("Full User Journey", concurrency, allLatencies, allErrors, duration);
    printResult(result);

    await sleep(3000);
  }
}

main().catch(console.error);

import {
  API_BASE,
  TEST_STORE_DOMAIN,
  CONCURRENCY_LEVELS,
  computeStats,
  printResult,
  timedFetch,
  loadTestHeaders,
} from "./config.js";

async function testSessionCreation(concurrency: number): Promise<void> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const requestsPerWorker = 5;
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async (_, workerIdx) => {
    for (let i = 0; i < requestsPerWorker; i++) {
      try {
        const { status, body, latencyMs } = await timedFetch(`${API_BASE}/sessions`, {
          method: "POST",
          headers: loadTestHeaders(),
          body: JSON.stringify({ storeDomain: TEST_STORE_DOMAIN }),
        });
        if (status === 201) {
          latencies.push(latencyMs);
        } else if (status === 429) {
          const key = "HTTP 429 (rate limited)";
          errors[key] = (errors[key] || 0) + 1;
        } else {
          const key = `HTTP ${status}`;
          errors[key] = (errors[key] || 0) + 1;
        }
      } catch (err) {
        const key = err instanceof Error ? err.message.slice(0, 60) : "unknown";
        errors[key] = (errors[key] || 0) + 1;
      }
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("Session Creation", concurrency, latencies, errors, duration);
  printResult(result);
}

async function main() {
  console.log("=== Session Creation Load Test ===\n");
  console.log(`Target: POST ${API_BASE}/sessions`);
  console.log(`Store: ${TEST_STORE_DOMAIN}\n`);

  for (const c of CONCURRENCY_LEVELS) {
    await testSessionCreation(c);
  }
}

main().catch(console.error);

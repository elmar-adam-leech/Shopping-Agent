import { API_BASE, computeStats, printResult, timedFetch } from "./config.js";

async function testHealth(concurrency: number, totalRequests: number): Promise<void> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async () => {
    const perWorker = Math.ceil(totalRequests / concurrency);
    for (let i = 0; i < perWorker; i++) {
      try {
        const { status, latencyMs } = await timedFetch(`${API_BASE}/healthz`);
        if (status === 200) {
          latencies.push(latencyMs);
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
  const result = computeStats("Health Check", concurrency, latencies, errors, duration);
  printResult(result);
}

async function main() {
  console.log("=== Health Check Load Test ===\n");
  console.log(`Target: ${API_BASE}/healthz\n`);

  for (const c of [10, 50, 100, 200]) {
    await testHealth(c, c * 10);
  }
}

main().catch(console.error);

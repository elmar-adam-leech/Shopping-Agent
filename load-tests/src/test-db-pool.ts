import {
  API_BASE,
  TEST_STORE_DOMAIN,
  computeStats,
  printResult,
  timedFetch,
  sleep,
  loadTestHeaders,
} from "./config.js";

async function testDBPoolWithSessions(concurrency: number, totalRequests: number): Promise<void> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async () => {
    const perWorker = Math.ceil(totalRequests / concurrency);
    for (let i = 0; i < perWorker; i++) {
      try {
        const { status, latencyMs } = await timedFetch(`${API_BASE}/sessions`, {
          method: "POST",
          headers: loadTestHeaders(),
          body: JSON.stringify({ storeDomain: TEST_STORE_DOMAIN }),
        });
        if (status === 201) {
          latencies.push(latencyMs);
        } else if (status === 429) {
          errors["rate_limited"] = (errors["rate_limited"] || 0) + 1;
        } else {
          const key = `HTTP ${status}`;
          errors[key] = (errors[key] || 0) + 1;
        }
      } catch (err) {
        const key = err instanceof Error ? err.message.slice(0, 80) : "unknown";
        errors[key] = (errors[key] || 0) + 1;
      }
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("DB Pool - Session Creation", concurrency, latencies, errors, duration);
  printResult(result);
}

async function testDBPoolWithMixedQueries(concurrency: number): Promise<void> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const requestsPerWorker = 10;
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async (_, workerIdx) => {
    for (let i = 0; i < requestsPerWorker; i++) {
      const endpoints = [
        { url: `${API_BASE}/sessions`, method: "POST", body: { storeDomain: TEST_STORE_DOMAIN } },
        { url: `${API_BASE}/healthz`, method: "GET", body: null },
        { url: `${API_BASE}/stores/${TEST_STORE_DOMAIN}/public`, method: "GET", body: null },
      ];

      const ep = endpoints[i % endpoints.length];

      try {
        const options: RequestInit = {
          method: ep.method,
          headers: loadTestHeaders(),
        };
        if (ep.body) {
          options.body = JSON.stringify(ep.body);
        }

        const { status, latencyMs } = await timedFetch(ep.url, options);
        if (status < 400 || status === 429) {
          latencies.push(latencyMs);
          if (status === 429) {
            errors["rate_limited"] = (errors["rate_limited"] || 0) + 1;
          }
        } else {
          const key = `HTTP ${status} on ${ep.method} ${ep.url.replace(API_BASE, "")}`;
          errors[key] = (errors[key] || 0) + 1;
        }
      } catch (err) {
        const key = err instanceof Error ? err.message.slice(0, 80) : "unknown";
        errors[key] = (errors[key] || 0) + 1;
      }
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("DB Pool - Mixed Queries", concurrency, latencies, errors, duration);
  printResult(result);
}

async function testConnectionExhaustion(): Promise<void> {
  console.log("\n--- Connection Exhaustion Test ---");
  console.log("  Sending burst of 200 concurrent DB-hitting requests...\n");

  const concurrency = 200;
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const start = Date.now();

  const workers = Array.from({ length: concurrency }, async () => {
    try {
      const { status, latencyMs, body } = await timedFetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: loadTestHeaders(),
        body: JSON.stringify({ storeDomain: TEST_STORE_DOMAIN }),
      });

      if (status === 201) {
        latencies.push(latencyMs);
      } else if (status === 429) {
        errors["rate_limited"] = (errors["rate_limited"] || 0) + 1;
      } else {
        let errMsg = `HTTP ${status}`;
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) errMsg += `: ${String(parsed.error).slice(0, 60)}`;
        } catch {}
        errors[errMsg] = (errors[errMsg] || 0) + 1;
      }
    } catch (err) {
      const key = err instanceof Error ? err.message.slice(0, 80) : "unknown";
      errors[key] = (errors[key] || 0) + 1;
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("DB Pool - Exhaustion Burst", concurrency, latencies, errors, duration);
  printResult(result);

  const connectionErrors = Object.entries(errors)
    .filter(([k]) => k.toLowerCase().includes("connection") || k.toLowerCase().includes("timeout") || k.toLowerCase().includes("pool"))
    .reduce((s, [, c]) => s + c, 0);

  if (connectionErrors > 0) {
    console.log(`  ⚠ ${connectionErrors} connection-related errors detected — pool may be exhausted`);
    console.log(`  Current pool max size: DB_POOL_MAX env var (default 20)`);
    console.log(`  Connection timeout: DB_POOL_CONNECTION_TIMEOUT env var (default 5000ms)`);
  } else {
    console.log(`  ✓ No connection pool exhaustion detected at ${concurrency} concurrent requests`);
  }
}

async function main() {
  console.log("=== Database Connection Pool Load Test ===\n");
  console.log(`Target: ${API_BASE}`);
  console.log(`Store: ${TEST_STORE_DOMAIN}`);
  console.log(`DB Pool Config: max=${process.env.DB_POOL_MAX || "20 (default)"}, ` +
    `idle_timeout=${process.env.DB_POOL_IDLE_TIMEOUT || "30000ms (default)"}, ` +
    `connect_timeout=${process.env.DB_POOL_CONNECTION_TIMEOUT || "5000ms (default)"}\n`);

  console.log("\n--- Sustained Session Creation Load ---");
  for (const c of [10, 25, 50, 100]) {
    await testDBPoolWithSessions(c, c * 3);
    await sleep(1000);
  }

  console.log("\n--- Mixed Query Load ---");
  for (const c of [20, 50, 100]) {
    await testDBPoolWithMixedQueries(c);
    await sleep(1000);
  }

  await testConnectionExhaustion();
}

main().catch(console.error);

import {
  API_BASE,
  TEST_STORE_DOMAIN,
  MERCHANT_PASSWORD,
  computeStats,
  printResult,
  timedFetch,
  sleep,
} from "./config.js";

async function getMerchantCookie(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeDomain: TEST_STORE_DOMAIN,
        password: MERCHANT_PASSWORD,
      }),
      redirect: "manual",
    });

    const cookies = res.headers.getSetCookie?.() || [];
    const authCookie = cookies.find((c) => c.startsWith("merchant_token="));
    if (authCookie) {
      return authCookie.split(";")[0];
    }

    if (res.ok) {
      const data = await res.json() as { token?: string };
      if (data.token) return `merchant_token=${data.token}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function testAnalyticsConcurrent(concurrency: number, cookie: string | null): Promise<void> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  const requestsPerWorker = 5;
  const start = Date.now();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < requestsPerWorker; i++) {
      const days = [1, 7, 30, 90][i % 4];
      try {
        const { status, latencyMs } = await timedFetch(
          `${API_BASE}/stores/${TEST_STORE_DOMAIN}/analytics?days=${days}`,
          { headers }
        );
        if (status === 200) {
          latencies.push(latencyMs);
        } else if (status === 401 || status === 403) {
          errors["auth_required"] = (errors["auth_required"] || 0) + 1;
        } else {
          errors[`HTTP ${status}`] = (errors[`HTTP ${status}`] || 0) + 1;
        }
      } catch (err) {
        const key = err instanceof Error ? err.message.slice(0, 60) : "unknown";
        errors[key] = (errors[key] || 0) + 1;
      }
    }
  });

  await Promise.all(workers);
  const duration = Date.now() - start;
  const result = computeStats("Analytics Queries", concurrency, latencies, errors, duration);
  printResult(result);
}

async function main() {
  console.log("=== Analytics Endpoint Load Test ===\n");
  console.log(`Target: GET ${API_BASE}/stores/${TEST_STORE_DOMAIN}/analytics`);
  console.log(`Store: ${TEST_STORE_DOMAIN}\n`);

  const cookie = await getMerchantCookie();
  if (cookie) {
    console.log("  Authenticated successfully\n");
  } else {
    console.log("  Warning: Could not authenticate. Analytics endpoints may return 401/403.\n");
    console.log("  Set LOAD_TEST_MERCHANT_PASSWORD to test authenticated endpoints.\n");
  }

  for (const c of [5, 10, 25, 50]) {
    await testAnalyticsConcurrent(c, cookie);
    await sleep(1000);
  }
}

main().catch(console.error);

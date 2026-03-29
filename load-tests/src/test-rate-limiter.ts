import {
  API_BASE,
  TEST_STORE_DOMAIN,
  sleep,
} from "./config.js";

async function testChatRateLimiter(): Promise<void> {
  console.log("\n--- Chat Rate Limiter Test ---");
  console.log("  Chat limit: 10 requests per minute per IP\n");

  const results: Array<{ request: number; status: number; latencyMs: number }> = [];

  for (let i = 0; i < 15; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Test message ${i}`,
          sessionId: "rate-limit-test-session",
        }),
      });
      results.push({
        request: i + 1,
        status: res.status,
        latencyMs: Date.now() - start,
      });
      await res.text();
    } catch (err) {
      results.push({
        request: i + 1,
        status: 0,
        latencyMs: Date.now() - start,
      });
    }
  }

  console.log("  Request | Status | Latency");
  console.log("  --------|--------|--------");
  for (const r of results) {
    const statusLabel = r.status === 429 ? "BLOCKED" : r.status === 200 ? "OK" : `${r.status}`;
    console.log(`  ${String(r.request).padStart(7)} | ${statusLabel.padEnd(6)} | ${r.latencyMs}ms`);
  }

  const blockedCount = results.filter((r) => r.status === 429).length;
  const passedCount = results.filter((r) => r.status !== 429 && r.status !== 0).length;
  console.log(`\n  Passed: ${passedCount}, Blocked: ${blockedCount}`);

  if (blockedCount > 0) {
    const firstBlocked = results.findIndex((r) => r.status === 429);
    console.log(`  First block at request #${firstBlocked + 1} (limit is 10/min)`);
  }
}

async function testSessionRateLimiter(): Promise<void> {
  console.log("\n--- Session Rate Limiter Test ---");
  console.log("  Session limit: 5 requests per minute per IP\n");

  const results: Array<{ request: number; status: number; latencyMs: number }> = [];

  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeDomain: TEST_STORE_DOMAIN }),
      });
      results.push({
        request: i + 1,
        status: res.status,
        latencyMs: Date.now() - start,
      });
      await res.text();
    } catch (err) {
      results.push({
        request: i + 1,
        status: 0,
        latencyMs: Date.now() - start,
      });
    }
  }

  console.log("  Request | Status | Latency");
  console.log("  --------|--------|--------");
  for (const r of results) {
    const statusLabel = r.status === 429 ? "BLOCKED" : r.status === 201 ? "OK" : `${r.status}`;
    console.log(`  ${String(r.request).padStart(7)} | ${statusLabel.padEnd(6)} | ${r.latencyMs}ms`);
  }

  const blockedCount = results.filter((r) => r.status === 429).length;
  console.log(`\n  Blocked: ${blockedCount}/10`);
}

async function testPerClientIsolation(): Promise<void> {
  console.log("\n--- Per-Client Rate Limit Isolation Test ---");
  console.log("  Verifying rate limits are per-IP, not global\n");

  console.log("  Phase 1: Exhaust rate limit from client perspective...");
  let exhaustedCount = 0;
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(`${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Exhaust message ${i}`,
          sessionId: "exhaust-session",
        }),
      });
      if (res.status === 429) exhaustedCount++;
      await res.text();
    } catch {}
  }

  console.log(`  Rate limit hit ${exhaustedCount} times`);

  console.log("\n  Phase 2: Testing with different X-Forwarded-For header...");
  const alternateResults: number[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": `192.168.1.${100 + i}`,
        },
        body: JSON.stringify({
          message: `Alternate client message ${i}`,
          sessionId: "alternate-session",
        }),
      });
      alternateResults.push(res.status);
      await res.text();
    } catch {
      alternateResults.push(0);
    }
  }

  const alternateBlocked = alternateResults.filter((s) => s === 429).length;
  const alternateAllowed = alternateResults.filter((s) => s !== 429 && s !== 0).length;

  console.log(`  Alternate client results: ${alternateAllowed} allowed, ${alternateBlocked} blocked`);

  if (alternateBlocked === 0 && alternateAllowed > 0) {
    console.log("  ✓ Rate limiting appears to be per-client (different IPs not affected)");
  } else if (alternateBlocked > 0 && exhaustedCount > 0) {
    console.log("  ⚠ Rate limiting may be global or X-Forwarded-For not respected");
    console.log("    Check: trust proxy setting, keyGenerator function");
  } else {
    console.log("  ? Inconclusive — rate limit may not have been reached or store may not exist");
  }
}

async function testConcurrentRateLimitBehavior(): Promise<void> {
  console.log("\n--- Concurrent Rate Limit Behavior ---");
  console.log("  Sending 20 concurrent requests to test rate limit under burst\n");

  await sleep(61000);
  console.log("  (waited 61s for rate limit window to reset)\n");

  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: 20 }, async (_, i) => {
      try {
        const res = await fetch(`${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Burst message ${i}`,
            sessionId: `burst-session-${i}`,
          }),
        });
        await res.text();
        return { index: i, status: res.status, latencyMs: Date.now() - start };
      } catch (err) {
        return { index: i, status: 0, latencyMs: Date.now() - start };
      }
    })
  );

  const statusCounts: Record<number, number> = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  console.log("  Status distribution:");
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    HTTP ${status}: ${count} requests`);
  }

  const blocked = results.filter((r) => r.status === 429).length;
  const allowed = results.filter((r) => r.status !== 429 && r.status !== 0).length;
  console.log(`\n  Allowed through: ${allowed}/20 (limit is 10/min)`);
  console.log(`  Rate limited:    ${blocked}/20`);

  if (allowed <= 10 && blocked >= 10) {
    console.log("  ✓ Rate limiter correctly enforcing limits under burst");
  } else if (allowed > 10) {
    console.log("  ⚠ More requests allowed than expected — race condition in rate limiter?");
  }
}

async function main() {
  console.log("=== Rate Limiter Behavior Under Load ===\n");
  console.log(`Target: ${API_BASE}`);
  console.log(`Store: ${TEST_STORE_DOMAIN}`);

  await testChatRateLimiter();
  await testSessionRateLimiter();
  await testPerClientIsolation();
  await testConcurrentRateLimitBehavior();
}

main().catch(console.error);

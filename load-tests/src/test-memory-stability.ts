import {
  API_BASE,
  TEST_STORE_DOMAIN,
  createTestSession,
  sleep,
  formatBytes,
  loadTestHeaders,
} from "./config.js";

const TEST_DURATION_MINUTES = parseInt(process.env.MEMORY_TEST_MINUTES || "15", 10);
const CONCURRENT_SESSIONS = parseInt(process.env.MEMORY_TEST_CONCURRENCY || "10", 10);
const SAMPLE_INTERVAL_MS = 30_000;

interface ServerMemory {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

interface ServerPool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

interface MemorySample {
  timestamp: number;
  elapsedMinutes: number;
  server: ServerMemory | null;
  serverPool: ServerPool | null;
  clientHeapUsed: number;
  requestsSent: number;
  errorsCount: number;
  activeConnections: number;
}

async function fetchServerHealth(): Promise<{ memory: ServerMemory; pool: ServerPool } | null> {
  try {
    const res = await fetch(`${API_BASE}/healthz/detailed`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json() as { memory: ServerMemory; pool: ServerPool };
      return { memory: data.memory, pool: data.pool };
    }
  } catch {}
  return null;
}

async function sendChatAndConsume(
  storeDomain: string,
  sessionId: string,
  message: string
): Promise<{ success: boolean; bytes: number }> {
  try {
    const headers = {
      ...loadTestHeaders(),
      Cookie: `session_${storeDomain.replace(/\./g, "_")}=${sessionId}`,
    };
    const res = await fetch(`${API_BASE}/stores/${storeDomain}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, sessionId }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      return { success: false, bytes: 0 };
    }

    let bytes = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
      }
    }

    return { success: true, bytes };
  } catch {
    return { success: false, bytes: 0 };
  }
}

async function main() {
  console.log("=== Memory Stability / Leak Detection Test ===\n");
  console.log(`Target: ${API_BASE}`);
  console.log(`Store: ${TEST_STORE_DOMAIN}`);
  console.log(`Duration: ${TEST_DURATION_MINUTES} minutes`);
  console.log(`Concurrent sessions: ${CONCURRENT_SESSIONS}`);
  console.log(`Sample interval: ${SAMPLE_INTERVAL_MS / 1000}s\n`);

  console.log("This test monitors server memory via GET /api/healthz/detailed.\n");

  const sessions: string[] = [];
  for (let i = 0; i < CONCURRENT_SESSIONS; i++) {
    const sid = await createTestSession(TEST_STORE_DOMAIN);
    if (sid) sessions.push(sid);
  }

  if (sessions.length === 0) {
    console.log("SKIP: Could not create sessions");
    return;
  }

  console.log(`Created ${sessions.length} sessions\n`);

  const messages = [
    "What products do you have?",
    "Tell me about your shipping options",
    "What's on sale?",
    "Do you have gift cards?",
    "What's your most popular item?",
  ];

  const samples: MemorySample[] = [];
  let totalRequests = 0;
  let totalErrors = 0;
  let activeConnections = 0;
  const startTime = Date.now();
  const endTime = startTime + TEST_DURATION_MINUTES * 60 * 1000;

  let lastSample = 0;

  async function takeSample(): Promise<void> {
    const elapsed = (Date.now() - startTime) / 60000;
    const health = await fetchServerHealth();
    const clientMem = process.memoryUsage();

    const sample: MemorySample = {
      timestamp: Date.now(),
      elapsedMinutes: Math.round(elapsed * 10) / 10,
      server: health?.memory ?? null,
      serverPool: health?.pool ?? null,
      clientHeapUsed: clientMem.heapUsed,
      requestsSent: totalRequests,
      errorsCount: totalErrors,
      activeConnections,
    };
    samples.push(sample);

    const serverInfo = sample.server
      ? `server_heap=${formatBytes(sample.server.heapUsed)}/${formatBytes(sample.server.heapTotal)} rss=${formatBytes(sample.server.rss)}`
      : "server=unavailable";
    const poolInfo = sample.serverPool
      ? `pool(total=${sample.serverPool.totalCount} idle=${sample.serverPool.idleCount} waiting=${sample.serverPool.waitingCount})`
      : "";

    console.log(
      `  [${sample.elapsedMinutes.toFixed(1)}min] ` +
        `${serverInfo} ${poolInfo} ` +
        `reqs=${sample.requestsSent} errs=${sample.errorsCount} active=${sample.activeConnections}`
    );
  }

  await takeSample();

  while (Date.now() < endTime) {
    const batch = sessions.map(async (sid, idx) => {
      activeConnections++;
      const msg = messages[(totalRequests + idx) % messages.length];
      const result = await sendChatAndConsume(TEST_STORE_DOMAIN, sid, msg);
      totalRequests++;
      if (!result.success) totalErrors++;
      activeConnections--;
    });

    await Promise.all(batch);

    if (Date.now() - lastSample >= SAMPLE_INTERVAL_MS) {
      await takeSample();
      lastSample = Date.now();
    }

    await sleep(2000);
  }

  await takeSample();

  console.log("\n--- Memory Stability Analysis ---\n");

  const serverSamples = samples.filter((s) => s.server !== null);

  if (serverSamples.length >= 2) {
    const first = serverSamples[0];
    const last = serverSamples[serverSamples.length - 1];

    const heapGrowth = last.server!.heapUsed - first.server!.heapUsed;
    const rssGrowth = last.server!.rss - first.server!.rss;
    const heapGrowthPct = ((heapGrowth / first.server!.heapUsed) * 100).toFixed(1);
    const rssGrowthPct = ((rssGrowth / first.server!.rss) * 100).toFixed(1);

    console.log(`  Duration:          ${((last.timestamp - first.timestamp) / 60000).toFixed(1)} minutes`);
    console.log(`  Total Requests:    ${totalRequests}`);
    console.log(`  Total Errors:      ${totalErrors}`);
    console.log(`  Error Rate:        ${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : 0}%`);
    console.log();
    console.log(`  Server Heap (start): ${formatBytes(first.server!.heapUsed)}`);
    console.log(`  Server Heap (end):   ${formatBytes(last.server!.heapUsed)}`);
    console.log(`  Heap Growth:         ${formatBytes(Math.abs(heapGrowth))} (${heapGrowthPct}%) ${heapGrowth > 0 ? "↑" : "↓"}`);
    console.log();
    console.log(`  Server RSS (start):  ${formatBytes(first.server!.rss)}`);
    console.log(`  Server RSS (end):    ${formatBytes(last.server!.rss)}`);
    console.log(`  RSS Growth:          ${formatBytes(Math.abs(rssGrowth))} (${rssGrowthPct}%) ${rssGrowth > 0 ? "↑" : "↓"}`);

    const heapValues = serverSamples.map((s) => s.server!.heapUsed);
    const maxHeap = Math.max(...heapValues);
    const minHeap = Math.min(...heapValues);
    console.log(`\n  Heap Range:          ${formatBytes(minHeap)} - ${formatBytes(maxHeap)}`);

    const durationMin = (last.timestamp - first.timestamp) / 60000;
    const growthPerMinute = durationMin > 0 ? heapGrowth / durationMin : 0;
    console.log(`  Heap Growth/min:     ${formatBytes(Math.abs(growthPerMinute))}/min`);

    const lastPool = last.serverPool;
    if (lastPool) {
      console.log(`\n  DB Pool (final):     total=${lastPool.totalCount} idle=${lastPool.idleCount} waiting=${lastPool.waitingCount}`);
    }

    if (heapGrowth > first.server!.heapUsed * 0.5) {
      console.log(`\n  ⚠ POTENTIAL MEMORY LEAK: Server heap grew by more than 50%`);
      console.log(`    Investigate: LRU cache sizes, SSE stream accumulation, event listener cleanup`);
    } else if (heapGrowth > first.server!.heapUsed * 0.2) {
      console.log(`\n  ⚠ MODERATE HEAP GROWTH: Server heap grew by ${heapGrowthPct}%`);
      console.log(`    May be normal under sustained load, but worth monitoring in production`);
    } else {
      console.log(`\n  ✓ Server memory appears stable (heap growth within normal range)`);
    }
  } else {
    console.log("  Could not collect server memory samples (is /api/healthz/detailed available?)");
    console.log("  Falling back to client-side memory observations only.\n");
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      console.log(`  Client heap (start): ${formatBytes(first.clientHeapUsed)}`);
      console.log(`  Client heap (end):   ${formatBytes(last.clientHeapUsed)}`);
    }
  }

  console.log("\n--- Raw Samples ---");
  console.log(JSON.stringify(samples, null, 2));
}

main().catch(console.error);

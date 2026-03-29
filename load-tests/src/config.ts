export const BASE_URL = process.env.LOAD_TEST_URL || "http://localhost:3000";
export const API_BASE = `${BASE_URL}/api`;

export const TEST_STORE_DOMAIN = process.env.LOAD_TEST_STORE || "test-store.myshopify.com";
export const MERCHANT_PASSWORD = process.env.LOAD_TEST_MERCHANT_PASSWORD || "test-password";

export const LOAD_TEST_BYPASS_HEADER = "X-Load-Test-Bypass";
export const LOAD_TEST_BYPASS_SECRET = process.env.LOAD_TEST_BYPASS_SECRET || "";

export function loadTestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LOAD_TEST_BYPASS_SECRET) {
    headers[LOAD_TEST_BYPASS_HEADER] = LOAD_TEST_BYPASS_SECRET;
  }
  return headers;
}

export const CONCURRENCY_LEVELS = [10, 25, 50, 100];

export interface TestResult {
  name: string;
  concurrency: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  requestsPerSecond: number;
  durationMs: number;
  errors: Record<string, number>;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeStats(
  name: string,
  concurrency: number,
  latencies: number[],
  errorMap: Record<string, number>,
  durationMs: number
): TestResult {
  const sorted = [...latencies].sort((a, b) => a - b);
  const successCount = latencies.length;
  const errorCount = Object.values(errorMap).reduce((s, c) => s + c, 0);
  const totalRequests = successCount + errorCount;

  return {
    name,
    concurrency,
    totalRequests,
    successCount,
    errorCount,
    avgLatencyMs: sorted.length > 0 ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0,
    p50LatencyMs: percentile(sorted, 50),
    p95LatencyMs: percentile(sorted, 95),
    p99LatencyMs: percentile(sorted, 99),
    maxLatencyMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    minLatencyMs: sorted.length > 0 ? sorted[0] : 0,
    requestsPerSecond: durationMs > 0 ? Math.round((totalRequests / durationMs) * 1000 * 100) / 100 : 0,
    durationMs,
    errors: errorMap,
  };
}

export function printResult(result: TestResult): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${result.name} (concurrency: ${result.concurrency})`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total Requests:    ${result.totalRequests}`);
  console.log(`  Successful:        ${result.successCount}`);
  console.log(`  Failed:            ${result.errorCount}`);
  console.log(`  Duration:          ${result.durationMs}ms`);
  console.log(`  Requests/sec:      ${result.requestsPerSecond}`);
  console.log(`  Avg Latency:       ${result.avgLatencyMs}ms`);
  console.log(`  P50 Latency:       ${result.p50LatencyMs}ms`);
  console.log(`  P95 Latency:       ${result.p95LatencyMs}ms`);
  console.log(`  P99 Latency:       ${result.p99LatencyMs}ms`);
  console.log(`  Min Latency:       ${result.minLatencyMs}ms`);
  console.log(`  Max Latency:       ${result.maxLatencyMs}ms`);
  if (Object.keys(result.errors).length > 0) {
    console.log(`  Errors:`);
    for (const [err, count] of Object.entries(result.errors)) {
      console.log(`    ${err}: ${count}`);
    }
  }
  console.log(`${"=".repeat(60)}\n`);
}

export async function timedFetch(
  url: string,
  options?: RequestInit
): Promise<{ status: number; body: string; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(url, options);
  const body = await res.text();
  const latencyMs = Date.now() - start;
  return { status: res.status, body, latencyMs };
}

export async function createTestSession(storeDomain: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: loadTestHeaders(),
      body: JSON.stringify({ storeDomain }),
    });
    if (res.ok) {
      const data = await res.json() as { sessionId: string };
      return data.sessionId;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

import { execSync } from "node:child_process";

const tests = [
  { name: "Health Check", script: "test:health" },
  { name: "Session Creation", script: "test:sessions" },
  { name: "Database Connection Pool", script: "test:db-pool" },
  { name: "Rate Limiter", script: "test:rate-limit" },
  { name: "Analytics Load", script: "test:analytics" },
  { name: "Concurrent Chat Sessions", script: "test:chat" },
  { name: "SSE Scalability", script: "test:sse" },
  { name: "Full User Journey", script: "test:journey" },
];

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          LOAD & STRESS TEST SUITE               ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const results: Array<{ name: string; status: "PASS" | "FAIL" | "SKIP"; duration: number }> = [];

  for (const test of tests) {
    console.log(`\n${"#".repeat(60)}`);
    console.log(`# Running: ${test.name}`);
    console.log(`${"#".repeat(60)}\n`);

    const start = Date.now();
    try {
      execSync(`pnpm run ${test.script}`, {
        cwd: import.meta.dirname || process.cwd(),
        stdio: "inherit",
        timeout: 300_000,
        env: { ...process.env },
      });
      results.push({ name: test.name, status: "PASS", duration: Date.now() - start });
    } catch (err) {
      results.push({ name: test.name, status: "FAIL", duration: Date.now() - start });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("  TEST SUITE SUMMARY");
  console.log(`${"=".repeat(60)}\n`);

  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "○";
    console.log(`  ${icon} ${r.name.padEnd(30)} ${r.status.padEnd(6)} (${(r.duration / 1000).toFixed(1)}s)`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log();
}

main().catch(console.error);

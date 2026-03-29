import {
  API_BASE,
  TEST_STORE_DOMAIN,
  createTestSession,
  sleep,
  formatBytes,
  LOAD_TEST_BYPASS_HEADER,
  LOAD_TEST_BYPASS_SECRET,
} from "./config.js";
import http from "node:http";
import https from "node:https";

interface SSEConnection {
  sessionId: string;
  startTime: number;
  bytesReceived: number;
  eventsReceived: number;
  connected: boolean;
  error?: string;
  req?: http.ClientRequest;
}

function openSSEConnection(
  storeDomain: string,
  sessionId: string,
  message: string
): Promise<SSEConnection> {
  return new Promise((resolve) => {
    const conn: SSEConnection = {
      sessionId,
      startTime: Date.now(),
      bytesReceived: 0,
      eventsReceived: 0,
      connected: false,
    };

    const url = new URL(`${API_BASE}/stores/${storeDomain}/chat`);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const postData = JSON.stringify({
      message,
      sessionId,
    });

    const reqHeaders: Record<string, string | number> = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      Cookie: `session_${storeDomain.replace(/\./g, "_")}=${sessionId}`,
    };
    if (LOAD_TEST_BYPASS_SECRET) {
      reqHeaders[LOAD_TEST_BYPASS_HEADER] = LOAD_TEST_BYPASS_SECRET;
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: reqHeaders,
      timeout: 60000,
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode === 200) {
        conn.connected = true;
      } else {
        conn.error = `HTTP ${res.statusCode}`;
        conn.connected = false;
      }
      resolve(conn);

      res.on("data", (chunk: Buffer) => {
        conn.bytesReceived += chunk.length;
        const text = chunk.toString();
        const events = text.split("\n\n").filter((e) => e.startsWith("data: "));
        conn.eventsReceived += events.length;
      });

      res.on("end", () => {
        conn.connected = false;
      });

      res.on("error", (err) => {
        conn.error = err.message;
        conn.connected = false;
      });
    });

    req.on("error", (err) => {
      conn.error = err.message;
      conn.connected = false;
      resolve(conn);
    });

    req.on("timeout", () => {
      conn.error = "timeout";
      conn.connected = false;
      req.destroy();
      resolve(conn);
    });

    conn.req = req;
    req.write(postData);
    req.end();
  });
}

async function testSSEScalability(maxConnections: number): Promise<void> {
  console.log(`\n--- Testing ${maxConnections} concurrent SSE connections ---`);

  const sessions: string[] = [];
  for (let i = 0; i < maxConnections; i++) {
    const sid = await createTestSession(TEST_STORE_DOMAIN);
    if (sid) sessions.push(sid);
    if (i > 0 && i % 20 === 0) {
      await sleep(500);
    }
  }

  if (sessions.length === 0) {
    console.log("  SKIP: Could not create sessions");
    return;
  }

  console.log(`  Created ${sessions.length} sessions, opening SSE connections in parallel...`);
  const start = Date.now();

  const messages = [
    "What products do you have?",
    "Tell me about your store",
    "What's popular right now?",
  ];

  const BATCH_SIZE = 25;
  const connections: SSEConnection[] = [];

  for (let batchStart = 0; batchStart < sessions.length; batchStart += BATCH_SIZE) {
    const batch = sessions.slice(batchStart, batchStart + BATCH_SIZE);
    const batchConnections = await Promise.all(
      batch.map((sid, idx) => {
        const msg = messages[(batchStart + idx) % messages.length];
        return openSSEConnection(TEST_STORE_DOMAIN, sid, msg);
      })
    );
    connections.push(...batchConnections);
    const activeCount = connections.filter((c) => c.connected).length;
    console.log(`  Opened ${connections.length}/${sessions.length} connections (${activeCount} active)`);
  }

  await sleep(5000);

  const activeConnections = connections.filter((c) => c.connected).length;
  const failedConnections = connections.filter((c) => c.error).length;
  const totalBytes = connections.reduce((s, c) => s + c.bytesReceived, 0);
  const totalEvents = connections.reduce((s, c) => s + c.eventsReceived, 0);
  const duration = Date.now() - start;

  const errorCounts: Record<string, number> = {};
  for (const c of connections) {
    if (c.error) {
      errorCounts[c.error] = (errorCounts[c.error] || 0) + 1;
    }
  }

  console.log(`\n  Results for ${maxConnections} SSE connections:`);
  console.log(`    Attempted:        ${sessions.length}`);
  console.log(`    Connected:        ${connections.filter((c) => c.connected || c.bytesReceived > 0).length}`);
  console.log(`    Still Active:     ${activeConnections}`);
  console.log(`    Failed:           ${failedConnections}`);
  console.log(`    Total Data:       ${formatBytes(totalBytes)}`);
  console.log(`    Total Events:     ${totalEvents}`);
  console.log(`    Duration:         ${duration}ms`);

  if (Object.keys(errorCounts).length > 0) {
    console.log(`    Errors:`);
    for (const [err, count] of Object.entries(errorCounts)) {
      console.log(`      ${err}: ${count}`);
    }
  }

  for (const conn of connections) {
    if (conn.req) {
      try { conn.req.destroy(); } catch {}
    }
  }
}

async function main() {
  console.log("=== SSE Connection Scalability Test ===\n");
  console.log(`Target: ${API_BASE}/stores/${TEST_STORE_DOMAIN}/chat`);
  console.log(`Store: ${TEST_STORE_DOMAIN}`);

  for (const count of [10, 25, 50, 100]) {
    await testSSEScalability(count);
    await sleep(3000);
  }
}

main().catch(console.error);

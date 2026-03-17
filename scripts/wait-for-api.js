#!/usr/bin/env node
/**
 * wait-for-api.js
 * Polls GET /health until the API responds healthy or times out.
 * Used in CI to ensure Docker services are ready before running tests.
 */

const http = require('http');

const API_URL  = process.env.API_BASE_URL ?? 'http://localhost:3000';
const HEALTH   = `${API_URL}/health`;
const RETRIES  = parseInt(process.env.WAIT_RETRIES  ?? '30', 10);
const INTERVAL = parseInt(process.env.WAIT_INTERVAL ?? '2000', 10); // ms

function check(attempt) {
  return new Promise((resolve) => {
    const req = http.get(HEALTH, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log(`[wait-for-api] Polling ${HEALTH} (max ${RETRIES} attempts, ${INTERVAL}ms interval)`);

  for (let i = 1; i <= RETRIES; i++) {
    const healthy = await check(i);
    if (healthy) {
      console.log(`[wait-for-api] ✅ API is healthy after ${i} attempt(s)`);
      process.exit(0);
    }
    console.log(`[wait-for-api] attempt ${i}/${RETRIES} — not ready yet, retrying in ${INTERVAL}ms`);
    await new Promise((r) => setTimeout(r, INTERVAL));
  }

  console.error(`[wait-for-api] ❌ API failed to become healthy after ${RETRIES} attempts`);
  process.exit(1);
}

main();

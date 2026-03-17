import { test as base, APIRequestContext } from '@playwright/test';
import { DbHelper } from '../helpers/dbHelper';
import { ApiHelper } from '../helpers/apiHelper';
import { envConfig } from '../config/envConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture Types
// ─────────────────────────────────────────────────────────────────────────────
export interface EvFixtures {
  /** Connected DbHelper instance — auto-disconnects after each test */
  dbHelper: DbHelper;
  /** ApiHelper bound to baseURL — auto-cleans DB after each test */
  apiHelper: ApiHelper;
  /** Raw Playwright APIRequestContext (for direct use if needed) */
  apiContext: APIRequestContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extended test with EV-specific fixtures
// ─────────────────────────────────────────────────────────────────────────────
export const test = base.extend<EvFixtures>({
  // ── apiContext ──────────────────────────────────────────────────────────────
  /**
   * Initializes a fresh API request context for each test with standard headers
   */
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: envConfig.API_BASE_URL,
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Test-Client': 'ev-playwright-suite',
      },
    });
    await use(ctx);
    await ctx.dispose();
  },

  // ── apiHelper ───────────────────────────────────────────────────────────────
  /**
   * Injects the typed ApiHelper instance bound to the current request context
   */
  apiHelper: async ({ apiContext }, use) => {
    const helper = new ApiHelper(apiContext);
    await use(helper);
    // No cleanup here — dbHelper fixture handles DB teardown
  },

  // ── dbHelper ────────────────────────────────────────────────────────────────
  /**
   * Manages PostgreSQL connection lifecycle and triggers full DB cleanup after each test
   */
  dbHelper: async ({ }, use) => {
    const db = new DbHelper();
    await db.connect();
    await use(db);

    // Guaranteed teardown after every test to ensure test isolation
    try {
      await db.fullTeardown();
    } finally {
      await db.disconnect();
    }
  },
});

export { expect } from '@playwright/test';
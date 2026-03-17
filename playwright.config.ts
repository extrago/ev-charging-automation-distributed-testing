import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_BASE_URL = process.env['API_BASE_URL'] ?? 'http://localhost:3000';

/**
 * Playwright Configuration File
 * Optimized for API Testing, Kafka Integration, and Professional Reporting
 */
export default defineConfig({
  testDir: './tests',

  /* Maximum time one test can run for */
  timeout: 30_000,

  /* Retry failed tests once to account for infrastructure flakiness (e.g., Kafka warmup) */
  retries: 1,

  /* Limit workers to maintain stable concurrency and db state */
  workers: 2,

  /* Disable parallel execution for sequential reliability in stateful tests */
  fullyParallel: false,

  /* Reporting Configuration */
  reporter: [
    ['list'], // Console output for real-time progress
    ['html', { outputFolder: 'playwright-report', open: 'never' }], // Standard Playwright HTML report
    [
      'allure-playwright',
      {
        outputFolder: 'allure-results',
        detail: true,
        suiteTitle: true
      }
    ], // Advanced Allure dashboard for stakeholders
    [
      './src/reporters/customReporter.ts',
      { outputDir: 'reports' },
    ], // Custom business-specific reporter
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for API requests */
    baseURL: API_BASE_URL,

    /* Default headers for REST API interaction */
    extraHTTPHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },

    /* Visual artifacts for debugging faliures */
    screenshot: 'only-on-failure', // Automatically capture screenshots on fail
    video: 'retain-on-failure',    // Keep video recordings only for failed cases
    trace: 'on-first-retry',       // Detailed execution trace for debugging

    /* Ignore HTTPS errors for local development environments */
    ignoreHTTPSErrors: true,
  },

  /* Test Suite Projects */
  projects: [
    {
      name: 'ev-api',
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
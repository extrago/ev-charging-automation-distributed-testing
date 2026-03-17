import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Types ────────────────────────────────────────────────────────────────────
interface EnvConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  API_BASE_URL: string;
  TEST_ORIGIN_LAT: number;
  TEST_ORIGIN_LON: number;
  TEST_SEARCH_RADIUS_M: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function requireString(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireNumber(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const num = parseFloat(raw);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number, got: "${raw}"`);
  }
  return num;
}

// ─── Config Object ────────────────────────────────────────────────────────────
export const envConfig: EnvConfig = {
  DB_HOST:              requireString('DB_HOST', 'localhost'),
  DB_PORT:              requireNumber('DB_PORT', 5432),
  DB_USER:              requireString('DB_USER', 'ev_user'),
  DB_PASSWORD:          requireString('DB_PASSWORD', 'ev_secret'),
  DB_NAME:              requireString('DB_NAME', 'ev_charging'),
  API_BASE_URL:         requireString('API_BASE_URL', 'http://localhost:3000'),
  TEST_ORIGIN_LAT:      requireNumber('TEST_ORIGIN_LAT', 51.5074),
  TEST_ORIGIN_LON:      requireNumber('TEST_ORIGIN_LON', -0.1278),
  TEST_SEARCH_RADIUS_M: requireNumber('TEST_SEARCH_RADIUS_M', 5000),
};

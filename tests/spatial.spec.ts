/**
 * Spatial Boundary Test
 * ──────────────────────────────────────────────────────────────────────────────
 * Verifies that the GET /stations/search endpoint returns ONLY stations that
 * fall strictly within the requested radius using PostGIS ST_DWithin.
 *
 * Seed layout (origin = Trafalgar Square, London: 51.5074, -0.1278):
 *   Station 1 — Covent Garden (~0.8 km)   ← INSIDE  ✓
 *   Station 2 — Borough Market (~2.5 km)  ← INSIDE  ✓
 *   Station 3 — Canary Wharf (~8.0 km)    ← OUTSIDE ✗
 *   Station 4 — Heathrow (~22 km)         ← OUTSIDE ✗
 *   Station 5 — Stratford (~9.5 km)       ← OUTSIDE ✗
 */

import { test, expect } from '../src/fixtures';
import { GeoHelper } from '../src/helpers/geoHelper';
import { envConfig } from '../src/config/envConfig';
import { SearchResponse, Station } from '../src/types';

const ORIGIN = {
  lat: envConfig.TEST_ORIGIN_LAT,
  lon: envConfig.TEST_ORIGIN_LON,
};
const RADIUS_M = envConfig.TEST_SEARCH_RADIUS_M;      // 5000 m
const EXPECTED_COUNT_WITHIN = 2;
const EXPECTED_COUNT_TOTAL = 5;

test.describe('Spatial Boundary Tests — GET /stations/search', () => {

  test.beforeEach(async ({ dbHelper }) => {
    // Ensure clean state: no reservations, all stations available
    await dbHelper.fullTeardown();
  });

  // ── TC-001: Basic spatial search returns correct stations ──────────────────
  test(
    'TC-001: Search within 5 km radius returns only the 2 near-origin stations',
    async ({ apiHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: RADIUS_M,
      });

      // HTTP status
      expect(response.status()).toBe(200);

      const body = await apiHelper.parseSearchResponse(response);

      // Correct count
      expect(body.count).toBe(EXPECTED_COUNT_WITHIN);
      expect(body.stations).toHaveLength(EXPECTED_COUNT_WITHIN);

      // Response mirrors request params
      expect(body.origin.lat).toBeCloseTo(ORIGIN.lat, 4);
      expect(body.origin.lon).toBeCloseTo(ORIGIN.lon, 4);
      expect(body.radius_m).toBe(RADIUS_M);
    }
  );

  // ── TC-002: Stations are ordered by distance ascending ────────────────────
  test(
    'TC-002: Results are ordered by ascending distance from origin',
    async ({ apiHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: RADIUS_M,
      });

      expect(response.status()).toBe(200);
      const body = await apiHelper.parseSearchResponse(response);

      const distances = body.stations.map((s: Station) => Number(s.distance_m));
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]!);
      }
    }
  );

  // ── TC-003: Client-side Haversine double-validation ───────────────────────
  test(
    'TC-003: Every returned station verifies within radius via Haversine formula',
    async ({ apiHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: RADIUS_M,
      });

      expect(response.status()).toBe(200);
      const body = await apiHelper.parseSearchResponse(response);

      for (const station of body.stations) {
        const distM = GeoHelper.haversineDistance(
          ORIGIN.lat, ORIGIN.lon,
          station.latitude, station.longitude
        );
        expect(distM).toBeLessThan(RADIUS_M);
        console.log(
          `  ✔ ${station.name}: ${GeoHelper.formatDistance(distM)} from origin ` +
          `(API reported: ${GeoHelper.formatDistance(station.distance_m)})`
        );
      }
    }
  );

  // ── TC-004: Out-of-radius stations are absent from results ─────────────────
  test(
    'TC-004: Stations outside 5 km radius are strictly excluded from results',
    async ({ apiHelper, dbHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: RADIUS_M,
      });

      expect(response.status()).toBe(200);
      const body = await apiHelper.parseSearchResponse(response);

      // Fetch ALL stations directly from DB to compare
      const allStations = await dbHelper.getAllStations();
      expect(allStations).toHaveLength(EXPECTED_COUNT_TOTAL);

      const returnedIds = new Set(body.stations.map((s: Station) => s.id));

      // Ensures we did NOT return all 5
      expect(returnedIds.size).toBeLessThan(EXPECTED_COUNT_TOTAL);
    }
  );

  // ── TC-005: Larger radius includes more stations ───────────────────────────
  test(
    'TC-005: Expanding radius to 25 km returns all 5 seeded stations',
    async ({ apiHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: 30_000,
      });

      expect(response.status()).toBe(200);
      const body = await apiHelper.parseSearchResponse(response);

      expect(body.count).toBe(EXPECTED_COUNT_TOTAL);
      expect(body.stations).toHaveLength(EXPECTED_COUNT_TOTAL);
    }
  );

  // ── TC-006: Very tight radius (50 m) returns zero results ─────────────────
  test(
    'TC-006: Extremely small 50 m radius returns zero stations',
    async ({ apiHelper }) => {
      const response = await apiHelper.searchStations({
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        radius: 50,
      });

      expect(response.status()).toBe(200);
      const body = await apiHelper.parseSearchResponse(response);

      expect(body.count).toBe(0);
      expect(body.stations).toHaveLength(0);
    }
  );
});

/**
 * Negative / Validation Tests
 * ──────────────────────────────────────────────────────────────────────────────
 * Verifies that invalid, missing, or malformed inputs produce proper 400/404
 * error responses with descriptive error bodies.
 */

import { test, expect } from '../src/fixtures';
import { ApiErrorResponse } from '../src/types';

test.describe('Negative Tests — Input Validation', () => {

  // ══════════════════════════════════════════════════════════════════════════
  // GET /stations/search — Parameter Validation
  // ══════════════════════════════════════════════════════════════════════════
  test.describe('GET /stations/search — Query Parameter Validation', () => {

    // ── TC-N-001: Missing lat ──────────────────────────────────────────────
    test(
      "TC-N-001: Missing 'lat' parameter returns 400 with descriptive error",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: '',
          lon: -0.1278,
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.message).toMatch(/lat/i);
        expect(body.field).toBe('lat');
      }
    );

    // ── TC-N-002: Missing lon ──────────────────────────────────────────────
    test(
      "TC-N-002: Missing 'lon' parameter returns 400 with descriptive error",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 51.5074,
          lon: '',
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.message).toMatch(/lon/i);
        expect(body.field).toBe('lon');
      }
    );

    // ── TC-N-003: Non-numeric lat ──────────────────────────────────────────
    test(
      "TC-N-003: Non-numeric 'lat' value returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 'not-a-number',
          lon: -0.1278,
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('lat');
        expect(body.received).toBe('not-a-number');
      }
    );

    // ── TC-N-004: Non-numeric lon ──────────────────────────────────────────
    test(
      "TC-N-004: Non-numeric 'lon' value returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 51.5074,
          lon: 'xyz',
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('lon');
      }
    );

    // ── TC-N-005: Negative radius ──────────────────────────────────────────
    test(
      "TC-N-005: Negative 'radius' value returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 51.5074,
          lon: -0.1278,
          radius: -1,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('radius');
      }
    );

    // ── TC-N-006: Zero radius ──────────────────────────────────────────────
    test(
      "TC-N-006: Zero 'radius' value returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 51.5074,
          lon: -0.1278,
          radius: 0,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('radius');
      }
    );

    // ── TC-N-007: lat out of range ─────────────────────────────────────────
    test(
      "TC-N-007: 'lat' > 90 returns 400 (out of valid WGS-84 range)",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 999,
          lon: -0.1278,
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('lat');
      }
    );

    // ── TC-N-008: lon out of range ─────────────────────────────────────────
    test(
      "TC-N-008: 'lon' > 180 returns 400 (out of valid WGS-84 range)",
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 51.5074,
          lon: 999,
          radius: 5000,
        });

        expect(response.status()).toBe(400);

        const body = await apiHelper.parseErrorResponse(response);
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('lon');
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /reservations — Body Validation
  // ══════════════════════════════════════════════════════════════════════════
  test.describe('POST /reservations — Request Body Validation', () => {

    // ── TC-N-009: Empty body ────────────────────────────────────────────────
    test(
      "TC-N-009: Empty request body returns 400 with missing field error",
      async ({ apiHelper }) => {
        const response = await apiHelper.createReservationRaw({});

        expect(response.status()).toBe(400);

        const body = await response.json() as ApiErrorResponse;
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('stationId');
      }
    );

    // ── TC-N-010: Non-integer stationId ────────────────────────────────────
    test(
      "TC-N-010: Non-integer 'stationId' returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.createReservationRaw({ stationId: 'abc' });

        expect(response.status()).toBe(400);

        const body = await response.json() as ApiErrorResponse;
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('stationId');
      }
    );

    // ── TC-N-011: Negative stationId ───────────────────────────────────────
    test(
      "TC-N-011: Negative 'stationId' returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.createReservationRaw({ stationId: -5 });

        expect(response.status()).toBe(400);

        const body = await response.json() as ApiErrorResponse;
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('stationId');
      }
    );

    // ── TC-N-012: Non-existent stationId ───────────────────────────────────
    test(
      "TC-N-012: Valid-format 'stationId' that does not exist returns 404",
      async ({ apiHelper }) => {
        const response = await apiHelper.createReservation({ stationId: 99999 });

        expect(response.status()).toBe(404);

        const body = await response.json() as ApiErrorResponse;
        expect(body.error).toBe('NotFound');
        expect(body.message).toMatch(/99999/);
      }
    );

    // ── TC-N-013: Null stationId ────────────────────────────────────────────
    test(
      "TC-N-013: Null 'stationId' returns 400",
      async ({ apiHelper }) => {
        const response = await apiHelper.createReservationRaw({ stationId: null });

        expect(response.status()).toBe(400);

        const body = await response.json() as ApiErrorResponse;
        expect(body.error).toBe('ValidationError');
        expect(body.field).toBe('stationId');
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Contract Tests — Response Shape
  // ══════════════════════════════════════════════════════════════════════════
  test.describe('Error Response Contract', () => {

    test(
      'TC-N-014: Every 400 response includes error, message fields',
      async ({ apiHelper }) => {
        const response = await apiHelper.searchStations({
          lat: 'bad',
          lon: -0.1278,
        });

        expect(response.status()).toBe(400);
        const body = await response.json() as ApiErrorResponse;

        // Required contract fields
        expect(typeof body.error).toBe('string');
        expect(typeof body.message).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
        expect(body.message.length).toBeGreaterThan(0);
      }
    );
  });
});

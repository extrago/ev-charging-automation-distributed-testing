/**
 * Concurrency / Race-Condition Tests
 * ──────────────────────────────────────────────────────────────────────────────
 * Simulates two simultaneous API requests trying to reserve the same charging
 * station. Verifies that database-level SELECT FOR UPDATE locking ensures:
 *   - Exactly one request receives 200 OK (reservation created)
 *   - Exactly one request receives 409 Conflict (station already reserved)
 *   - The database contains exactly one active reservation after the race
 */

import { test, expect, EvFixtures } from '../src/fixtures';
import { ReservationSuccessResponse, ApiErrorResponse } from '../src/types';

const TARGET_STATION_ID = 1; // Covent Garden — first seeded station

test.describe('Concurrency Tests — Reservation Race Condition', () => {

  test.beforeEach(async ({ dbHelper }: EvFixtures) => {
    // Guarantee a clean slate before every concurrency test
    await dbHelper.deleteReservationsForStation(TARGET_STATION_ID);
    await dbHelper.resetStationStatus(TARGET_STATION_ID);
    console.log(`[Concurrency] Pre-test reset: station ${TARGET_STATION_ID} set to available`);
  });

  // ── TC-C-001: Core race condition ─────────────────────────────────────────
  test(
    'TC-C-001: Simultaneous reservation requests result in exactly one 200 and one 409',
    async ({ apiHelper, dbHelper }) => {
      // Fire two requests in parallel
      const [response1, response2] = await apiHelper.createConcurrentReservations(
        { stationId: TARGET_STATION_ID, userId: 'user-alpha' },
        { stationId: TARGET_STATION_ID, userId: 'user-beta' }
      );

      const statuses = [response1.status(), response2.status()].sort();
      console.log(`[Concurrency] Response statuses: ${statuses.join(', ')}`);

      // ── Assertion 1: Exactly one 200, one 409 ──────────────────────────
      expect(statuses).toEqual([200, 409]);

      // ── Assertion 2: 200 response has correct shape ────────────────────
      const successResponse = response1.status() === 200 ? response1 : response2;
      const conflictResponse = response1.status() === 409 ? response1 : response2;

      const successBody = await successResponse.json() as ReservationSuccessResponse;
      expect(successBody.message).toMatch(/reservation created/i);
      expect(successBody.reservation.station_id).toBe(TARGET_STATION_ID);
      expect(successBody.reservation.status).toBe('active');
      expect(typeof successBody.reservation.id).toBe('number');

      // ── Assertion 3: 409 response has correct error shape ──────────────
      const conflictBody = await conflictResponse.json() as ApiErrorResponse;
      expect(conflictBody.error).toBe('Conflict');
      expect(conflictBody.message).toMatch(/already has an active reservation/i);

      // ── Assertion 4: DB has exactly one active reservation ─────────────
      const reservationCount = await dbHelper.countActiveReservations(TARGET_STATION_ID);
      expect(reservationCount).toBe(1);

      // ── Assertion 5: Station status is 'reserved' in DB ────────────────
      const station = await dbHelper.getStationById(TARGET_STATION_ID);
      expect(station).not.toBeNull();
      expect(station!.status).toBe('reserved');

      console.log(
        `[Concurrency] Winner: ${successBody.reservation.user_id} ` +
        `(reservation id: ${successBody.reservation.id})`
      );
    }
  );

  // ── TC-C-002: Three-way race ──────────────────────────────────────────────
  test(
    'TC-C-002: Three simultaneous requests — exactly one wins, two get 409',
    async ({ apiHelper, dbHelper }) => {
      const [r1, r2, r3] = await Promise.all([
        apiHelper.createReservation({ stationId: TARGET_STATION_ID, userId: 'user-1' }),
        apiHelper.createReservation({ stationId: TARGET_STATION_ID, userId: 'user-2' }),
        apiHelper.createReservation({ stationId: TARGET_STATION_ID, userId: 'user-3' }),
      ]);

      const responses = [r1, r2, r3];
      const statusCodes = responses.map((r) => r.status()).sort();

      console.log(`[Concurrency 3-way] Statuses: ${statusCodes.join(', ')}`);

      // One 200, two 409s
      const successCount = statusCodes.filter((s) => s === 200).length;
      const conflictCount = statusCodes.filter((s) => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);

      // DB integrity: exactly 1 active reservation
      const count = await dbHelper.countActiveReservations(TARGET_STATION_ID);
      expect(count).toBe(1);
    }
  );

  // ── TC-C-003: Sequential requests after lock is held ─────────────────────
  test(
    'TC-C-003: Sequential second reservation attempt on already-reserved station returns 409',
    async ({ apiHelper, dbHelper }) => {
      // First reservation — should succeed
      const first = await apiHelper.createReservation({
        stationId: TARGET_STATION_ID,
        userId: 'user-sequential-1',
      });
      expect(first.status()).toBe(200);

      // Second reservation — should fail
      const second = await apiHelper.createReservation({
        stationId: TARGET_STATION_ID,
        userId: 'user-sequential-2',
      });
      expect(second.status()).toBe(409);

      const conflictBody = await second.json() as ApiErrorResponse;
      expect(conflictBody.error).toBe('Conflict');

      // DB integrity
      const count = await dbHelper.countActiveReservations(TARGET_STATION_ID);
      expect(count).toBe(1);
    }
  );

  // ── TC-C-004: Reservations on DIFFERENT stations do not conflict ──────────
  test(
    'TC-C-004: Simultaneous reservations on different stations both succeed',
    async ({ apiHelper, dbHelper }) => {
      // Prepare station 2 as well
      await dbHelper.deleteReservationsForStation(2);
      await dbHelper.resetStationStatus(2);

      const [r1, r2] = await Promise.all([
        apiHelper.createReservation({ stationId: TARGET_STATION_ID, userId: 'user-concurrent-A' }),
        apiHelper.createReservation({ stationId: 2, userId: 'user-concurrent-B' }),
      ]);

      // Both should succeed — different stations, no conflict
      expect(r1.status()).toBe(200);
      expect(r2.status()).toBe(200);

      const count1 = await dbHelper.countActiveReservations(TARGET_STATION_ID);
      const count2 = await dbHelper.countActiveReservations(2);
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    }
  );

  // ── TC-C-005: Reservation release then re-reservation ─────────────────────
  test(
    'TC-C-005: Station can be re-reserved after cancellation',
    async ({ apiHelper, dbHelper }) => {
      // Create first reservation
      const reserveResponse = await apiHelper.createReservation({
        stationId: TARGET_STATION_ID,
        userId: 'user-cancel-test',
      });
      expect(reserveResponse.status()).toBe(200);

      const reserveBody = await reserveResponse.json() as ReservationSuccessResponse;
      const reservationId = reserveBody.reservation.id;

      // Cancel it via API
      const cancelResponse = await apiHelper.cancelReservation(reservationId);
      expect(cancelResponse.status()).toBe(200);

      // Reset station manually to simulate full release
      await dbHelper.resetStationStatus(TARGET_STATION_ID);

      // Re-reserve by a different user
      const reReserveResponse = await apiHelper.createReservation({
        stationId: TARGET_STATION_ID,
        userId: 'user-new-reservation',
      });
      expect(reReserveResponse.status()).toBe(200);

      const count = await dbHelper.countActiveReservations(TARGET_STATION_ID);
      expect(count).toBe(1);
    }
  );
});

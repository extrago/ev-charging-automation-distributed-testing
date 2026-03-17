import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────
interface ReservationBody {
  stationId?: unknown;
  userId?: unknown;
}

interface ReservationRow {
  id: number;
  station_id: number;
  user_id: string;
  status: string;
  created_at: string;
}

// ─── POST /reservations ───────────────────────────────────────────────────────
// Uses SELECT … FOR UPDATE to serialize concurrent requests for the same station.
// Returns 409 if an active reservation already exists (enforced by EXCLUDE constraint).
router.post('/', async (req: Request<object, object, ReservationBody>, res: Response): Promise<void> => {
  const { stationId, userId } = req.body;

  // ── Input Validation ──────────────────────────────────────────────────────
  if (stationId === undefined || stationId === null) {
    res.status(400).json({
      error: 'ValidationError',
      message: "Missing required field: 'stationId'",
      field: 'stationId',
    });
    return;
  }

  const stationIdNum = Number(stationId);
  if (isNaN(stationIdNum) || !Number.isInteger(stationIdNum) || stationIdNum <= 0) {
    res.status(400).json({
      error: 'ValidationError',
      message: "'stationId' must be a positive integer",
      field: 'stationId',
      received: stationId,
    });
    return;
  }

  const resolvedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : `user_${Date.now()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Check station exists ──────────────────────────────────────────────
    const stationCheck = await client.query(
      'SELECT id, status FROM stations WHERE id = $1 FOR UPDATE',
      [stationIdNum]
    );

    if (stationCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'NotFound',
        message: `Station with id ${stationIdNum} does not exist`,
      });
      return;
    }

    const station = stationCheck.rows[0] as { id: number; status: string };
    if (station.status === 'offline') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'StationOffline',
        message: `Station ${stationIdNum} is currently offline and cannot be reserved`,
      });
      return;
    }

    // ── Check for existing active reservation ─────────────────────────────
    const existingReservation = await client.query(
      "SELECT id FROM reservations WHERE station_id = $1 AND status = 'active'",
      [stationIdNum]
    );

    if ((existingReservation.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'Conflict',
        message: `Station ${stationIdNum} already has an active reservation`,
        existing_reservation_id: (existingReservation.rows[0] as { id: number }).id,
      });
      return;
    }

    // ── Create reservation ────────────────────────────────────────────────
    const insertResult = await client.query<ReservationRow>(
      `INSERT INTO reservations (station_id, user_id, status)
       VALUES ($1, $2, 'active')
       RETURNING id, station_id, user_id, status, created_at`,
      [stationIdNum, resolvedUserId]
    );

    // ── Update station status ─────────────────────────────────────────────
    await client.query(
      "UPDATE stations SET status = 'reserved' WHERE id = $1",
      [stationIdNum]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Reservation created successfully',
      reservation: insertResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err as Error & { code?: string };

    // PostgreSQL exclusion constraint violation
    if (error.code === '23P01') {
      res.status(409).json({
        error: 'Conflict',
        message: `Station ${stationIdNum} already has an active reservation (constraint)`,
      });
      return;
    }

    console.error('[reservations] Transaction error:', error.message);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'An unexpected error occurred while creating the reservation.',
    });
  } finally {
    client.release();
  }
});

// ─── DELETE /reservations/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] ?? '', 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'ValidationError', message: 'Reservation ID must be a number' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<ReservationRow>(
      "UPDATE reservations SET status = 'cancelled' WHERE id = $1 AND status = 'active' RETURNING station_id",
      [id]
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'NotFound', message: `No active reservation with id ${id}` });
      return;
    }
    const stationId = (result.rows[0] as { station_id: number }).station_id;
    await client.query("UPDATE stations SET status = 'available' WHERE id = $1", [stationId]);
    await client.query('COMMIT');
    res.status(200).json({ message: `Reservation ${id} cancelled`, station_id: stationId });
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err as Error;
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  } finally {
    client.release();
  }
});

export default router;

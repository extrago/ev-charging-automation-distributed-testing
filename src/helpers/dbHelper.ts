import { Pool, PoolConfig } from 'pg';
import { envConfig } from '../config/envConfig';
import { ReservationDbRow, StationDbRow } from '../types';

export class DbHelper {
  private pool: Pool;
  private connected: boolean = false;

  constructor(config?: Partial<PoolConfig>) {
    this.pool = new Pool({
      host: config?.host ?? envConfig.DB_HOST,
      port: config?.port ?? envConfig.DB_PORT,
      user: config?.user ?? envConfig.DB_USER,
      password: config?.password ?? envConfig.DB_PASSWORD,
      database: config?.database ?? envConfig.DB_NAME,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('[DbHelper] Idle client error:', err.message);
    });
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.pool.end();
      this.connected = false;
    }
  }

  async rawQuery<T extends object = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async getAllStations(): Promise<StationDbRow[]> {
    return this.rawQuery<StationDbRow>(
      'SELECT id, name, operator, status, power_kw::text, connector FROM stations ORDER BY id'
    );
  }

  async resetStationStatus(stationId: number): Promise<void> {
    await this.pool.query(
      "UPDATE stations SET status = 'available' WHERE id = $1",
      [stationId]
    );
  }

  async resetAllStationStatuses(): Promise<void> {
    await this.pool.query("UPDATE stations SET status = 'available'");
  }

  async getStationById(stationId: number): Promise<StationDbRow | null> {
    const rows = await this.rawQuery<StationDbRow>(
      'SELECT id, name, operator, status, power_kw::text, connector FROM stations WHERE id = $1',
      [stationId]
    );
    return rows[0] ?? null;
  }

  async deleteAllReservations(): Promise<void> {
    await this.pool.query('DELETE FROM reservations');
  }

  async deleteReservationsForStation(stationId: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM reservations WHERE station_id = $1',
      [stationId]
    );
  }

  async countActiveReservations(stationId: number): Promise<number> {
    const rows = await this.rawQuery<{ count: string }>(
      "SELECT COUNT(*) AS count FROM reservations WHERE station_id = $1 AND status = 'active'",
      [stationId]
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async getReservationsForStation(stationId: number): Promise<ReservationDbRow[]> {
    return this.rawQuery<ReservationDbRow>(
      'SELECT id, station_id, user_id, status, created_at FROM reservations WHERE station_id = $1 ORDER BY created_at',
      [stationId]
    );
  }

  async deleteAllAlerts(): Promise<void> {
    await this.pool.query('DELETE FROM alerts');
  }

  async getAlertsByTruckId(truckId: string): Promise<any[]> {
    return this.rawQuery(
      'SELECT id, truck_id, type, speed, created_at FROM alerts WHERE truck_id = $1 ORDER BY created_at DESC',
      [truckId]
    );
  }

  async fullTeardown(): Promise<void> {
    await this.deleteAllReservations();
    await this.deleteAllAlerts();
    await this.resetAllStationStatuses();
  }
}
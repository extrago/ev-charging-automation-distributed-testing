import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'ev_user',
  password: process.env.DB_PASSWORD ?? 'ev_secret',
  database: process.env.DB_NAME ?? 'ev_charging',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

export { pool };
export type { PoolClient };

import express, { Application, Request, Response, NextFunction } from 'express';
import stationsRouter from './routes/stations';
import reservationsRouter from './routes/reservations';
import { pool } from './db';
import { startKafkaConsumer } from './kafkaConsumer';

const app: Application = express();
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/stations', stationsRouter);
app.use('/reservations', reservationsRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'NotFound', message: 'The requested endpoint does not exist' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'InternalServerError', message: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Server] EV Charging Station API running on port ${PORT}`);

  // Initialize Kafka Consumer to listen for fleet telemetry events
  try {
    await startKafkaConsumer();
  } catch (error) {
    console.error('[Server] Failed to start Kafka Consumer:', error);
  }
});

export default app;
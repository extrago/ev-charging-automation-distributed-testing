import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Represents a charging station record from the database
 */
interface StationRow {
  id: number;
  name: string;
  operator: string;
  status: string;
  power_kw: string;
  connector: string;
  latitude: number;
  longitude: number;
  distance_m: number; // Will be returned as a number thanks to ::float cast
}

/**
 * Extended Request Query type to handle Geo-search parameters
 */
interface SearchQuery {
  lat?: string;
  lon?: string;
  radius?: string;
  [key: string]: string | string[] | undefined | any; // Index signature for Express compatibility
}

// ─── Validation Middleware ────────────────────────────────────────────────────

/**
 * Validates Geo-coordinates and radius parameters for the search endpoint
 */
function validateSearchParams(
  req: Request<object, object, object, SearchQuery>,
  res: Response,
  next: NextFunction
): void {
  const { lat, lon, radius } = req.query;

  // 1. Check for mandatory latitude
  if (lat === undefined || lat === '') {
    res.status(400).json({
      error: 'ValidationError',
      message: "Missing required query parameter: 'lat'",
      field: 'lat',
    });
    return;
  }

  // 2. Check for mandatory longitude
  if (lon === undefined || lon === '') {
    res.status(400).json({
      error: 'ValidationError',
      message: "Missing required query parameter: 'lon'",
      field: 'lon',
    });
    return;
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radiusNum = radius !== undefined ? parseFloat(radius) : 5000;

  // 3. Validate numeric types
  if (isNaN(latNum) || lat.trim() === '') {
    res.status(400).json({
      error: 'ValidationError',
      message: "'lat' must be a valid numeric value",
      field: 'lat',
      received: lat,
    });
    return;
  }

  if (isNaN(lonNum) || lon.trim() === '') {
    res.status(400).json({
      error: 'ValidationError',
      message: "'lon' must be a valid numeric value",
      field: 'lon',
      received: lon,
    });
    return;
  }

  // 4. Validate WGS-84 coordinate ranges
  if (latNum < -90 || latNum > 90) {
    res.status(400).json({
      error: 'ValidationError',
      message: "'lat' must be between -90 and 90",
      field: 'lat',
      received: latNum,
    });
    return;
  }

  if (lonNum < -180 || lonNum > 180) {
    res.status(400).json({
      error: 'ValidationError',
      message: "'lon' must be between -180 and 180",
      field: 'lon',
      received: lonNum,
    });
    return;
  }

  // 5. Validate radius logic
  if (radius !== undefined) {
    const r = parseFloat(radius);
    if (isNaN(r) || r <= 0) {
      res.status(400).json({
        error: 'ValidationError',
        message: "'radius' must be a positive number (metres)",
        field: 'radius',
        received: radius,
      });
      return;
    }
  }

  // Store parsed values in res.locals for the next handler
  res.locals['parsedLat'] = latNum;
  res.locals['parsedLon'] = lonNum;
  res.locals['parsedRadius'] = radiusNum;

  next();
}

// ─── GET /stations/search ─────────────────────────────────────────────────────

/**
 * Handles spatial search queries using PostGIS ST_DWithin and ST_Distance
 */
// ─── GET /stations/search ─────────────────────────────────────────────────────
router.get(
  '/search',
  validateSearchParams,
  async (_req: Request, res: Response): Promise<void> => {
    const lat = res.locals['parsedLat'];
    const lon = res.locals['parsedLon'];
    const radius = res.locals['parsedRadius'];

    try {
      // THE FIX: Standard PostGIS syntax with explicit float casting
      const query = `
        SELECT
          s.id,
          s.name,
          s.operator,
          s.status,
          s.power_kw::text,
          s.connector,
          ST_Y(s.location::geometry) AS latitude,
          ST_X(s.location::geometry) AS longitude,
          ST_Distance(
            s.location,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
          )::float AS distance_m
        FROM stations s
        WHERE ST_DWithin(
          s.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3
        )
        ORDER BY distance_m ASC;
      `;

      const result = await pool.query<StationRow>(query, [lat, lon, radius]);

      res.status(200).json({
        count: result.rowCount,
        origin: { lat, lon },
        radius_m: radius,
        stations: result.rows,
      });
    } catch (err: any) {
      console.error('[DB Error]:', err.message);
      res.status(500).json({
        error: 'InternalServerError',
        message: err.message, // بنظهر الرسالة هنا عشان نعرف لو فيه غلط تاني
      });
    }
  }
);

// ─── GET /stations/:id ────────────────────────────────────────────────────────

/**
 * Retrieves a single station's details by its ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params['id'] ?? '', 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'ValidationError', message: 'Station ID must be a number' });
    return;
  }

  try {
    const result = await pool.query<StationRow>(
      `SELECT id, name, operator, status, power_kw::text, connector,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM stations WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Station ${id} not found` });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

export default router;
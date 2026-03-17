// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript Interfaces for EV Charging Station Test Suite
// ─────────────────────────────────────────────────────────────────────────────

// ─── Station ──────────────────────────────────────────────────────────────────
export type StationStatus = 'available' | 'reserved' | 'offline';
export type ConnectorType = 'CCS' | 'CHAdeMO' | 'Type 2' | 'Tesla/CCS';

export interface Station {
  id: number;
  name: string;
  operator: string;
  status: StationStatus;
  power_kw: string;  // Returned as string from pg numeric
  connector: string;
  latitude: number;
  longitude: number;
  distance_m: number;
}

// ─── Reservation ──────────────────────────────────────────────────────────────
export type ReservationStatus = 'active' | 'completed' | 'cancelled';

export interface Reservation {
  id: number;
  station_id: number;
  user_id: string;
  status: ReservationStatus;
  created_at: string;
}

// ─── API Request / Response ───────────────────────────────────────────────────
export interface SearchParams {
  lat: number | string;
  lon: number | string;
  radius?: number | string;
}

export interface SearchResponse {
  count: number;
  origin: { lat: number; lon: number };
  radius_m: number;
  stations: Station[];
}

export interface ReservationRequest {
  stationId: number;
  userId?: string;
}

export interface ReservationSuccessResponse {
  message: string;
  reservation: Reservation;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  field?: string;
  received?: unknown;
  existing_reservation_id?: number;
}

// ─── Geo ──────────────────────────────────────────────────────────────────────
export interface GeoPoint {
  lat: number;
  lon: number;
}

// ─── DB Row Shapes (for direct pg queries in tests) ───────────────────────────
export interface StationDbRow {
  id: number;
  name: string;
  operator: string;
  status: string;
  power_kw: string;
  connector: string;
}

export interface ReservationDbRow {
  id: number;
  station_id: number;
  user_id: string;
  status: string;
  created_at: Date;
}

// ─── Custom Reporter ──────────────────────────────────────────────────────────
export interface TestResult {
  suiteName: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  workerIndex: number;
  retry: number;
  startTime: string;
}

export interface ReportSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  timedOut: number;
  totalDuration: number;
  startTime: string;
  endTime: string;
  results: TestResult[];
}

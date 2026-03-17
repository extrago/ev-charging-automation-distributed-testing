import { APIRequestContext, APIResponse } from '@playwright/test';
import {
  SearchParams,
  SearchResponse,
  ReservationRequest,
  ReservationSuccessResponse,
  ApiErrorResponse,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// ApiHelper — typed Playwright APIRequestContext wrapper
// ─────────────────────────────────────────────────────────────────────────────
export class ApiHelper {
  constructor(private readonly request: APIRequestContext) { }

  // ─── Health ───────────────────────────────────────────────────────────────
  async healthCheck(): Promise<APIResponse> {
    return this.request.get('/health');
  }

  // ─── Stations ─────────────────────────────────────────────────────────────

  /**
   * Search for stations within a given radius.
   * Params are sent as-is (may be invalid) so negative tests can pass bad values.
   */
  async searchStations(params: SearchParams): Promise<APIResponse> {
    const queryParams: Record<string, string> = {
      lat: String(params.lat),
      lon: String(params.lon),
    };
    if (params.radius !== undefined) {
      queryParams['radius'] = String(params.radius);
    }
    return this.request.get('/stations/search', { params: queryParams });
  }

  /**
   * Parse a successful search response to the typed SearchResponse shape.
   * Call only after asserting status === 200.
   */
  async parseSearchResponse(response: APIResponse): Promise<SearchResponse> {
    return response.json() as Promise<SearchResponse>;
  }

  /**
   * Parse an error response to the typed ApiErrorResponse shape.
   */
  async parseErrorResponse(response: APIResponse): Promise<ApiErrorResponse> {
    return response.json() as Promise<ApiErrorResponse>;
  }

  // ─── Reservations ─────────────────────────────────────────────────────────

  /**
   * Create a reservation for a station.
   */
  async createReservation(body: ReservationRequest): Promise<APIResponse> {
    return this.request.post('/reservations', { data: body });
  }

  /**
   * Create a reservation with an arbitrary body (used for negative tests).
   */
  async createReservationRaw(body: Record<string, unknown>): Promise<APIResponse> {
    return this.request.post('/reservations', { data: body });
  }

  /**
   * Parse a successful reservation response.
   */
  async parseReservationResponse(response: APIResponse): Promise<ReservationSuccessResponse> {
    return response.json() as Promise<ReservationSuccessResponse>;
  }

  /**
   * Simultaneously fire two reservation requests for the same station.
   * Used for the concurrency / race-condition test.
   * Returns [response1, response2] in resolution order (both settled).
   */
  async createConcurrentReservations(
    body1: ReservationRequest,
    body2: ReservationRequest
  ): Promise<[APIResponse, APIResponse]> {
    const [r1, r2] = await Promise.all([
      this.createReservation(body1),
      this.createReservation(body2),
    ]);
    return [r1, r2];
  }

  /** Cancel a reservation by ID */
  async cancelReservation(reservationId: number): Promise<APIResponse> {
    return this.request.delete(`/reservations/${reservationId}`);
  }

  // ─── Alerts (Kafka Integration) ──────────────────────────────────────────

  /**
   * Fetch active alerts for a specific truck.
   * Used to verify Kafka consumer processing.
   */
  async getAlertsByTruck(truckId: string): Promise<APIResponse> {
    return this.request.get(`/alerts`, {
      params: { truckId }
    });
  }
}
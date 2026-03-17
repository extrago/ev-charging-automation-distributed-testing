import { GeoPoint } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// GeoHelper — static spatial utility functions for test assertions
// ─────────────────────────────────────────────────────────────────────────────
export class GeoHelper {
  private constructor() {
    throw new Error('GeoHelper is a static utility class and cannot be instantiated.');
  }

  private static readonly EARTH_RADIUS_M = 6_371_000; // mean Earth radius in metres

  /**
   * Compute the great-circle distance between two WGS-84 points using the
   * Haversine formula. Returns distance in metres.
   */
  static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return GeoHelper.EARTH_RADIUS_M * c;
  }

  /**
   * Convenience overload accepting GeoPoint objects.
   */
  static distanceBetweenPoints(from: GeoPoint, to: GeoPoint): number {
    return GeoHelper.haversineDistance(from.lat, from.lon, to.lat, to.lon);
  }

  /**
   * Returns true if the given point is strictly within radiusM metres of origin.
   */
  static isWithinRadius(
    point: GeoPoint,
    origin: GeoPoint,
    radiusM: number
  ): boolean {
    return GeoHelper.distanceBetweenPoints(origin, point) < radiusM;
  }

  /**
   * Returns true if the given point is strictly outside the radius.
   */
  static isOutsideRadius(
    point: GeoPoint,
    origin: GeoPoint,
    radiusM: number
  ): boolean {
    return GeoHelper.distanceBetweenPoints(origin, point) >= radiusM;
  }

  /**
   * Format a distance in metres to a human-readable string.
   * < 1000 m → "XXX m", >= 1000 m → "X.X km"
   */
  static formatDistance(metres: number): string {
    if (metres < 1000) {
      return `${Math.round(metres)} m`;
    }
    return `${(metres / 1000).toFixed(2)} km`;
  }
}

import type { Coordinates, PathSamplePoint } from './types.js';

export const EARTH_RADIUS_KM = 6371.0088;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function toRadians(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function toDegrees(rad: number): number {
  return rad * RAD_TO_DEG;
}

/**
 * Computes great-circle distance in kilometers between two WGS-84 coordinates.
 */
export function calculateDistanceKm(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.lng - a.lng);

  if (Math.abs(dLat) < 1e-12 && Math.abs(dLng) < 1e-12) {
    return 0;
  }

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return EARTH_RADIUS_KM * c;
}

/**
 * Computes forward true azimuth bearing (0..360 degrees clockwise from North).
 */
export function calculateBearingDeg(a: Coordinates, b: Coordinates): number {
  if (Math.abs(a.lat - b.lat) < 1e-12 && Math.abs(a.lng - b.lng) < 1e-12) {
    return 0;
  }

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Samples `count` points along the spherical great-circle path between `a` and `b`.
 */
export function sampleGreatCirclePath(
  a: Coordinates,
  b: Coordinates,
  count: number,
): PathSamplePoint[] {
  const clampedCount = Math.max(2, Math.min(200, Math.round(count)));
  const totalDistanceKm = calculateDistanceKm(a, b);

  const lat1 = toRadians(a.lat);
  const lng1 = toRadians(a.lng);
  const lat2 = toRadians(b.lat);
  const lng2 = toRadians(b.lng);

  const delta = totalDistanceKm / EARTH_RADIUS_KM;
  const sinDelta = Math.sin(delta);

  const points: PathSamplePoint[] = [];

  for (let i = 0; i < clampedCount; i++) {
    const f = i / (clampedCount - 1);

    if (delta < 1e-12 || sinDelta < 1e-12) {
      points.push({
        index: i,
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f,
        distanceKm: totalDistanceKm * f,
        fraction: f,
      });
      continue;
    }

    const coeffA = Math.sin((1 - f) * delta) / sinDelta;
    const coeffB = Math.sin(f * delta) / sinDelta;

    const x =
      coeffA * Math.cos(lat1) * Math.cos(lng1) +
      coeffB * Math.cos(lat2) * Math.cos(lng2);
    const y =
      coeffA * Math.cos(lat1) * Math.sin(lng1) +
      coeffB * Math.cos(lat2) * Math.sin(lng2);
    const z = coeffA * Math.sin(lat1) + coeffB * Math.sin(lat2);

    const lat = toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDegrees(Math.atan2(y, x));

    points.push({
      index: i,
      lat,
      lng,
      distanceKm: totalDistanceKm * f,
      fraction: f,
    });
  }

  return points;
}

/**
 * Computes the spherical great-circle midpoint between two WGS-84 coordinates.
 */
export function calculateGreatCircleMidpoint(
  a: Coordinates,
  b: Coordinates,
): Coordinates {
  const sampled = sampleGreatCirclePath(a, b, 3);
  const mid = sampled[1] ?? a;
  return {
    lat: Number(mid.lat.toFixed(5)),
    lng: Number(mid.lng.toFixed(5)),
  };
}

/**
 * Deterministic smooth synthetic terrain elevation (meters ASL) used only as a
 * graceful fallback when all external DEM APIs are unreachable.
 */
export function generateSyntheticElevationM(lat: number, lng: number): number {
  const ridgeA = Math.sin(lat * 26.5 + lng * 14.2) * 140;
  const ridgeB = Math.cos(lat * 47.1 - lng * 31.8) * 75;
  const valley = Math.sin(lat * 95.0 + lng * 83.0) * 24;
  const baseline = 260 + Math.abs(Math.sin(lat * 0.25 + lng * 0.15)) * 180;
  return Math.max(0, Math.round((baseline + ridgeA + ridgeB + valley) * 10) / 10);
}

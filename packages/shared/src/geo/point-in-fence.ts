import { isClosed, toLocalMetres } from './polygon-area';
import type { LngLat } from './types';

export function pointInPolygon(point: LngLat, ring: readonly LngLat[]): boolean {
  const pts = isClosed(ring) ? ring.slice(0, -1) : ring;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    const crosses = a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Shortest distance in metres from a point to the polygon boundary. */
export function distanceToBoundaryM(point: LngLat, ring: readonly LngLat[]): number {
  const pts = isClosed(ring) ? ring.slice(0, -1) : ring;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = toLocalMetres(pts[i]!, point);
    const b = toLocalMetres(pts[(i + 1) % pts.length]!, point);
    best = Math.min(best, distanceToSegment(0, 0, a.x, a.y, b.x, b.y));
  }
  return best;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export interface FenceCheck {
  /** Strictly inside the polygon. */
  inside: boolean;
  /** Inside, or outside by no more than the GPS accuracy buffer. */
  acceptable: boolean;
  /** 0 when inside. */
  distanceOutsideM: number;
}

/**
 * Geo-fence check with an accuracy buffer (SPECS §3.5). A point outside the fence by less than
 * its reported GPS accuracy (capped at `maxBufferM`) is treated as acceptable.
 */
export function checkFence(point: LngLat, ring: readonly LngLat[], accuracyM = 0, maxBufferM = 30): FenceCheck {
  if (pointInPolygon(point, ring)) return { inside: true, acceptable: true, distanceOutsideM: 0 };
  const d = distanceToBoundaryM(point, ring);
  return { inside: false, acceptable: d <= Math.min(Math.max(accuracyM, 0), maxBufferM), distanceOutsideM: d };
}

export const GPS_ACCURACY_WARNING_M = 50;

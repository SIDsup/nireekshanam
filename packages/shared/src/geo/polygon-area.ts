import type { LngLat } from './types';

const EARTH_RADIUS_M = 6378137;
const rad = (d: number) => (d * Math.PI) / 180;

/** Geodesic area of a ring in m² (same method as Turf's `area`). The ring may be open or closed. */
export function polygonAreaSqm(ring: readonly LngLat[]): number {
  const pts = isClosed(ring) ? ring.slice(0, -1) : ring;
  const n = pts.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = pts[i]!;
    const middle = pts[(i + 1) % n]!;
    const upper = pts[(i + 2) % n]!;
    total += (rad(upper.lng) - rad(lower.lng)) * Math.sin(rad(middle.lat));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function isClosed(ring: readonly LngLat[]): boolean {
  const a = ring[0];
  const b = ring[ring.length - 1];
  return ring.length > 1 && !!a && !!b && a.lng === b.lng && a.lat === b.lat;
}

/** Equirectangular projection to metres around an origin. Accurate enough at farm scale. */
export function toLocalMetres(p: LngLat, origin: LngLat): { x: number; y: number } {
  return {
    x: rad(p.lng - origin.lng) * Math.cos(rad(origin.lat)) * EARTH_RADIUS_M,
    y: rad(p.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

export function centroid(ring: readonly LngLat[]): LngLat {
  const pts = isClosed(ring) ? ring.slice(0, -1) : ring;
  const sum = pts.reduce((acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }), { lng: 0, lat: 0 });
  return { lng: sum.lng / pts.length, lat: sum.lat / pts.length };
}

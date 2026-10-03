import type { LngLat } from '@nk/shared';

export interface XY { x: number; y: number }

/** Local equirectangular metres around a reference latitude; accurate to well under 1% at farm scale. */
export function toMetres(p: LngLat, ref: LngLat): XY {
  const kx = 111_320 * Math.cos((ref.lat * Math.PI) / 180);
  return { x: (p.lng - ref.lng) * kx, y: (p.lat - ref.lat) * 110_574 };
}

/**
 * Fits a set of metre-space circles (points with an optional radius) into an SVG box,
 * keeping the aspect ratio and flipping y so north is up. Returns a projector and the scale.
 */
export function fitProjection(items: { p: XY; r?: number }[], width: number, height: number, pad: number) {
  const xs = items.flatMap(({ p, r = 0 }) => [p.x - r, p.x + r]);
  const ys = items.flatMap(({ p, r = 0 }) => [p.y - r, p.y + r]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  return {
    scale,
    project: (p: XY): XY => ({ x: offX + (p.x - minX) * scale, y: offY + (maxY - p.y) * scale }),
  };
}

/** Closest point on a closed polygon's boundary to `p`. */
export function nearestOnRing(p: XY, ring: XY[]): XY {
  let best = ring[0]!;
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

export function centroid(ring: XY[]): XY {
  return { x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length };
}

export const pointsAttr = (ring: XY[]) => ring.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

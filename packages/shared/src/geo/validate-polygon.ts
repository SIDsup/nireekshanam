import { isClosed, polygonAreaSqm, toLocalMetres } from './polygon-area';
import type { LngLat } from './types';

export const MIN_FENCE_AREA_SQM = 100;

export type PolygonIssue = 'TOO_FEW_VERTICES' | 'SELF_INTERSECTING' | 'TOO_SMALL';

export function validatePolygon(ring: readonly LngLat[]): PolygonIssue[] {
  const pts = isClosed(ring) ? ring.slice(0, -1) : [...ring];
  const issues: PolygonIssue[] = [];
  const distinct = new Set(pts.map((p) => `${p.lng},${p.lat}`));
  if (distinct.size < 3) return ['TOO_FEW_VERTICES'];
  if (selfIntersects(pts)) issues.push('SELF_INTERSECTING');
  if (polygonAreaSqm(pts) <= MIN_FENCE_AREA_SQM) issues.push('TOO_SMALL');
  return issues;
}

function selfIntersects(pts: LngLat[]): boolean {
  const origin = pts[0]!;
  const xy = pts.map((p) => toLocalMetres(p, origin));
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const a1 = xy[i]!;
    const a2 = xy[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges, which share a vertex.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = xy[j]!;
      const b2 = xy[(j + 1) % n]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

type P = { x: number; y: number };
const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function segmentsIntersect(p1: P, p2: P, p3: P, p4: P): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

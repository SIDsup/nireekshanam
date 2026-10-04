import { centroid, toLocalMetres, type LngLat } from '@nk/shared';

const W = 320;
const H = 210;
const PAD = 26;

interface Pt { x: number; y: number }

/** Nearest point on the fence boundary, in projected units. */
function nearestOnRing(p: Pt, ring: Pt[]): Pt {
  let best = ring[0]!;
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

export function FenceMap({ fence, records }: { fence: LngLat[]; records: { gps: LngLat; inside: boolean; distanceOutsideM: number }[] }) {
  const origin = centroid(fence);
  const local = (p: LngLat) => toLocalMetres(p, origin);
  const pts = [...fence, ...records.map((r) => r.gps)].map(local);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const s = Math.min((W - PAD * 2) / (maxX - minX || 1), (H - PAD * 2) / (maxY - minY || 1));
  const ox = (W - (maxX - minX) * s) / 2;
  const oy = (H - (maxY - minY) * s) / 2;
  const project = (p: LngLat): Pt => {
    const m = local(p);
    return { x: Math.round((ox + (m.x - minX) * s) * 10) / 10, y: Math.round((oy + (maxY - m.y) * s) * 10) / 10 };
  };

  const ring = fence.map(project);
  const poly = ring.map((p) => `${p.x},${p.y}`).join(' ');
  const inside = records.filter((r) => r.inside).map((r) => project(r.gps));
  const outside = records.filter((r) => !r.inside).map((r) => ({ p: project(r.gps), m: r.distanceOutsideM }));
  // Scale bar: pick a round length that spans 40–90 px.
  const bar = [10, 20, 25, 50, 100, 200].find((m) => m * s >= 40) ?? 200;
  const label = `Geo-fence polygon with ${records.length} record ${records.length === 1 ? 'location' : 'locations'}${outside.length ? `, ${outside.length} outside the fence` : ', all inside the fence'}`;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#eef1ea]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} className="block">
        <g stroke="#e2e7de" strokeWidth="1">
          {[40, 80, 120, 160].map((y) => <path key={`h${y}`} d={`M0 ${y} H${W}`} />)}
          {[60, 120, 180, 240].map((x) => <path key={`v${x}`} d={`M${x} 0 V${H}`} />)}
        </g>
        <polygon points={poly} fill="#7fbf93" fillOpacity="0.35" stroke="#2f7d4e" strokeWidth="2" strokeLinejoin="round" />
        <g fill="#ffffff" stroke="#2f7d4e" strokeWidth="2">
          {ring.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" />)}
        </g>
        <g fill="#1f6fb2" stroke="#ffffff" strokeWidth="1.5">
          {inside.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4.5" />)}
        </g>
        {outside.map(({ p, m }, i) => {
          const q = nearestOnRing(p, ring);
          const right = p.x > W / 2;
          return (
            <g key={i}>
              <path d={`M${p.x} ${p.y} L${q.x} ${q.y}`} stroke="#b4570f" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx={p.x} cy={p.y} r="15" fill="#d98a2b" fillOpacity="0.2" />
              <circle cx={p.x} cy={p.y} r="5.5" fill="#b4570f" stroke="#ffffff" strokeWidth="1.5" />
              <text x={right ? p.x - 10 : p.x + 10} y={p.y < 24 ? p.y + 22 : p.y - 12} fontSize="10.5" fontWeight="600" fill="#7a3f08" textAnchor={right ? 'end' : 'start'} stroke="#eef1ea" strokeWidth="3" paintOrder="stroke">{m} m out</text>
            </g>
          );
        })}
        <g fontSize="10" fill="#3a4a42" fontFamily="var(--font-geist-mono), monospace">
          <text x="8" y={H - 8}>{origin.lat.toFixed(4)}° N, {origin.lng.toFixed(4)}° E</text>
        </g>
        <g stroke="#3a4a42" strokeWidth="1.5" fill="none">
          <path d={`M${W - 10 - bar * s} ${H - 16} V${H - 12} H${W - 10} V${H - 16}`} />
        </g>
        <text x={W - 10} y={H - 20} fontSize="10" fill="#3a4a42" textAnchor="end">{bar} m</text>
      </svg>
    </div>
  );
}

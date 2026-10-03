'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { areaVariance } from '@nk/shared';
import { Icon } from '@/components/ui/icon';
import { Avatar, Badge, cx, PageHeader } from '@/components/ui/primitives';
import type { Compliance, MapData, MapFarm } from '@/lib/data/lots-extra';
import type { StageGroupKey } from '@/lib/data/queries';
import { fmtDay, fmtDays, fmtGuntas, fmtSignedPct, initials } from '@/lib/format';
import { CROP_COLORS, STAGE_COLORS } from '@/lib/stage-colors';

export type ColourMode = 'stage' | 'compliance' | 'crop';

const W = 1000;
const H = 680;
const MIN_K = 1;
const MAX_K = 400;
/** Below this zoom farms are too small to read as polygons, so a marker dot stands in. */
const MARKER_K = 14;

const COMPLIANCE: Record<Compliance, { label: string; color: string }> = {
  ok: { label: 'All records in fence', color: '#9cc3e6' },
  reason: { label: 'Outside, reason given', color: '#f2b766' },
  review: { label: 'Awaiting review', color: '#b4570f' },
};

const MODES: { key: ColourMode; label: string }[] = [
  { key: 'stage', label: 'Stage' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'crop', label: 'Crop' },
];

interface View { k: number; x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function categoryOf(f: MapFarm, mode: ColourMode): string {
  return mode === 'stage' ? f.group : mode === 'compliance' ? f.compliance : f.cropCode;
}

function fillOf(f: MapFarm, mode: ColourMode): string {
  if (mode === 'stage') return STAGE_COLORS[f.group];
  if (mode === 'compliance') return COMPLIANCE[f.compliance].color;
  return CROP_COLORS[f.cropCode] ?? '#8a968f';
}

function niceScale(mPerPx: number): { px: number; label: string } {
  const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const m = steps.find((s) => s / mPerPx >= 60) ?? steps.at(-1)!;
  return { px: m / mPerPx, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}

export function FarmMap({ data, eyebrow, initialMode, initialLot }: { data: MapData; eyebrow: string; initialMode: ColourMode; initialLot: string | null }) {
  const [mode, setMode] = useState<ColourMode>(initialMode);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [showOutlines, setShowOutlines] = useState(true);
  const [showOutside, setShowOutside] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(initialLot);
  const [view, setView] = useState<View>(() => {
    const f = initialLot ? data.farms.find((x) => x.lotId === initialLot) : undefined;
    return f ? focusView(f, 60) : { k: 1, x: 0, y: 0 };
  });
  const [pxPerUnit, setPxPerUnit] = useState(1);
  // Top-left of the visible area in viewBox units; "meet" letterboxes the viewBox when the panel's shape differs.
  const [edge, setEdge] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const searchId = useId();
  const resultsId = useId();

  const byId = useMemo(() => new Map(data.farms.map((f) => [f.lotId, f])), [data.farms]);
  const sel = selected ? byId.get(selected) : undefined;

  // Screen pixels per viewBox unit (preserveAspectRatio "meet").
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const px = Math.min(e.contentRect.width / W, e.contentRect.height / H);
      setPxPerUnit(px);
      setEdge({ x: (W - e.contentRect.width / px) / 2, y: (H - e.contentRect.height / px) / 2 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: W / 2, y: H / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoomAt = useCallback((factor: number, px = W / 2, py = H / 2) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  }, []);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toViewBox(e.clientX, e.clientY);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-delta * 0.0022), p.x, p.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toViewBox, zoomAt]);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    const unit = pxPerUnit || 1;
    setView((v) => ({ ...v, x: d.vx + dx / unit, y: d.vy + dy / unit }));
  };
  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    suppressClick.current = d.moved;
    drag.current = null;
    setDragging(false);
  };

  const pick = (lotId: string) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setSelected(lotId);
  };

  const focusFarm = (f: MapFarm) => {
    setSelected(f.lotId);
    setView(focusView(f, Math.max(view.k, 60)));
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 60;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setView((v) => ({ ...v, x: v.x + move[0], y: v.y + move[1] }));
    } else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.6); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1 / 1.6); }
    else if (e.key === 'Escape') setSelected(null);
  };

  const legend = useMemo(() => {
    const count = (key: string) => data.farms.filter((f) => categoryOf(f, mode) === key).length;
    if (mode === 'stage') return { title: 'Current stage', items: data.stageGroups.map((g) => ({ key: g.key, label: g.label, color: STAGE_COLORS[g.key as StageGroupKey], n: count(g.key) })) };
    if (mode === 'compliance') return { title: 'Geo-fence compliance', items: (Object.keys(COMPLIANCE) as Compliance[]).map((k) => ({ key: k, label: COMPLIANCE[k].label, color: COMPLIANCE[k].color, n: count(k) })) };
    return { title: 'Crops', items: data.crops.map((c) => ({ key: c.code, label: `${c.name} (${c.code})`, color: CROP_COLORS[c.code] ?? '#8a968f', n: count(c.code) })) };
  }, [data, mode]);

  const visible = data.farms.filter((f) => !hidden.has(categoryOf(f, mode)));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return data.farms.filter((f) => [f.lotId, f.farmer, f.village].some((s) => s.toLowerCase().includes(q))).slice(0, 6);
  }, [data.farms, query]);

  const toggleCategory = (key: string) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const switchMode = (m: ColourMode) => { setMode(m); setHidden(new Set()); };

  const sx = (x: number) => x * view.k + view.x;
  const sy = (y: number) => y * view.k + view.y;
  const scale = niceScale(data.metresPerUnit / view.k / (pxPerUnit || 1));
  const showMarkers = view.k < MARKER_K;

  return (
    <>
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <p className="text-[13px] text-muted">{eyebrow}</p>
          <h1 className="mt-1.5 text-[32px] leading-[1.1] font-semibold tracking-[-0.025em]">Farm map</h1>
        </div>
        <div role="group" aria-label="Colour farms by" className="flex rounded-xl bg-[#e8ebe5] p-[3px]">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => switchMode(m.key)}
              className={cx('h-[38px] rounded-[9px] px-3.5 text-[13px]', mode === m.key ? 'bg-surface font-medium shadow-[0_1px_2px_rgba(16,32,26,0.12)]' : 'text-muted hover:text-ink')}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-stretch gap-[18px]">
        <aside className="flex max-w-full flex-[1_1_260px] flex-col gap-[18px] rounded-[20px] border border-line bg-surface p-5">
          <div className="relative">
            <label htmlFor={searchId} className="flex h-11 items-center gap-2 rounded-xl bg-ground px-3 focus-within:outline-2 focus-within:outline-sky">
              <Icon name="search" size={16} strokeWidth={2} className="text-muted" />
              <span className="sr-only">Find a farm or lot</span>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); focusFarm(matches[0]); } }}
                placeholder="Village, farmer or lot ID"
                autoComplete="off"
                aria-controls={resultsId}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
            </label>
            {query.trim().length >= 2 && (
              <ul id={resultsId} aria-label="Matching farms" className="absolute inset-x-0 top-[50px] z-20 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(16,32,26,0.16)]">
                {matches.length === 0 && <li className="px-3 py-3 text-[13px] text-muted">No farm matches “{query.trim()}”.</li>}
                {matches.map((f) => (
                  <li key={f.lotId}>
                    <button type="button" onClick={() => focusFarm(f)} className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-ground-3">
                      <span className="font-mono text-[12px] font-medium">{f.lotId}</span>
                      <span className="text-[12.5px] text-muted">{f.farmer} · {f.village}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-xs font-medium tracking-[0.08em] text-muted uppercase">{legend.title}</legend>
            {legend.items.map((l) => (
              <label key={l.key} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13.5px]">
                <input type="checkbox" checked={!hidden.has(l.key)} onChange={() => toggleCategory(l.key)} className="m-0 size-4 accent-brand" />
                <span className="size-3 flex-none rounded-[4px] border border-black/5" style={{ background: l.color }} />
                <span className="flex-1">{l.label}</span>
                <span className="tabular text-muted">{l.n.toLocaleString('en-IN')}</span>
              </label>
            ))}
          </fieldset>

          <div className="border-t border-line-soft pt-4">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-xs font-medium tracking-[0.08em] text-muted uppercase">Layers</legend>
            <label className="flex min-h-8 items-center gap-2.5 text-[13.5px]"><input type="checkbox" checked={showOutlines} onChange={(e) => setShowOutlines(e.target.checked)} className="m-0 size-4 accent-brand" />Geo-fence outlines</label>
            <label className="flex min-h-8 items-center gap-2.5 text-[13.5px]"><input type="checkbox" checked={showOutside} onChange={(e) => setShowOutside(e.target.checked)} className="m-0 size-4 accent-brand" />Out-of-fence records</label>
            <label className="flex min-h-8 items-center gap-2.5 text-[13.5px] text-faint"><input type="checkbox" disabled className="m-0 size-4" />Isolation distance (Phase 2)</label>
            <label className="flex min-h-8 items-center gap-2.5 text-[13.5px] text-faint"><input type="checkbox" disabled className="m-0 size-4" />Satellite imagery (Phase 2)</label>
          </fieldset>
          </div>

          <p className="mt-auto text-[12px] leading-relaxed text-muted">
            Showing {visible.length.toLocaleString('en-IN')} of {data.farms.length.toLocaleString('en-IN')} farms. Scroll or use + and − to zoom, drag to pan. Select a farm for details.
          </p>
        </aside>

        <div
          ref={wrapRef}
          role="group"
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label="Farm map. Arrow keys pan, plus and minus zoom, Escape closes the farm card."
          className="relative h-[560px] min-w-0 flex-[999_1_440px] overflow-hidden rounded-[20px] border border-[#dce1d9] bg-[#e8ece4] sm:h-[780px]"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Map of ${visible.length} farm geo-fences coloured by ${MODES.find((m) => m.key === mode)!.label.toLowerCase()}`}
            className={cx('absolute inset-0 size-full touch-none select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={(e) => { if (e.target === e.currentTarget || (e.target as Element).getAttribute('data-bg')) { if (!suppressClick.current) setSelected(null); suppressClick.current = false; } }}
          >
            <rect data-bg="1" x={-W} y={-H} width={W * 3} height={H * 3} fill="#e8ece4" />
            {/* Graticule */}
            <g stroke="#dce3d6" strokeWidth={1} fontSize={10} fill="#8a968f">
              {data.graticule.lng.map((g) => <line key={`x${g.label}`} x1={sx(g.x)} x2={sx(g.x)} y1={-H} y2={H * 2} />)}
              {data.graticule.lat.map((g) => <line key={`y${g.label}`} y1={sy(g.y)} y2={sy(g.y)} x1={-W} x2={W * 2} />)}
            </g>
            <g fontSize={10} fill="#8a968f" fontFamily="var(--font-geist-mono), monospace" aria-hidden="true">
              {data.graticule.lng.map((g) => <text key={`tx${g.label}`} x={sx(g.x) + 4} y={edge.y + 14}>{g.label}</text>)}
              {data.graticule.lat.map((g) => <text key={`ty${g.label}`} x={edge.x + 6} y={sy(g.y) - 4}>{g.label}</text>)}
            </g>

            {/* Farm polygons, in map space */}
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} strokeLinejoin="round">
              {visible.map((f) => (
                <polygon
                  key={f.lotId}
                  points={f.points}
                  fill={fillOf(f, mode)}
                  stroke={showOutlines ? (mode === 'stage' && ['sowing', 'transplanting'].includes(f.group) ? '#5aa674' : '#ffffff') : 'none'}
                  strokeWidth={showOutlines ? 1.5 : 0}
                  vectorEffect="non-scaling-stroke"
                  onClick={() => pick(f.lotId)}
                  className="cursor-pointer"
                />
              ))}
              {sel && <polygon points={sel.points} fill={fillOf(sel, mode)} stroke="#10201a" strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            </g>

            {/* Screen-space overlays: constant size at every zoom level */}
            {showMarkers && (
              <g>
                {visible.map((f) => (
                  <circle key={f.lotId} cx={sx(f.cx)} cy={sy(f.cy)} r={4} fill={fillOf(f, mode)} stroke={mode === 'stage' && ['sowing', 'transplanting', 'vegetative'].includes(f.group) ? '#2f7d4e' : '#ffffff'} strokeWidth={1.2} onClick={() => pick(f.lotId)} className="cursor-pointer" />
                ))}
              </g>
            )}

            {showOutside && (
              <g pointerEvents="none">
                {visible.flatMap((f) => f.outside.map((p, i) => (
                  <g key={`${f.lotId}-${i}`}>
                    <circle cx={sx(p.x)} cy={sy(p.y)} r={showMarkers ? 8 : 13} fill="#d98a2b" fillOpacity={0.22} />
                    <circle cx={sx(p.x)} cy={sy(p.y)} r={showMarkers ? 3.5 : 5.5} fill="#b4570f" stroke="#ffffff" strokeWidth={1.5} />
                  </g>
                )))}
              </g>
            )}

            {sel && (
              <g pointerEvents="none">
                {!showMarkers && sel.points.split(' ').map((pt, i) => {
                  const [x, y] = pt.split(',').map(Number) as [number, number];
                  return <circle key={i} cx={sx(x)} cy={sy(y)} r={4.5} fill="#ffffff" stroke="#10201a" strokeWidth={2} />;
                })}
                <g transform={`translate(${sx(sel.cx)} ${sy(sel.cy)})`}>
                  <path d="M0 0 C -4 -6, -10 -10, -10 -18 A 10 10 0 1 1 10 -18 C 10 -10, 4 -6, 0 0 Z" fill="#10201a" stroke="#ffffff" strokeWidth={1.5} />
                  <circle cx={0} cy={-18} r={3.6} fill="#ffffff" />
                </g>
              </g>
            )}

            <g fontSize={12.5} fontWeight={600} textAnchor="middle" pointerEvents="none">
              {data.villages.map((v) => (
                <g key={v.name} transform={`translate(${sx(v.x)} ${sy(v.y)})`}>
                  {view.k < 6 && (
                    <>
                      <circle r={17} fill="#10201a" fillOpacity={0.12} cy={-30} />
                      <circle r={12.5} fill="#10201a" cy={-30} />
                      <text y={-26} fill="#ffffff" fontSize={11.5}>{v.lots}</text>
                    </>
                  )}
                  <text y={view.k < 6 ? 0 : -6} fill="#2e3d36" stroke="#e8ece4" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{v.name}</text>
                </g>
              ))}
            </g>
          </svg>

          {sel && <FarmCard farm={sel} mode={mode} onClose={() => setSelected(null)} />}
          {!sel && (
            <div className="pointer-events-none absolute top-4 right-4 flex items-center gap-2 rounded-xl bg-surface/90 px-3 py-2 text-[12.5px] text-subtle shadow-[0_4px_14px_rgba(16,32,26,0.10)]">
              <Icon name="info" size={14} />Select a farm to see its lot
            </div>
          )}

          <div className="absolute right-4 bottom-4 flex flex-col overflow-hidden rounded-xl bg-surface shadow-[0_4px_14px_rgba(16,32,26,0.14)]">
            <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.6)} disabled={view.k >= MAX_K} className="flex size-11 items-center justify-center border-b border-line-soft hover:bg-ground-3 disabled:opacity-40"><Icon name="plus" strokeWidth={2} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.6)} disabled={view.k <= MIN_K} className="flex size-11 items-center justify-center border-b border-line-soft hover:bg-ground-3 disabled:opacity-40"><Icon name="minus" strokeWidth={2} /></button>
            <button type="button" aria-label="Show all farms" title="Show all farms" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="flex size-11 items-center justify-center hover:bg-ground-3"><Icon name="locate" /></button>
          </div>

          <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-surface/90 px-3 py-2 text-xs text-subtle">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-[5px] border-[1.5px] border-t-0 border-subtle" style={{ width: Math.round(scale.px) }} />
              {scale.label}
            </span>
            <span aria-hidden="true" className="h-3.5 w-px bg-line-strong" />
            <span className="flex items-center gap-1.5"><span className="size-[9px] rounded-full bg-signal" />Out-of-fence record</span>
          </div>
        </div>
      </div>
    </>
  );
}

function focusView(f: MapFarm, k: number): View {
  return { k, x: W / 2 - f.cx * k + 120, y: H / 2 - f.cy * k + 60 };
}

function FarmCard({ farm: f, mode, onClose }: { farm: MapFarm; mode: ColourMode; onClose: () => void }) {
  const variance = areaVariance(f.declaredAreaSqm, f.computedAreaSqm);
  const flagged = Math.abs(variance) > 0.1;
  const farmNo = f.lotId.slice(-2);
  return (
    <section aria-label={`Farm ${f.lotId}`} className="absolute top-4 right-4 z-10 flex w-[340px] max-w-[calc(100%-32px)] flex-col gap-3.5 rounded-[18px] bg-surface p-[18px] shadow-[0_12px_32px_rgba(16,32,26,0.16),0_1px_2px_rgba(16,32,26,0.08)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-semibold tracking-[0.02em]">{f.lotId}</p>
          <p className="mt-1 text-[13px] text-muted">{f.cropName} · {f.cropCode} {f.hybridCode}</p>
        </div>
        <button type="button" aria-label="Close farm details" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-[10px] bg-ground hover:bg-ground-2"><Icon name="x" size={16} strokeWidth={2} /></button>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar initials={initials(f.farmer)} size={38} />
        <div className="leading-[1.35]">
          <div className="text-sm font-medium">{f.farmer}</div>
          <div className="text-[12.5px] text-muted">{f.village}, {f.district} · Farm {farmNo}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="brand">{f.stageName}</Badge>
        {f.nextName && f.nextDays !== null && (
          f.nextDays > 0
            ? <Badge tone="signal">{f.nextName} {fmtDays(f.nextDays)} late</Badge>
            : <Badge tone="sky">{f.nextName} {f.nextDays === 0 ? 'due today' : `due in ${fmtDays(-f.nextDays)}`}</Badge>
        )}
        {mode === 'compliance' && f.compliance === 'review' && <Badge tone="signalStrong">Awaiting review</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3.5 gap-y-3 text-[13px]">
        <div><dt className="text-xs text-muted">Declared area</dt><dd className="mt-0.5 font-medium">{fmtGuntas(f.declaredAreaSqm)}</dd></div>
        <div><dt className="text-xs text-muted">Geo-fence area</dt><dd className="mt-0.5 font-medium">{fmtGuntas(f.computedAreaSqm)} <span className={cx('font-normal', flagged ? 'font-medium text-signal-text' : 'text-muted')}>{fmtSignedPct(variance)}</span></dd></div>
        <div><dt className="text-xs text-muted">Last visit</dt><dd className="mt-0.5 font-medium">{f.lastVisit ? `${fmtDay(f.lastVisit)} · ${f.faName}` : 'No visits yet'}</dd></div>
        <div><dt className="text-xs text-muted">Records</dt><dd className="mt-0.5 font-medium">{f.recordCount} · <span className={f.outsideCount ? 'text-signal-text' : undefined}>{f.outsideCount} outside fence</span></dd></div>
      </dl>
      <Link href={`/lots/${f.lotId}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white hover:bg-brand-strong">
        Open lot<Icon name="arrowRight" size={14} strokeWidth={2} />
      </Link>
    </section>
  );
}

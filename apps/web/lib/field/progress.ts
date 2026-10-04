import { stageProgress, toLocalMetres, type LngLat, type RecordedStage, type StageDefinition, type StageProgress } from '@nk/shared';
import type { BundleLot, FieldBundle, OutboxItem } from './types';

export interface LotRecordLite extends RecordedStage {
  recordUuid: string;
  roundNo: number;
  /** Still on the device, not yet confirmed by the server. */
  local: boolean;
  rejected?: boolean;
}

/** Server records plus records waiting in the outbox (rejected ones excluded). */
export function lotRecords(lot: BundleLot, outbox: readonly OutboxItem[]): LotRecordLite[] {
  const server: LotRecordLite[] = lot.records.map((r) => ({ recordUuid: r.recordUuid, stageCode: r.stageCode, observedOn: r.observedOn, roundNo: r.roundNo, local: false }));
  const seen = new Set(server.map((r) => r.recordUuid));
  const local: LotRecordLite[] = outbox
    .filter((i) => i.record.lotId === lot.lotId && i.status !== 'rejected' && !seen.has(i.recordUuid))
    .map((i) => ({ recordUuid: i.recordUuid, stageCode: i.record.stageCode, observedOn: i.record.observedOn, roundNo: i.record.roundNo, local: true }));
  return [...server, ...local];
}

export function definitionsFor(bundle: FieldBundle, lot: BundleLot): StageDefinition[] {
  return bundle.stages[lot.cropCode] ?? [];
}

export function lotProgress(bundle: FieldBundle, lot: BundleLot, outbox: readonly OutboxItem[]): StageProgress[] {
  return stageProgress({
    definitions: definitionsFor(bundle, lot),
    referenceDate: lot.femaleSowingDate,
    recorded: lotRecords(lot, outbox),
    today: bundle.today,
  });
}

/** Earliest overdue stage, else the next stage due or upcoming (same rule as the dashboard). */
export function nextStage(progress: readonly StageProgress[]): StageProgress | undefined {
  return progress.find((p) => p.status === 'OVERDUE') ?? progress.find((p) => p.status === 'DUE' || p.status === 'UPCOMING');
}

/** Display name for the next record of a stage, e.g. "Harvesting · picking 3". */
export function stageLabel(def: StageDefinition, roundNo: number): string {
  if (!def.repeatable) return def.name;
  if (def.stageCode === 'HARV') return `${def.name} · picking ${roundNo}`;
  return `${def.name} · round ${roundNo}`;
}

export function nextRound(def: StageDefinition, records: readonly LotRecordLite[]): number {
  if (!def.repeatable) return 1;
  const rounds = records.filter((r) => r.stageCode === def.stageCode).map((r) => r.roundNo);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

export interface WorkItem {
  lot: BundleLot;
  progress: StageProgress;
  label: string;
  distanceM: number | null;
}

/** Today's work (M-10): overdue and due-soon stages across the FA's open lots. */
export function todaysWork(bundle: FieldBundle, outbox: readonly OutboxItem[], here: LngLat | null) {
  const overdue: WorkItem[] = [];
  const dueSoon: WorkItem[] = [];
  let doneToday = 0;
  for (const lot of bundle.lots) {
    const recs = lotRecords(lot, outbox);
    doneToday += recs.filter((r) => r.observedOn === bundle.today).length;
    if (lot.status === 'CLOSED') continue;
    const progress = lotProgress(bundle, lot, outbox);
    const next = nextStage(progress);
    if (!next || (next.status !== 'OVERDUE' && next.status !== 'DUE')) continue;
    const item: WorkItem = {
      lot,
      progress: next,
      label: stageLabel(next.definition, nextRound(next.definition, recs)),
      distanceM: here ? distanceM(here, lot.farmCentre) : null,
    };
    (next.status === 'OVERDUE' ? overdue : dueSoon).push(item);
  }
  const byDistance = (a: WorkItem, b: WorkItem) => (a.distanceM ?? 0) - (b.distanceM ?? 0);
  if (here) {
    overdue.sort(byDistance);
    dueSoon.sort(byDistance);
  } else {
    overdue.sort((a, b) => b.progress.daysLate - a.progress.daysLate);
    dueSoon.sort((a, b) => a.progress.dueOn.localeCompare(b.progress.dueOn));
  }
  return { overdue, dueSoon, doneToday };
}

/* ---------- geometry ---------- */

export function distanceM(a: LngLat, b: LngLat): number {
  const p = toLocalMetres(b, a);
  return Math.hypot(p.x, p.y);
}

export function fmtDistance(m: number | null): string {
  if (m === null) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Projects the fence (and optionally a position) into an SVG viewBox, preserving scale. */
export function projectFence(fence: readonly LngLat[], position: LngLat | null, width: number, height: number, pad = 14) {
  const origin = fence[0] ?? position ?? { lng: 0, lat: 0 };
  const pts = fence.map((p) => toLocalMetres(p, origin));
  const pos = position ? toLocalMetres(position, origin) : null;
  // Keep the view centred on the fence; include the position only if it is reasonably close.
  const all = pos && pts.length && Math.hypot(pos.x - pts[0]!.x, pos.y - pts[0]!.y) < 600 ? [...pts, pos] : pts;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, 1), (height - pad * 2) / Math.max(maxY - minY, 1));
  const ox = (width - (maxX - minX) * scale) / 2;
  const oy = (height - (maxY - minY) * scale) / 2;
  const toSvg = (p: { x: number; y: number }) => ({ x: ox + (p.x - minX) * scale, y: oy + (maxY - p.y) * scale });
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    points: pts.map((p) => { const s = toSvg(p); return `${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join(' '),
    position: pos ? (() => { const s = toSvg(pos); return { x: clamp(s.x, 6, width - 6), y: clamp(s.y, 6, height - 6), offscreen: s.x < 0 || s.x > width || s.y < 0 || s.y > height }; })() : null,
    metresToPx: scale,
  };
}

export function shortLotId(lotId: string): string {
  return `…${lotId.slice(-8)}`;
}

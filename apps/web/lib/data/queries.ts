import {
  areaVariance,
  CROPS,
  currentStage,
  getCrop,
  isAreaVarianceFlagged,
  SQM_PER_ACRE,
  stageProgress,
  toUtcDay,
  type StageCode,
  type StageProgress,
} from '@nk/shared';
import { defaultStages } from '@nk/stage-config';
import { db } from './store';
import type { Farm, Farmer, Hybrid, Lot, Organiser, StageRecord, Village } from './types';

/** Overview buckets for a lot's current stage, in field order. */
export const STAGE_GROUPS = [
  { key: 'sowing', label: 'Sowing', codes: ['SOW_M', 'SOW_F'] },
  { key: 'transplanting', label: 'Transplanting', codes: ['ROGUE_F_NURSERY', 'TP_M', 'TP_F'] },
  { key: 'vegetative', label: 'Vegetative', codes: ['VEG'] },
  { key: 'rogueing', label: 'Rogueing', codes: ['ROGUE_M'] },
  { key: 'pollination', label: 'Pollination', codes: ['POLL'] },
  { key: 'maturity', label: 'Maturity', codes: ['ROGUE_F_PREMAT', 'MAT'] },
  { key: 'yield', label: 'Yield estimation', codes: ['ROGUE_F_PREHARV', 'YIELD_EST'] },
  { key: 'harvest', label: 'Harvest', codes: ['HARV', 'PLOW'] },
  { key: 'collection', label: 'Seed collection', codes: ['SEED_COLL'] },
  { key: 'closed', label: 'Closed', codes: ['FINAL_YIELD'] },
] as const satisfies readonly { key: string; label: string; codes: readonly StageCode[] }[];

export type StageGroupKey = (typeof STAGE_GROUPS)[number]['key'];

export function stageGroupOf(code: StageCode | undefined): StageGroupKey {
  if (!code) return 'sowing';
  return STAGE_GROUPS.find((g) => (g.codes as readonly StageCode[]).includes(code))?.key ?? 'sowing';
}

export interface LotView {
  lot: Lot;
  hybrid: Hybrid;
  farmer: Farmer;
  farm: Farm;
  village: Village;
  organiser: Organiser;
  faName: string;
  records: StageRecord[];
  progress: StageProgress[];
  current?: StageProgress;
  group: StageGroupKey;
  /** Earliest stage that is overdue, or the next one due. */
  next?: StageProgress;
  overdueDays: number;
  estimateKg: number | null;
  finalKg: number | null;
}

let cache: { key: number; views: LotView[] } | null = null;

/** Joined, derived view of every lot. Recomputed when records change. */
export function lotViews(): LotView[] {
  const d = db();
  const key = d.records.length + d.decisions.length * 1e6;
  if (cache?.key === key) return cache.views;

  const by = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const hybrids = by(d.hybrids);
  const farmers = by(d.farmers);
  const farms = by(d.farms);
  const villages = by(d.villages);
  const organisers = by(d.organisers);
  const users = by(d.users);
  const recordsByLot = new Map<string, StageRecord[]>();
  for (const r of d.records) recordsByLot.set(r.lotId, [...(recordsByLot.get(r.lotId) ?? []), r]);
  const defsByCrop = new Map(CROPS.map((c) => [c.code, defaultStages(c.code)]));

  const views = d.lots.map((lot): LotView => {
    const hybrid = hybrids.get(lot.hybridId)!;
    const farmer = farmers.get(lot.farmerId)!;
    const records = (recordsByLot.get(lot.lotId) ?? []).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const progress = stageProgress({
      definitions: defsByCrop.get(hybrid.cropCode)!,
      referenceDate: lot.femaleSowingDate,
      recorded: records.map((r) => ({ stageCode: r.stageCode, observedOn: r.observedOn })),
      today: d.today,
    });
    const current = currentStage(progress);
    const overdue = progress.filter((p) => p.status === 'OVERDUE');
    const next = overdue[0] ?? progress.find((p) => p.status === 'DUE' || p.status === 'UPCOMING');
    const latest = (code: StageCode, key: string) => {
      const r = [...records].reverse().find((x) => x.stageCode === code);
      return r ? Number(r.data[key]) : null;
    };
    return {
      lot, hybrid, farmer, farm: farms.get(lot.farmId)!, village: villages.get(farmer.villageId)!,
      organiser: organisers.get(lot.organiserId)!, faName: users.get(lot.faId)?.name ?? '—',
      records, progress, current, group: lot.status === 'CLOSED' ? 'closed' : stageGroupOf(current?.definition.stageCode),
      next, overdueDays: overdue[0]?.daysLate ?? 0,
      estimateKg: latest('YIELD_EST', 'estimated_seed_kg'),
      finalKg: latest('FINAL_YIELD', 'final_seed_kg'),
    };
  });
  cache = { key, views };
  return views;
}

export function lotView(lotId: string): LotView | undefined {
  return lotViews().find((v) => v.lot.lotId === lotId);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function seasonOverview() {
  const d = db();
  const views = lotViews();
  const records = d.records;
  const inside = records.filter((r) => r.insideGeofence && !r.mockLocation).length;
  const pending = records.filter((r) => r.reviewStatus === 'PENDING' && !d.decisions.some((x) => x.itemId === `rec:${r.id}`)).length;
  const withPhotos = records.filter((r) => r.photoCount > 0 || r.stageCode === 'SEED_COLL' || r.stageCode === 'FINAL_YIELD').length;
  const goodGps = records.filter((r) => r.gpsAccuracyM <= 50).length;
  const harvestPlus = views.filter((v) => ['harvest', 'collection', 'closed'].includes(v.group));

  const targetKg = sum(views.map((v) => v.lot.targetYieldKg));
  // Lots without an estimate yet count at target, so the season figure stays comparable.
  const estimateKg = sum(views.map((v) => v.estimateKg ?? v.lot.targetYieldKg));

  const stages = STAGE_GROUPS.map((g) => {
    const vs = views.filter((v) => v.group === g.key);
    return { key: g.key, label: g.label, count: vs.length, areaSqm: sum(vs.map((v) => v.lot.contractedAreaSqm)) };
  });

  const overdue = views
    .filter((v) => v.overdueDays > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const hybridRows = d.hybrids
    .map((h) => {
      const vs = views.filter((v) => v.hybrid.id === h.id);
      return {
        hybrid: h,
        crop: getCrop(h.cropCode)!,
        areaSqm: sum(vs.map((v) => v.lot.contractedAreaSqm)),
        targetKg: sum(vs.map((v) => v.lot.targetYieldKg)),
        estimateKg: sum(vs.map((v) => v.estimateKg ?? v.lot.targetYieldKg)),
        finalKg: sum(vs.map((v) => v.finalKg ?? 0)),
        lots: vs.length,
      };
    })
    .filter((r) => r.lots > 0)
    .sort((a, b) => b.areaSqm - a.areaSqm);

  return {
    today: d.today,
    lots: views.length,
    closed: views.filter((v) => v.lot.status === 'CLOSED').length,
    contractedSqm: sum(views.map((v) => v.lot.contractedAreaSqm)),
    farms: new Set(views.map((v) => v.farm.id)).size,
    districts: new Set(views.map((v) => v.village.districtCode)).size,
    targetKg,
    estimateKg,
    finalKg: sum(views.map((v) => v.finalKg ?? 0)),
    harvestPlusLots: harvestPlus.length,
    records: records.length,
    insideRecords: inside,
    outsideRecords: records.length - inside,
    pendingReview: pending,
    photosPct: records.length ? withPhotos / records.length : 0,
    gpsGoodPct: records.length ? goodGps / records.length : 0,
    mockFlags: records.filter((r) => r.mockLocation).length,
    recordsToday: records.filter((r) => r.observedOn === d.today).length,
    stages,
    overdue,
    hybridRows,
    organisers: organiserPerformance(),
  };
}

export function organiserPerformance() {
  const d = db();
  const views = lotViews();
  return d.organisers
    .map((o) => {
      const vs = views.filter((v) => v.organiser.id === o.id);
      const lotIds = new Set(vs.map((v) => v.lot.lotId));
      const recs = d.records.filter((r) => lotIds.has(r.lotId));
      const target = sum(vs.map((v) => v.lot.targetYieldKg));
      const est = sum(vs.map((v) => v.estimateKg ?? v.lot.targetYieldKg));
      return {
        organiser: o,
        lots: vs.length,
        areaSqm: sum(vs.map((v) => v.lot.contractedAreaSqm)),
        insidePct: recs.length ? recs.filter((r) => r.insideGeofence).length / recs.length : 1,
        yieldVsTarget: target ? est / target : 1,
        overdue: vs.filter((v) => v.overdueDays > 0).length,
      };
    })
    .sort((a, b) => b.lots - a.lots);
}

export interface LotFilter {
  group?: StageGroupKey | 'all';
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listLots({ group = 'all', q = '', page = 1, pageSize = 20 }: LotFilter) {
  const needle = q.trim().toLowerCase();
  const all = lotViews();
  const filtered = all.filter((v) =>
    (group === 'all' || v.group === group) &&
    (!needle || [v.lot.lotId, v.farmer.name, v.village.name, v.faName, v.organiser.name].some((s) => s.toLowerCase().includes(needle))),
  );
  const counts = Object.fromEntries(STAGE_GROUPS.map((g) => [g.key, all.filter((v) => v.group === g.key).length])) as Record<StageGroupKey, number>;
  return {
    total: filtered.length,
    all: all.length,
    counts,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    rows: filtered.sort((a, b) => b.overdueDays - a.overdueDays || a.lot.lotId.localeCompare(b.lot.lotId)).slice((page - 1) * pageSize, page * pageSize),
  };
}

export type ReviewKind = 'geo' | 'mock' | 'area' | 'dup';

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  headline: string;
  when: string;
  lot: LotView;
  record?: StageRecord;
  stageName: string;
  decision?: { decision: 'APPROVED' | 'REJECTED'; comment: string };
}

export function reviewQueue(): ReviewItem[] {
  const d = db();
  const views = lotViews();
  const byLot = new Map(views.map((v) => [v.lot.lotId, v]));
  const decided = new Map(d.decisions.map((x) => [x.itemId, x]));
  const items: ReviewItem[] = [];

  for (const r of d.records) {
    // Items decided this session stay listed so the UI can show the decision and offer Undo.
    if (r.reviewStatus !== 'PENDING' && !decided.has(`rec:${r.id}`)) continue;
    const lot = byLot.get(r.lotId)!;
    const def = lot.progress.find((p) => p.definition.stageCode === r.stageCode)?.definition;
    const stageName = `${def?.name ?? r.stageCode}${def?.repeatable ? ` · round ${r.roundNo}` : ''}`;
    if (r.mockLocation) {
      items.push({ id: `rec:${r.id}`, kind: 'mock', severity: 'High', title: 'Android reported a mock location provider', headline: 'Mock GPS flag', when: r.capturedAt, lot, record: r, stageName });
    } else {
      items.push({
        id: `rec:${r.id}`, kind: 'geo', severity: r.distanceOutsideM > 50 ? 'High' : 'Medium',
        title: `Record captured ${r.distanceOutsideM} m outside the fence`, headline: `${r.distanceOutsideM} m out · ±${r.gpsAccuracyM} m`,
        when: r.capturedAt, lot, record: r, stageName,
      });
    }
  }

  for (const v of views) {
    if (!isAreaVarianceFlagged(v.farm.declaredAreaSqm, v.farm.computedAreaSqm)) continue;
    const pct = areaVariance(v.farm.declaredAreaSqm, v.farm.computedAreaSqm) * 100;
    items.push({
      id: `farm:${v.farm.id}`, kind: 'area', severity: Math.abs(pct) > 15 ? 'Medium' : 'Low',
      title: `Geo-fence is ${Math.abs(pct).toFixed(1)}% ${pct < 0 ? 'smaller' : 'larger'} than declared`,
      headline: `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`, when: v.lot.createdAt, lot: v, stageName: 'Farm registration',
    });
  }

  const sevRank = { High: 0, Medium: 1, Low: 2 };
  return items
    .map((i) => {
      const dec = decided.get(i.id);
      return dec ? { ...i, decision: { decision: dec.decision, comment: dec.comment } } : i;
    })
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.when.localeCompare(a.when));
}

export function recordDecision(itemId: string, decision: 'APPROVED' | 'REJECTED', comment: string, by: string) {
  const d = db();
  d.decisions = d.decisions.filter((x) => x.itemId !== itemId);
  d.decisions.push({ itemId, decision, comment, by, at: new Date().toISOString() });
  if (itemId.startsWith('rec:')) {
    const rec = d.records.find((r) => r.id === itemId.slice(4));
    if (rec) {
      rec.reviewStatus = decision;
      rec.reviewedBy = by;
      rec.reviewComment = comment;
      d.audit.push({ id: `a-${Date.now()}`, lotId: rec.lotId, actorId: by, action: `${decision === 'APPROVED' ? 'approved' : 'rejected'} out-of-fence record (${rec.stageCode})`, at: new Date().toISOString(), via: 'web' });
    }
  }
}

export function undoDecision(itemId: string) {
  const d = db();
  d.decisions = d.decisions.filter((x) => x.itemId !== itemId);
  if (itemId.startsWith('rec:')) {
    const rec = d.records.find((r) => r.id === itemId.slice(4));
    if (rec) rec.reviewStatus = 'PENDING';
  }
}

export function auditFor(lotId: string) {
  const d = db();
  const users = new Map(d.users.map((u) => [u.id, u]));
  const fromRecords = d.records
    .filter((r) => r.lotId === lotId)
    .map((r) => ({ id: `ra-${r.id}`, lotId, actorId: r.capturedBy, action: `added ${r.stageCode} record${r.roundNo > 1 ? ` (round ${r.roundNo})` : ''}`, at: r.capturedAt, via: `device ${r.deviceId}` }));
  return [...d.audit.filter((a) => a.lotId === lotId), ...fromRecords]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((a) => ({ ...a, actorName: users.get(a.actorId)?.name ?? a.actorId }));
}

export function mapFarms() {
  return lotViews().map((v) => ({
    lotId: v.lot.lotId,
    farmer: v.farmer.name,
    village: v.village.name,
    cropCode: v.hybrid.cropCode,
    hybridCode: v.hybrid.hybridCode,
    group: v.group,
    fence: v.farm.geofence,
    declaredAreaSqm: v.farm.declaredAreaSqm,
    computedAreaSqm: v.farm.computedAreaSqm,
    compliance: (v.records.some((r) => r.reviewStatus === 'PENDING') ? 'review' : v.records.some((r) => !r.insideGeofence) ? 'reason' : 'ok') as 'review' | 'reason' | 'ok',
    outside: v.records.filter((r) => !r.insideGeofence).map((r) => r.gps),
    stageName: v.current?.definition.name ?? 'Not started',
    nextName: v.next?.definition.name,
    nextDays: v.next ? v.next.daysLate : null,
    lastVisit: v.records.at(-1)?.observedOn ?? null,
    faName: v.faName,
    recordCount: v.records.length,
    outsideCount: v.records.filter((r) => !r.insideGeofence).length,
  }));
}

export function mastersSummary() {
  const d = db();
  const views = lotViews();
  return {
    villages: d.villages,
    organisers: d.organisers.map((o) => ({ organiser: o, village: d.villages.find((v) => v.id === o.villageId)!, farmers: d.farmers.filter((f) => f.organiserId === o.id).length })),
    hybrids: d.hybrids.map((h) => ({ hybrid: h, crop: getCrop(h.cropCode)!, lots: views.filter((v) => v.hybrid.id === h.id).length })),
    farmers: d.farmers.length,
    farms: d.farms.length,
  };
}

export function usersSummary() {
  const d = db();
  const views = lotViews();
  return d.users.map((u) => {
    const mine = u.role === 'FIELD_ASSISTANT' ? views.filter((v) => v.lot.faId === u.id) : u.role === 'ORGANISER' ? views.filter((v) => v.organiser.code === u.id.replace('u-org-', '')) : [];
    const recs = d.records.filter((r) => r.capturedBy === u.id);
    return {
      user: u,
      villages: u.villageIds.map((id) => d.villages.find((v) => v.id === id)!.name),
      lots: u.role === 'FIELD_ASSISTANT' || u.role === 'ORGANISER' ? mine.length : u.role === 'SUPERVISOR' ? views.filter((v) => v.village.districtName === u.scopeLabel.replace(' district', '')).length : views.length,
      records: recs.length,
      overdue: mine.filter((v) => v.overdueDays > 0).length,
      insidePct: recs.length ? recs.filter((r) => r.insideGeofence).length / recs.length : null,
      stale: !!u.lastSyncAt && u.deviceId !== null && toUtcDay(d.today) - toUtcDay(u.lastSyncAt) >= 2,
    };
  });
}

/** Lots with a stage due or overdue for one field assistant (field PWA). */
export function fieldWork(faId: string) {
  const views = lotViews().filter((v) => v.lot.faId === faId && v.lot.status !== 'CLOSED');
  const overdue = views.filter((v) => v.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays);
  const dueSoon = views.filter((v) => v.overdueDays === 0 && v.next && v.next.status === 'DUE').sort((a, b) => a.next!.dueOn.localeCompare(b.next!.dueOn));
  return { overdue, dueSoon };
}

export const acres = (sqm: number) => sqm / SQM_PER_ACRE;

/** Weekly series for the last `weeks` weeks ending today: records captured and share inside the fence. */
export function weeklyActivity(weeks = 9) {
  const d = db();
  const end = toUtcDay(d.today);
  return Array.from({ length: weeks }, (_, i) => {
    const to = end - (weeks - 1 - i) * 7;
    const recs = d.records.filter((r) => { const day = toUtcDay(r.observedOn); return day > to - 7 && day <= to; });
    return { records: recs.length, insidePct: recs.length ? recs.filter((r) => r.insideGeofence).length / recs.length : 1 };
  });
}

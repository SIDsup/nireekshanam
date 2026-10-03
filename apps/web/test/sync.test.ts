import { centroid, checkFence, type LngLat } from '@nk/shared';
import { describe, expect, it } from 'vitest';
import { buildDataset } from '../lib/data/seed';
import type { Dataset } from '../lib/data/types';
import { applyPush, PushEnvelopeError } from '../lib/field/push';

const FA = 'u-fa-1';

function fixture() {
  const d: Dataset = buildDataset();
  // An open lot of the FA with no VEG record yet would need a crop-specific search; use a
  // repeatable stage (ROGUE_M) so a new record is always allowed.
  const lot = d.lots.find((l) => l.faId === FA && l.status === 'ACTIVE')!;
  const farm = d.farms.find((f) => f.id === lot.farmId)!;
  return { d, lot, farm };
}

let n = 0;
function uuid(): string {
  n++;
  return `0190a6b2-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

function record(lotId: string, gps: LngLat, extra: Record<string, unknown> = {}) {
  return {
    recordUuid: uuid(),
    lotId,
    stageCode: 'ROGUE_M',
    roundNo: 9,
    observedOn: '2026-10-01',
    capturedAt: '2026-10-01T05:12:00+05:30',
    gps,
    gpsAccuracyM: 6,
    insideGeofence: true,
    capturedBy: FA,
    deviceId: 'web-test',
    appVersion: 'test',
    data: { visit_date: '2026-10-01', off_types_removed: 12, reason: 'Off-type' },
    photoIds: ['0190a6b2-0000-7000-8000-aaaaaaaaaaaa'],
    ...extra,
  };
}

const push = (records: unknown[]) => ({ deviceId: 'web-test', lastPulledAt: 0, changes: { stageRecords: { created: records } } });

describe('sync push', () => {
  it('accepts a valid record inside the fence and stores the server fence check', () => {
    const { d, lot, farm } = fixture();
    const before = d.records.length;
    const r = record(lot.lotId, centroid(farm.geofence));
    const res = applyPush(d, push([r]), { faId: FA });
    expect(res.accepted).toEqual([r.recordUuid]);
    expect(res.rejected).toEqual([]);
    expect(d.records.length).toBe(before + 1);
    const stored = d.records.at(-1)!;
    expect(stored.insideGeofence).toBe(true);
    expect(stored.reviewStatus).toBe('NONE');
    expect(stored.photoCount).toBe(1);
  });

  it('is idempotent by recordUuid', () => {
    const { d, lot, farm } = fixture();
    const r = record(lot.lotId, centroid(farm.geofence));
    applyPush(d, push([r]), { faId: FA });
    const after = d.records.length;
    const again = applyPush(d, push([r, r]), { faId: FA });
    expect(again.accepted).toEqual([r.recordUuid, r.recordUuid]);
    expect(d.records.length).toBe(after);
  });

  it('re-checks the fence on the server and flags far-outside records for review', () => {
    const { d, lot, farm } = fixture();
    const c = centroid(farm.geofence);
    const far = { lng: c.lng + 0.01, lat: c.lat };
    expect(checkFence(far, farm.geofence, 6).acceptable).toBe(false);
    // The device claims "inside" (no reason), the server knows better.
    const r = record(lot.lotId, far);
    const res = applyPush(d, push([r]), { faId: FA });
    expect(res.accepted).toEqual([r.recordUuid]);
    const stored = d.records.find((x) => x.id === r.recordUuid)!;
    expect(stored.insideGeofence).toBe(false);
    expect(stored.distanceOutsideM).toBeGreaterThan(500);
    expect(stored.reviewStatus).toBe('PENDING');
    expect(stored.outOfFenceReason).toMatch(/No reason given/);
  });

  it('flags mock locations even inside the fence', () => {
    const { d, lot, farm } = fixture();
    const r = record(lot.lotId, centroid(farm.geofence), { mockLocationDetected: true });
    applyPush(d, push([r]), { faId: FA });
    expect(d.records.find((x) => x.id === r.recordUuid)!.reviewStatus).toBe('PENDING');
  });

  it('rejects invalid records with a reason and keeps the valid ones', () => {
    const { d, lot, farm } = fixture();
    const good = record(lot.lotId, centroid(farm.geofence));
    const noReason = record(lot.lotId, centroid(farm.geofence), { insideGeofence: false });
    const badLot = record('0126HP2041015TS999901', centroid(farm.geofence));
    const future = record(lot.lotId, centroid(farm.geofence), { observedOn: '2026-12-01' });
    const noPhoto = record(lot.lotId, centroid(farm.geofence), { photoIds: [] });
    const otherFa = d.lots.find((l) => l.faId !== FA)!;
    const notMine = record(otherFa.lotId, centroid(farm.geofence));
    const res = applyPush(d, push([good, noReason, badLot, future, noPhoto, notMine]), { faId: FA });
    expect(res.accepted).toEqual([good.recordUuid]);
    const reasons = Object.fromEntries(res.rejected.map((x) => [x.recordUuid, x.reason]));
    expect(reasons[noReason.recordUuid]).toMatch(/reason is required/);
    expect(reasons[badLot.recordUuid]).toMatch(/not found/);
    expect(reasons[future.recordUuid]).toMatch(/future/);
    expect(reasons[noPhoto.recordUuid]).toMatch(/photo/);
    expect(reasons[notMine.recordUuid]).toMatch(/not assigned/);
  });

  it('renumbers a clashing round of a repeatable stage', () => {
    const { d, lot, farm } = fixture();
    const a = record(lot.lotId, centroid(farm.geofence), { roundNo: 1 });
    applyPush(d, push([a]), { faId: FA });
    const rounds = d.records.filter((r) => r.lotId === lot.lotId && r.stageCode === 'ROGUE_M').map((r) => r.roundNo);
    expect(new Set(rounds).size).toBe(rounds.length);
  });

  it('rejects a second record of a non-repeatable stage unless it is a correction', () => {
    const { d } = fixture();
    const existing = d.records.find((r) => r.capturedBy === FA && r.stageCode === 'SOW_F' && d.lots.find((l) => l.lotId === r.lotId)!.status === 'ACTIVE')!;
    const farm = d.farms.find((f) => f.id === d.lots.find((l) => l.lotId === existing.lotId)!.farmId)!;
    const base = { stageCode: 'SOW_F', roundNo: 1, data: { sowing_date: '2026-06-01', seed_qty_g: 400 } };
    const dup = record(existing.lotId, centroid(farm.geofence), base);
    const fix = record(existing.lotId, centroid(farm.geofence), { ...base, supersedes: existing.id });
    const res = applyPush(d, push([dup, fix]), { faId: FA });
    expect(res.rejected.map((r) => r.recordUuid)).toEqual([dup.recordUuid]);
    expect(res.accepted).toEqual([fix.recordUuid]);
  });

  it('throws on a malformed envelope', () => {
    const { d } = fixture();
    expect(() => applyPush(d, { nope: true }, { faId: FA })).toThrow(PushEnvelopeError);
  });
});

describe('device-side progress', async () => {
  const { buildFieldBundle } = await import('../lib/field/bundle');
  const { todaysWork, lotRecords, lotProgress, projectFence } = await import('../lib/field/progress');
  const { db } = await import('../lib/data/store');
  const { fieldWork } = await import('../lib/data/queries');

  it('matches the dashboard rule for overdue and due lots', () => {
    const fa = db().users.find((u) => u.id === FA)!;
    const bundle = buildFieldBundle(fa);
    const work = todaysWork(bundle, [], null);
    const server = fieldWork(FA);
    expect(work.overdue.map((w) => w.lot.lotId).sort()).toEqual(server.overdue.map((v) => v.lot.lotId).sort());
    expect(work.dueSoon.map((w) => w.lot.lotId).sort()).toEqual(server.dueSoon.map((v) => v.lot.lotId).sort());
  });

  it('counts an outbox record as done until the server confirms it', () => {
    const fa = db().users.find((u) => u.id === FA)!;
    const bundle = buildFieldBundle(fa);
    const item = todaysWork(bundle, [], null).overdue[0]!;
    const rec = { ...record(item.lot.lotId, item.lot.farmCentre), stageCode: item.progress.definition.stageCode, roundNo: 1, observedOn: bundle.today };
    const outbox = [{ recordUuid: rec.recordUuid, record: rec as never, status: 'pending' as const, createdAt: 0, attempts: 0, stageName: '', farmerName: '', photoCount: 1, photoBytes: 1 }];
    expect(lotRecords(item.lot, outbox).some((r) => r.local)).toBe(true);
    const p = lotProgress(bundle, item.lot, outbox).find((x) => x.definition.stageCode === item.progress.definition.stageCode)!;
    expect(['DONE', 'IN_PROGRESS']).toContain(p.status);
    expect(todaysWork(bundle, outbox, null).doneToday).toBeGreaterThan(todaysWork(bundle, [], null).doneToday);
    // A rejected record does not count.
    expect(lotRecords(item.lot, [{ ...outbox[0]!, status: 'rejected' }]).some((r) => r.local)).toBe(false);
  });

  it('projects a fence into the SVG box', () => {
    const fa = db().users.find((u) => u.id === FA)!;
    const lot = buildFieldBundle(fa).lots[0]!;
    const proj = projectFence(lot.geofence, lot.farmCentre, 360, 120);
    for (const pt of proj.points.split(' ')) {
      const [x, y] = pt.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(360);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(120);
    }
    expect(proj.position?.offscreen).toBe(false);
  });
});

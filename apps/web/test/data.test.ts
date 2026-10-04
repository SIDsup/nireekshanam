import { isValidLotId } from '@nk/shared';
import { describe, expect, it } from 'vitest';
import { listLots, lotViews, reviewQueue, seasonOverview } from '../lib/data/queries';
import { db } from '../lib/data/store';

describe('demo dataset', () => {
  it('produces valid, unique lot IDs', () => {
    const ids = db().lots.map((l) => l.lotId);
    expect(ids.every(isValidLotId)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never records a stage in the future', () => {
    const today = db().today;
    expect(db().records.every((r) => r.observedOn <= today)).toBe(true);
  });

  it('has overview numbers that add up', () => {
    const o = seasonOverview();
    expect(o.stages.reduce((a, s) => a + s.count, 0)).toBe(o.lots);
    expect(o.insideRecords + o.outsideRecords).toBe(o.records);
    console.log(JSON.stringify({
      lots: o.lots, closed: o.closed, acres: Math.round(o.contractedSqm / 4046.86), records: o.records,
      inside: (o.insideRecords / o.records).toFixed(3), pending: o.pendingReview, overdue: o.overdue.length,
      stages: o.stages.map((s) => `${s.label}:${s.count}`).join(' '), review: reviewQueue().length,
      est: Math.round(o.estimateKg), target: Math.round(o.targetKg), final: Math.round(o.finalKg),
    }));
  });

  it('filters lots by stage group and search', () => {
    const all = listLots({});
    expect(all.total).toBe(lotViews().length);
    const first = lotViews()[0]!;
    expect(listLots({ q: first.lot.lotId }).rows[0]?.lot.lotId).toBe(first.lot.lotId);
  });
});

import { describe, expect, it } from 'vitest';
import { estimateSeedKg, formatPercent, hybridSchema, stageRecordSchema, targetYieldKg, variance } from '../src';

describe('yield', () => {
  it('estimates seed from sample counts', () => {
    expect(estimateSeedKg({ femalePlants: 7420, fruitsPerPlant: 40, seedGramsPerFruit: 1.1 })).toBe(326.5);
  });
  it('computes variance and target', () => {
    expect(variance(270, 300)).toBeCloseTo(-0.1);
    expect(variance(10, 0)).toBeNull();
    expect(targetYieldKg(2.5, 120)).toBe(300);
    expect(formatPercent(-0.05)).toBe('−5.0%');
    expect(formatPercent(0.064)).toBe('+6.4%');
  });
});

describe('schemas', () => {
  it('validates hybrid codes', () => {
    expect(hybridSchema.safeParse({ cropCode: 'HP', hybridCode: '2041', femaleCode: 'F7K2', maleCode: 'M3P1', ratioFemaleMale: '4:1', expectedYieldKgPerAcre: 120 }).success).toBe(true);
    expect(hybridSchema.safeParse({ cropCode: 'HP', hybridCode: '2041', femaleCode: 'F7K2', maleCode: 'M3P', ratioFemaleMale: '4:1', expectedYieldKgPerAcre: 120 }).success).toBe(false);
  });

  it('requires a reason for out-of-fence records', () => {
    const base = {
      recordUuid: '0192f5a8-1c2b-7d3e-8f40-123456789abc', lotId: '0126HP2041015TS004201', stageCode: 'ROGUE_M', observedOn: '2026-09-08',
      capturedAt: '2026-09-08T10:12:00+05:30', gps: { lng: 77.89, lat: 17.18 }, gpsAccuracyM: 8, insideGeofence: false,
      capturedBy: 'u1', deviceId: 'd1', appVersion: '0.1.0', data: {},
    };
    expect(stageRecordSchema.safeParse(base).success).toBe(false);
    expect(stageRecordSchema.safeParse({ ...base, outOfFenceReason: 'Path flooded' }).success).toBe(true);
  });
});

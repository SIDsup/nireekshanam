import { getCrop } from '@nk/shared';
import { defaultStages } from '@nk/stage-config';
import { lotViews } from '../data/queries';
import { DEMO_TODAY } from '../data/seed';
import { db } from '../data/store';
import type { AppUser } from '../data/types';
import { initials } from '../format';
import type { BundleLot, FieldBundle } from './types';

export const DEMO_FA_ID = 'u-fa-1';

/** The field assistant whose work the field app shows. Non-FA viewers see the demo FA. */
export function resolveFieldAssistant(user: AppUser | null): { fa: AppUser; demo: boolean } {
  if (user?.role === 'FIELD_ASSISTANT') return { fa: user, demo: false };
  return { fa: db().users.find((u) => u.id === DEMO_FA_ID)!, demo: true };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Everything a field assistant needs to work offline (M-02). */
export function buildFieldBundle(fa: AppUser): FieldBundle {
  const d = db();
  const views = lotViews().filter((v) => v.lot.faId === fa.id);
  const crops = new Set<string>();

  const lots = views.map((v): BundleLot => {
    crops.add(v.hybrid.cropCode);
    const latest = (code: string, key: string) => {
      for (let i = v.records.length - 1; i >= 0; i--) {
        const r = v.records[i]!;
        if (r.stageCode === code && num(r.data[key]) !== null) return num(r.data[key]);
      }
      return null;
    };
    const crop = getCrop(v.hybrid.cropCode);
    return {
      lotId: v.lot.lotId,
      status: v.lot.status,
      farmer: { name: v.farmer.name, code: v.farmer.code },
      village: { name: v.village.name },
      cropCode: v.hybrid.cropCode,
      cropName: crop?.name ?? v.hybrid.cropCode,
      hybridCode: v.hybrid.hybridCode,
      ratio: v.hybrid.ratio,
      isTransplanted: crop?.isTransplanted ?? false,
      femaleSowingDate: v.lot.femaleSowingDate,
      contractedAreaSqm: Math.round(v.lot.contractedAreaSqm),
      targetYieldKg: v.lot.targetYieldKg,
      farmCentre: v.farm.location,
      geofence: v.farm.geofence,
      facts: {
        femalePlants: latest('TP_F', 'seedlings_planted'),
        malePlants: latest('TP_M', 'seedlings_planted'),
        estimateKg: v.estimateKg,
      },
      records: v.records.map((r) => ({
        recordUuid: r.id,
        stageCode: r.stageCode,
        roundNo: r.roundNo,
        observedOn: r.observedOn,
        insideGeofence: r.insideGeofence,
        reviewStatus: r.reviewStatus,
      })),
    };
  });

  return {
    version: 1,
    serverTime: Date.now(),
    today: d.today,
    demo: d.today === DEMO_TODAY,
    season: 'Kharif 2026',
    fa: { id: fa.id, name: fa.name, initials: initials(fa.name), deviceId: fa.deviceId },
    lots,
    stages: Object.fromEntries([...crops].map((c) => [c, defaultStages(c)])),
  };
}

import { getCrop, TRANSPLANT_ONLY_STAGES, type StageCode, type StageDefinition } from '@nk/shared';
import { FORMS } from './forms';

type Row = Omit<StageDefinition, 'cropCode' | 'requiresGeofence'>;

/**
 * Default stage sequence (SPECS §3.4). Day offsets count from female sowing and
 * reflect a typical transplanted hot-pepper crop; tune them per crop in the editor.
 */
const BASE: readonly Row[] = [
  { stageCode: 'SOW_M', name: 'Sowing · male', sequence: 10, appliesToParent: 'MALE', repeatable: false, mandatory: true, expectedDayOffset: -6, minPhotos: 1, fields: FORMS.sowing },
  { stageCode: 'SOW_F', name: 'Sowing · female', sequence: 11, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 0, minPhotos: 1, fields: FORMS.sowing },
  { stageCode: 'ROGUE_F_NURSERY', name: 'Female rogueing · nursery', sequence: 15, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 28, minPhotos: 1, fields: FORMS.rogueing },
  { stageCode: 'TP_M', name: 'Transplanting · male', sequence: 20, appliesToParent: 'MALE', repeatable: false, mandatory: true, expectedDayOffset: 30, minPhotos: 1, fields: FORMS.transplanting },
  { stageCode: 'TP_F', name: 'Transplanting · female', sequence: 21, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 34, minPhotos: 1, fields: FORMS.transplantingFemale },
  { stageCode: 'VEG', name: 'Vegetative', sequence: 30, appliesToParent: 'BOTH', repeatable: false, mandatory: true, expectedDayOffset: 54, minPhotos: 1, fields: FORMS.vegetative },
  { stageCode: 'ROGUE_M', name: 'Male rogueing', sequence: 40, appliesToParent: 'MALE', repeatable: true, mandatory: true, expectedDayOffset: 66, minPhotos: 1, fields: FORMS.rogueing },
  { stageCode: 'POLL', name: 'Pollination', sequence: 50, appliesToParent: 'BOTH', repeatable: false, mandatory: true, expectedDayOffset: 88, minPhotos: 2, fields: FORMS.pollination },
  { stageCode: 'ROGUE_F_PREMAT', name: 'Female rogueing · pre-maturity', sequence: 60, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 109, minPhotos: 1, fields: FORMS.rogueing },
  { stageCode: 'MAT', name: 'Maturity', sequence: 70, appliesToParent: 'BOTH', repeatable: false, mandatory: true, expectedDayOffset: 125, minPhotos: 1, fields: FORMS.maturity },
  { stageCode: 'ROGUE_F_PREHARV', name: 'Female rogueing · pre-harvest', sequence: 80, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 135, minPhotos: 1, fields: FORMS.rogueing },
  { stageCode: 'YIELD_EST', name: 'Estimation of seed yield', sequence: 90, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 140, minPhotos: 2, fields: FORMS.yieldEstimation },
  { stageCode: 'HARV', name: 'Harvesting', sequence: 100, appliesToParent: 'FEMALE', repeatable: true, mandatory: true, expectedDayOffset: 150, minPhotos: 1, fields: FORMS.harvesting },
  { stageCode: 'PLOW', name: 'Plow down', sequence: 110, appliesToParent: 'BOTH', repeatable: false, mandatory: true, expectedDayOffset: 185, minPhotos: 1, fields: FORMS.plowDown },
  { stageCode: 'SEED_COLL', name: 'Seed collection', sequence: 120, appliesToParent: 'FEMALE', repeatable: true, mandatory: true, expectedDayOffset: 188, minPhotos: 0, fields: FORMS.seedCollection },
  { stageCode: 'FINAL_YIELD', name: 'Final seed yield', sequence: 130, appliesToParent: 'FEMALE', repeatable: false, mandatory: true, expectedDayOffset: 200, minPhotos: 0, fields: FORMS.finalYield },
];

/** Direct-sown crops skip the nursery, so field stages arrive about a month earlier. */
const DIRECT_SOWN_SHIFT = 30;

export function defaultStages(cropCode: string): StageDefinition[] {
  const crop = getCrop(cropCode);
  if (!crop) throw new Error(`Unknown crop ${cropCode}`);
  return BASE
    .filter((s) => crop.isTransplanted || !TRANSPLANT_ONLY_STAGES.includes(s.stageCode))
    .map((s) => {
      let row: Row = s;
      if (!crop.isTransplanted && s.expectedDayOffset > 0) {
        row = { ...row, expectedDayOffset: Math.max(1, s.expectedDayOffset - DIRECT_SOWN_SHIFT) };
      }
      if (cropCode === 'SC' && s.stageCode === 'POLL') {
        row = { ...row, name: 'Pollination · detasseling', fields: FORMS.detasseling };
      }
      if (!crop.isTransplanted) {
        row = { ...row, fields: row.fields.filter((f) => !f.transplantedOnly) };
      }
      return { ...row, cropCode, requiresGeofence: true };
    });
}

export function stageDefinition(cropCode: string, stageCode: StageCode): StageDefinition | undefined {
  return defaultStages(cropCode).find((s) => s.stageCode === stageCode);
}

import type { Parent } from './enums';

export const STAGE_CODES = [
  'SOW_M', 'SOW_F', 'ROGUE_F_NURSERY', 'TP_M', 'TP_F', 'VEG', 'ROGUE_M', 'POLL',
  'ROGUE_F_PREMAT', 'MAT', 'ROGUE_F_PREHARV', 'YIELD_EST', 'HARV', 'PLOW', 'SEED_COLL', 'FINAL_YIELD',
] as const;
export type StageCode = (typeof STAGE_CODES)[number];

/** Stages that only exist for transplanted crops (HP, TO, CA). */
export const TRANSPLANT_ONLY_STAGES: readonly StageCode[] = ['ROGUE_F_NURSERY', 'TP_M', 'TP_F'];

export type FieldType = 'date' | 'number' | 'text' | 'choice' | 'multichoice' | 'photo' | 'computed';

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unit?: string;
  options?: readonly string[];
  /** Only shown for transplanted crops. */
  transplantedOnly?: boolean;
}

export interface StageDefinition {
  cropCode: string;
  stageCode: StageCode;
  name: string;
  sequence: number;
  appliesToParent: Parent;
  repeatable: boolean;
  mandatory: boolean;
  /** Days after female sowing when the stage is due. */
  expectedDayOffset: number;
  minPhotos: number;
  requiresGeofence: boolean;
  fields: readonly FormField[];
}

import type { FormField } from '@nk/shared';

const ROGUE_REASONS = ['Off-type', 'Diseased', 'Volunteer', 'Pollen shedder'] as const;
const CONDITION = ['Good', 'Average', 'Poor'] as const;

export const FORMS = {
  sowing: [
    { key: 'sowing_date', label: 'Sowing date', type: 'date', required: true },
    { key: 'seed_qty_g', label: 'Seed quantity', type: 'number', unit: 'g', required: true },
    { key: 'nursery_area_sqm', label: 'Nursery area', type: 'number', unit: 'm²', transplantedOnly: true },
    { key: 'rows_or_beds', label: 'Rows / beds', type: 'number' },
  ],
  transplanting: [
    { key: 'transplant_date', label: 'Transplant date', type: 'date', required: true },
    { key: 'seedlings_planted', label: 'Seedlings planted', type: 'number', required: true },
    { key: 'spacing_cm', label: 'Spacing, row × plant', type: 'text', unit: 'cm' },
  ],
  transplantingFemale: [
    { key: 'transplant_date', label: 'Transplant date', type: 'date', required: true },
    { key: 'seedlings_planted', label: 'Seedlings planted', type: 'number', required: true },
    { key: 'spacing_cm', label: 'Spacing, row × plant', type: 'text', unit: 'cm' },
    { key: 'ratio_f_m', label: 'Female : male ratio', type: 'computed' },
  ],
  vegetative: [
    { key: 'crop_condition', label: 'Crop condition', type: 'choice', options: CONDITION, required: true },
    { key: 'plant_stand_pct', label: 'Plant stand', type: 'number', unit: '%', required: true },
    { key: 'pest_disease', label: 'Pests & diseases', type: 'multichoice', options: ['None', 'Thrips', 'Leaf curl', 'Fruit borer', 'Powdery mildew', 'Other'] },
  ],
  rogueing: [
    { key: 'visit_date', label: 'Visit date', type: 'date', required: true },
    { key: 'off_types_removed', label: 'Off-types removed', type: 'number', unit: 'plants', required: true },
    { key: 'reason', label: 'Reason', type: 'choice', options: ROGUE_REASONS, required: true },
    { key: 'photos', label: 'Photos', type: 'photo', required: true },
  ],
  pollination: [
    { key: 'start_date', label: 'Start date', type: 'date', required: true },
    { key: 'end_date', label: 'End date', type: 'date' },
    { key: 'crosses', label: 'Crosses pollinated', type: 'number', unit: 'flowers', required: true },
    { key: 'male_flower_availability', label: 'Male flower availability', type: 'choice', options: CONDITION, required: true },
    { key: 'labour_count', label: 'Labour count', type: 'number' },
  ],
  detasseling: [
    { key: 'detasseling_start', label: 'Detasseling start', type: 'date', required: true },
    { key: 'detasseling_end', label: 'Detasseling end', type: 'date' },
    { key: 'pct_detasseled', label: 'Detasseled', type: 'number', unit: '%', required: true },
    { key: 'labour_count', label: 'Labour count', type: 'number' },
  ],
  maturity: [
    { key: 'maturity_date', label: 'Maturity date', type: 'date', required: true },
    { key: 'crop_condition', label: 'Crop condition', type: 'choice', options: CONDITION, required: true },
    { key: 'fruit_set_pct', label: 'Fruit set', type: 'number', unit: '%' },
  ],
  yieldEstimation: [
    { key: 'sample_plant_count', label: 'Sample plants', type: 'number', required: true },
    { key: 'fruits_per_plant', label: 'Fruits per plant', type: 'number', required: true },
    { key: 'seed_g_per_fruit', label: 'Seed per fruit', type: 'number', unit: 'g', required: true },
    { key: 'estimated_seed_kg', label: 'Estimated seed', type: 'computed', unit: 'kg' },
  ],
  harvesting: [
    { key: 'harvest_date', label: 'Harvest date', type: 'date', required: true },
    { key: 'picking_no', label: 'Picking no.', type: 'computed' },
    { key: 'fruits_harvested_kg', label: 'Fruits harvested', type: 'number', unit: 'kg', required: true },
  ],
  plowDown: [
    { key: 'plow_down_date', label: 'Plow down date', type: 'date', required: true },
    { key: 'photos', label: 'Proof photo', type: 'photo', required: true },
    { key: 'witness_name', label: 'Witness name', type: 'text' },
  ],
  seedCollection: [
    { key: 'collection_date', label: 'Collection date', type: 'date', required: true },
    { key: 'raw_seed_kg', label: 'Raw seed', type: 'number', unit: 'kg', required: true },
    { key: 'bags_count', label: 'Bags', type: 'number', required: true },
    { key: 'receipt_no', label: 'Receipt no.', type: 'text' },
  ],
  finalYield: [
    { key: 'final_seed_kg', label: 'Final dry seed', type: 'number', unit: 'kg', required: true },
    { key: 'variance_vs_estimate', label: 'Variance vs estimate', type: 'computed', unit: '%' },
    { key: 'variance_vs_target', label: 'Variance vs target', type: 'computed', unit: '%' },
  ],
} satisfies Record<string, readonly FormField[]>;

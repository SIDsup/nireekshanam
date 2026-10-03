export interface YieldEstimateInput {
  /** Female plants in the field (from female transplanting or stand count). */
  femalePlants: number;
  fruitsPerPlant: number;
  seedGramsPerFruit: number;
}

export function estimateSeedKg({ femalePlants, fruitsPerPlant, seedGramsPerFruit }: YieldEstimateInput): number {
  if ([femalePlants, fruitsPerPlant, seedGramsPerFruit].some((n) => !Number.isFinite(n) || n < 0)) return 0;
  return round((femalePlants * fruitsPerPlant * seedGramsPerFruit) / 1000, 1);
}

/** (actual − reference) / reference, or null when there is no reference. */
export function variance(actual: number, reference: number): number | null {
  if (!reference) return null;
  return (actual - reference) / reference;
}

export function targetYieldKg(contractedAcres: number, expectedKgPerAcre: number): number {
  return round(contractedAcres * expectedKgPerAcre, 1);
}

export function formatPercent(v: number | null, digits = 1): string {
  if (v === null) return '—';
  const s = (v * 100).toFixed(digits);
  return v > 0 ? `+${s}%` : `${s.replace('-', '−')}%`;
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

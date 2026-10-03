export const SQM_PER_ACRE = 4046.8564224;
export const SQM_PER_GUNTA = SQM_PER_ACRE / 40;
export const SQM_PER_CENT = SQM_PER_ACRE / 100;

export type AreaSubUnit = 'GUNTA' | 'CENT';

/** Display unit per state (ADR-004, pending confirmation). */
export const STATE_AREA_UNIT: Record<string, AreaSubUnit> = { TS: 'GUNTA', KA: 'GUNTA', AP: 'CENT', KL: 'CENT' };

export function subUnitForState(stateCode: string): AreaSubUnit {
  return STATE_AREA_UNIT[stateCode] ?? 'GUNTA';
}

export interface AreaParts {
  acres: number;
  sub: number;
  unit: AreaSubUnit;
}

export function sqmToParts(sqm: number, unit: AreaSubUnit = 'GUNTA'): AreaParts {
  const perSub = unit === 'GUNTA' ? SQM_PER_GUNTA : SQM_PER_CENT;
  const subsPerAcre = unit === 'GUNTA' ? 40 : 100;
  let totalSubs = Math.round(sqm / perSub);
  const acres = Math.floor(totalSubs / subsPerAcre);
  totalSubs -= acres * subsPerAcre;
  return { acres, sub: totalSubs, unit };
}

export function partsToSqm(acres: number, sub: number, unit: AreaSubUnit = 'GUNTA'): number {
  return acres * SQM_PER_ACRE + sub * (unit === 'GUNTA' ? SQM_PER_GUNTA : SQM_PER_CENT);
}

export function formatArea(sqm: number, unit: AreaSubUnit = 'GUNTA'): string {
  const p = sqmToParts(sqm, unit);
  const suffix = unit === 'GUNTA' ? 'gu' : 'ct';
  return `${p.acres} ac ${String(p.sub).padStart(2, '0')} ${suffix}`;
}

export function sqmToAcres(sqm: number): number {
  return sqm / SQM_PER_ACRE;
}

/** (computed − declared) / declared. Positive means the geo-fence is larger. */
export function areaVariance(declaredSqm: number, computedSqm: number): number {
  if (declaredSqm <= 0) return 0;
  return (computedSqm - declaredSqm) / declaredSqm;
}

export const DEFAULT_AREA_VARIANCE_LIMIT = 0.1;

export function isAreaVarianceFlagged(declaredSqm: number, computedSqm: number, limit = DEFAULT_AREA_VARIANCE_LIMIT): boolean {
  return Math.abs(areaVariance(declaredSqm, computedSqm)) > limit;
}

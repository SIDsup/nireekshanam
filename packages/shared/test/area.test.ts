import { describe, expect, it } from 'vitest';
import { areaVariance, formatArea, isAreaVarianceFlagged, partsToSqm, SQM_PER_ACRE, sqmToParts, subUnitForState } from '../src';

describe('area units', () => {
  it('has 40 guntas and 100 cents per acre', () => {
    expect(partsToSqm(0, 40, 'GUNTA')).toBeCloseTo(SQM_PER_ACRE, 6);
    expect(partsToSqm(0, 100, 'CENT')).toBeCloseTo(SQM_PER_ACRE, 6);
  });

  it('formats acres and guntas', () => {
    expect(formatArea(partsToSqm(2, 20, 'GUNTA'), 'GUNTA')).toBe('2 ac 20 gu');
    expect(formatArea(partsToSqm(1, 5, 'CENT'), 'CENT')).toBe('1 ac 05 ct');
  });

  it('carries rounding into whole acres', () => {
    expect(sqmToParts(SQM_PER_ACRE * 2 - 1, 'GUNTA')).toEqual({ acres: 2, sub: 0, unit: 'GUNTA' });
  });

  it('picks the display unit per state', () => {
    expect(subUnitForState('TS')).toBe('GUNTA');
    expect(subUnitForState('AP')).toBe('CENT');
  });

  it('flags variance above 10%', () => {
    expect(areaVariance(100, 85)).toBeCloseTo(-0.15);
    expect(isAreaVarianceFlagged(100, 85)).toBe(true);
    expect(isAreaVarianceFlagged(100, 95)).toBe(false);
  });
});

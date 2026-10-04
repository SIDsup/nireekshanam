import { describe, expect, it } from 'vitest';
import { checkFence, polygonAreaSqm, validatePolygon, type LngLat } from '../src';

// Roughly a 100 m × 100 m square near Vikarabad.
const lat0 = 17.18;
const lng0 = 77.89;
const dLat = 100 / 111_320;
const dLng = 100 / (111_320 * Math.cos((lat0 * Math.PI) / 180));
const square: LngLat[] = [
  { lng: lng0, lat: lat0 },
  { lng: lng0 + dLng, lat: lat0 },
  { lng: lng0 + dLng, lat: lat0 + dLat },
  { lng: lng0, lat: lat0 + dLat },
];

describe('geo', () => {
  it('computes area close to 10,000 m²', () => {
    expect(polygonAreaSqm(square)).toBeGreaterThan(9_900);
    expect(polygonAreaSqm(square)).toBeLessThan(10_100);
  });

  it('accepts a closed ring the same as an open one', () => {
    expect(polygonAreaSqm([...square, square[0]!])).toBeCloseTo(polygonAreaSqm(square), 6);
  });

  it('detects points inside the fence', () => {
    const r = checkFence({ lng: lng0 + dLng / 2, lat: lat0 + dLat / 2 }, square);
    expect(r).toEqual({ inside: true, acceptable: true, distanceOutsideM: 0 });
  });

  it('measures distance outside and applies the accuracy buffer', () => {
    const p = { lng: lng0 + dLng * 1.2, lat: lat0 + dLat / 2 }; // ~20 m east
    const strict = checkFence(p, square, 5);
    expect(strict.inside).toBe(false);
    expect(strict.distanceOutsideM).toBeGreaterThan(18);
    expect(strict.distanceOutsideM).toBeLessThan(22);
    expect(strict.acceptable).toBe(false);
    expect(checkFence(p, square, 25).acceptable).toBe(true);
  });

  it('validates polygons', () => {
    expect(validatePolygon(square)).toEqual([]);
    expect(validatePolygon(square.slice(0, 2))).toEqual(['TOO_FEW_VERTICES']);
    const bowtie = [square[0]!, square[2]!, square[1]!, square[3]!];
    expect(validatePolygon(bowtie)).toContain('SELF_INTERSECTING');
    const tiny = square.map((p) => ({ lng: lng0 + (p.lng - lng0) / 20, lat: lat0 + (p.lat - lat0) / 20 }));
    expect(validatePolygon(tiny)).toContain('TOO_SMALL');
  });
});

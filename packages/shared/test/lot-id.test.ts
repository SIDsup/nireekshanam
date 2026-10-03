import { describe, expect, it } from 'vitest';
import { generateLotId, isValidLotId, LotIdError, parseLotId } from '../src';

describe('lot ID', () => {
  const input = { seasonCode: '01', year: 2026, cropCode: 'HP', hybridCode: '1234', organiserCode: '015', farmerCode: 'TS0042', farmSeq: 1 };

  it('generates the spec example', () => {
    expect(generateLotId(input)).toBe('0126HP1234015TS004201');
  });

  it('zero-pads the farm sequence to two digits', () => {
    expect(generateLotId({ ...input, farmSeq: 7 })).toHaveLength(21);
    expect(generateLotId({ ...input, farmSeq: 7 }).endsWith('07')).toBe(true);
  });

  it('round-trips through parse', () => {
    const id = generateLotId({ ...input, cropCode: 'sc', farmerCode: 'ts0042' });
    const parsed = parseLotId(id);
    expect(parsed.ok && parsed.parts).toMatchObject({ cropCode: 'SC', farmerCode: 'TS0042', farmSeq: '01' });
  });

  it('rejects bad parts', () => {
    expect(() => generateLotId({ ...input, hybridCode: '12A4' })).toThrow(LotIdError);
    expect(() => generateLotId({ ...input, seasonCode: '04' })).toThrow(LotIdError);
    expect(() => generateLotId({ ...input, farmSeq: 0 })).toThrow(LotIdError);
    expect(() => generateLotId({ ...input, farmSeq: 100 })).toThrow(LotIdError);
  });

  it('rejects the old 20-character variable-length form', () => {
    const r = parseLotId('0126HP1234015TS00421');
    expect(r.ok).toBe(false);
    expect(isValidLotId('0126HP1234015TS00421')).toBe(false);
  });

  it('rejects unknown seasons and farm 00', () => {
    expect(isValidLotId('0926HP1234015TS004201')).toBe(false);
    expect(isValidLotId('0126HP1234015TS004200')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { defaultStages } from '../src';

describe('defaultStages', () => {
  it('gives transplanted crops all 16 stages', () => {
    expect(defaultStages('HP')).toHaveLength(16);
  });

  it('drops nursery and transplanting stages for direct-sown crops', () => {
    const codes = defaultStages('OK').map((s) => s.stageCode);
    expect(codes).toHaveLength(13);
    expect(codes).not.toContain('TP_F');
    expect(codes).not.toContain('ROGUE_F_NURSERY');
  });

  it('uses detasseling for sweet corn pollination', () => {
    const poll = defaultStages('SC').find((s) => s.stageCode === 'POLL');
    expect(poll?.fields.map((f) => f.key)).toContain('pct_detasseled');
  });

  it('keeps sequences strictly increasing', () => {
    const seq = defaultStages('TO').map((s) => s.sequence);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });

  it('rejects unknown crops', () => {
    expect(() => defaultStages('XX')).toThrow();
  });
});

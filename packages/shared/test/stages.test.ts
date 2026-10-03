import { describe, expect, it } from 'vitest';
import { defaultStages } from '../../stage-config/src';
import { addDays, checkDateOrder, currentStage, missingPredecessors, nickOffsetDays, stageProgress } from '../src';

const defs = defaultStages('HP');

describe('stage progress', () => {
  const recorded = [
    { stageCode: 'SOW_M', observedOn: '2026-06-12' },
    { stageCode: 'SOW_F', observedOn: '2026-06-18' },
    { stageCode: 'ROGUE_F_NURSERY', observedOn: '2026-07-16' },
    { stageCode: 'TP_M', observedOn: '2026-07-18' },
    { stageCode: 'TP_F', observedOn: '2026-07-22' },
    { stageCode: 'VEG', observedOn: '2026-08-11' },
    { stageCode: 'ROGUE_M', observedOn: '2026-08-24' },
    { stageCode: 'POLL', observedOn: '2026-09-14' },
  ] as const;

  const progress = stageProgress({ definitions: defs, referenceDate: '2026-06-18', recorded: [...recorded], today: '2026-10-02' });
  const status = (code: string) => progress.find((p) => p.definition.stageCode === code)?.status;

  it('marks recorded stages done and the ongoing one in progress', () => {
    expect(status('VEG')).toBe('DONE');
    expect(status('POLL')).toBe('IN_PROGRESS');
    expect(currentStage(progress)?.definition.stageCode).toBe('POLL');
  });

  it('computes due dates from female sowing', () => {
    const p = progress.find((x) => x.definition.stageCode === 'ROGUE_F_PREMAT')!;
    expect(p.dueOn).toBe('2026-10-05');
    expect(p.status).toBe('DUE');
    expect(status('FINAL_YIELD')).toBe('UPCOMING');
  });

  it('flags overdue stages', () => {
    const late = stageProgress({ definitions: defs, referenceDate: '2026-06-18', recorded: [...recorded], today: '2026-10-08' });
    expect(late.find((p) => p.definition.stageCode === 'ROGUE_F_PREMAT')?.status).toBe('OVERDUE');
  });
});

describe('sequence rules', () => {
  it('lists missing mandatory predecessors', () => {
    const missing = missingPredecessors(defs, ['SOW_M', 'SOW_F'], 'TP_F').map((d) => d.stageCode);
    expect(missing).toEqual(['ROGUE_F_NURSERY', 'TP_M']);
  });

  it('rejects a stage dated before an earlier stage', () => {
    const issue = checkDateOrder(defs, [{ stageCode: 'SOW_F', observedOn: '2026-06-18' }], { stageCode: 'TP_F', observedOn: '2026-06-10' });
    expect(issue?.laterThan.stageCode).toBe('SOW_F');
    expect(checkDateOrder(defs, [{ stageCode: 'SOW_F', observedOn: '2026-06-18' }], { stageCode: 'TP_F', observedOn: '2026-07-22' })).toBeNull();
  });

  it('computes the nick offset', () => {
    expect(nickOffsetDays('2026-06-12', '2026-06-18')).toBe(-6);
    expect(addDays('2026-06-18', 109)).toBe('2026-10-05');
  });
});

import type { StageCode, StageDefinition } from '../constants/stages';
import { addDays, daysBetween, type IsoDate } from './dates';

export type StageStatus = 'DONE' | 'IN_PROGRESS' | 'DUE' | 'OVERDUE' | 'UPCOMING';

export interface RecordedStage {
  stageCode: StageCode;
  observedOn: IsoDate;
}

export interface StageProgress {
  definition: StageDefinition;
  status: StageStatus;
  dueOn: IsoDate;
  /** Positive = days late, negative = days until due. */
  daysLate: number;
  records: RecordedStage[];
}

/** Stages that keep collecting records after they start (daily logs, rounds, pickings). */
const ONGOING: ReadonlySet<StageCode> = new Set(['POLL', 'ROGUE_M', 'HARV', 'SEED_COLL']);

export function stageProgress(opts: {
  definitions: readonly StageDefinition[];
  /** Female sowing date: the reference for expected day offsets. */
  referenceDate: IsoDate;
  recorded: readonly RecordedStage[];
  today: IsoDate;
  dueSoonDays?: number;
}): StageProgress[] {
  const { definitions, referenceDate, recorded, today, dueSoonDays = 7 } = opts;
  const sorted = [...definitions].sort((a, b) => a.sequence - b.sequence);
  const byCode = new Map<StageCode, RecordedStage[]>();
  for (const r of recorded) byCode.set(r.stageCode, [...(byCode.get(r.stageCode) ?? []), r]);
  const lastRecordedSeq = Math.max(-1, ...sorted.filter((d) => byCode.has(d.stageCode)).map((d) => d.sequence));

  return sorted.map((definition) => {
    const records = byCode.get(definition.stageCode) ?? [];
    const dueOn = addDays(referenceDate, definition.expectedDayOffset);
    const daysLate = daysBetween(dueOn, today);
    let status: StageStatus;
    if (records.length > 0) {
      status = definition.sequence === lastRecordedSeq && ONGOING.has(definition.stageCode) ? 'IN_PROGRESS' : 'DONE';
    } else if (daysLate > 0) {
      status = 'OVERDUE';
    } else if (-daysLate <= dueSoonDays) {
      status = 'DUE';
    } else {
      status = 'UPCOMING';
    }
    return { definition, status, dueOn, daysLate, records };
  });
}

/** The latest stage with a record: the lot's `current_stage`. */
export function currentStage(progress: readonly StageProgress[]): StageProgress | undefined {
  return [...progress].reverse().find((p) => p.status === 'DONE' || p.status === 'IN_PROGRESS');
}

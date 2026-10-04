import type { StageCode, StageDefinition } from '../constants/stages';
import { toUtcDay, type IsoDate } from './dates';
import type { RecordedStage } from './due-dates';

/** Mandatory stages earlier in the sequence that have no record yet. */
export function missingPredecessors(
  definitions: readonly StageDefinition[],
  recordedCodes: Iterable<StageCode>,
  target: StageCode,
): StageDefinition[] {
  const recorded = new Set(recordedCodes);
  const targetDef = definitions.find((d) => d.stageCode === target);
  if (!targetDef) return [];
  return definitions
    .filter((d) => d.mandatory && d.sequence < targetDef.sequence && !recorded.has(d.stageCode))
    .sort((a, b) => a.sequence - b.sequence);
}

export interface OrderIssue {
  stageCode: StageCode;
  observedOn: IsoDate;
  laterThan: RecordedStage;
}

/** A stage's date must not be earlier than any record of a stage before it in the sequence. */
export function checkDateOrder(
  definitions: readonly StageDefinition[],
  recorded: readonly RecordedStage[],
  target: RecordedStage,
): OrderIssue | null {
  const seq = new Map(definitions.map((d) => [d.stageCode, d.sequence]));
  const targetSeq = seq.get(target.stageCode) ?? 0;
  const conflict = recorded
    .filter((r) => (seq.get(r.stageCode) ?? 0) < targetSeq && toUtcDay(r.observedOn) > toUtcDay(target.observedOn))
    .sort((a, b) => toUtcDay(b.observedOn) - toUtcDay(a.observedOn))[0];
  return conflict ? { stageCode: target.stageCode, observedOn: target.observedOn, laterThan: conflict } : null;
}

/** Male–female sowing offset ("nick" timing), in days. Negative means male was sown first. */
export function nickOffsetDays(maleSowing: IsoDate, femaleSowing: IsoDate): number {
  return toUtcDay(maleSowing) - toUtcDay(femaleSowing);
}

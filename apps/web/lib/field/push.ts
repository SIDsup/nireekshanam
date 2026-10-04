import {
  checkFence,
  stageRecordSchema,
  syncPushSchema,
  toUtcDay,
  type StageRecordInput,
  type SyncPushResult,
} from '@nk/shared';
import { defaultStages } from '@nk/stage-config';
import { z } from 'zod';
import type { Dataset, StageRecord } from '../data/types';

/**
 * Envelope of `syncPushSchema` with each record left unparsed, so one bad record is rejected
 * with a reason instead of failing the whole batch. Every record is still validated with the
 * same `stageRecordSchema` that `syncPushSchema` uses.
 */
const envelopeSchema = syncPushSchema.extend({
  changes: z.object({
    stageRecords: z.object({ created: z.array(z.unknown()).max(500).default([]) }),
  }),
});

export class PushEnvelopeError extends Error {}

export interface PushContext {
  /** Field assistant the push is made for; lots must be assigned to them. */
  faId: string;
  now?: Date;
}

function issueText(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Invalid record';
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}

/**
 * Applies a sync push to the dataset (SPECS §6.1, step 2). Idempotent by `recordUuid`:
 * a record the server already holds is acknowledged again and not stored twice.
 * The geo-fence is re-checked on the server and the server's result is what gets stored.
 */
export function applyPush(dataset: Dataset, body: unknown, ctx: PushContext): SyncPushResult {
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) throw new PushEnvelopeError(issueText(envelope.error));

  const now = ctx.now ?? new Date();
  const accepted: string[] = [];
  const rejected: SyncPushResult['rejected'] = [];
  const known = new Set(dataset.records.map((r) => r.id));
  const lots = new Map(dataset.lots.map((l) => [l.lotId, l]));
  const farms = new Map(dataset.farms.map((f) => [f.id, f]));
  const hybrids = new Map(dataset.hybrids.map((h) => [h.id, h]));

  for (const raw of envelope.data.changes.stageRecords.created) {
    const uuidGuess = typeof raw === 'object' && raw && 'recordUuid' in raw ? String((raw as { recordUuid: unknown }).recordUuid) : '';
    const parsed = stageRecordSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({ recordUuid: uuidGuess, reason: issueText(parsed.error) });
      continue;
    }
    const rec: StageRecordInput = parsed.data;

    if (known.has(rec.recordUuid)) {
      accepted.push(rec.recordUuid);
      continue;
    }

    const reject = (reason: string) => rejected.push({ recordUuid: rec.recordUuid, reason });
    const lot = lots.get(rec.lotId);
    if (!lot) { reject('Lot not found on the server'); continue; }
    if (lot.faId !== ctx.faId) { reject('This lot is not assigned to you'); continue; }
    if (lot.status === 'CLOSED' || lot.status === 'REJECTED' || lot.status === 'ABANDONED') {
      reject(`Lot is ${lot.status.toLowerCase()}; no new records are accepted`);
      continue;
    }

    const hybrid = hybrids.get(lot.hybridId);
    const definition = hybrid ? defaultStages(hybrid.cropCode).find((d) => d.stageCode === rec.stageCode) : undefined;
    if (!definition) { reject(`Stage ${rec.stageCode} does not apply to this crop`); continue; }

    if (toUtcDay(rec.observedOn) > toUtcDay(dataset.today)) { reject('Observed date is in the future'); continue; }
    if (rec.photoIds.length < definition.minPhotos) {
      reject(`Needs at least ${definition.minPhotos} photo${definition.minPhotos === 1 ? '' : 's'}`);
      continue;
    }

    const existing = dataset.records.filter((r) => r.lotId === rec.lotId && r.stageCode === rec.stageCode);
    if (rec.supersedes && !existing.some((r) => r.id === rec.supersedes)) {
      reject('The record this corrects was not found');
      continue;
    }
    if (!definition.repeatable && existing.length > 0 && !rec.supersedes) {
      reject(`${definition.name} is already recorded for this lot. Save a correction instead.`);
      continue;
    }
    let roundNo = rec.roundNo;
    if (definition.repeatable && !rec.supersedes && existing.some((r) => r.roundNo === roundNo)) {
      // Two devices numbered the same round offline: append after the last one.
      roundNo = Math.max(...existing.map((r) => r.roundNo)) + 1;
    }

    const farm = farms.get(lot.farmId);
    if (!farm) { reject('Farm geo-fence not found'); continue; }
    const fence = checkFence(rec.gps, farm.geofence, rec.gpsAccuracyM);
    const flagged = (!fence.inside && !fence.acceptable) || rec.mockLocationDetected;

    const stored: StageRecord = {
      id: rec.recordUuid,
      lotId: rec.lotId,
      stageCode: rec.stageCode,
      roundNo,
      observedOn: rec.observedOn,
      capturedAt: rec.capturedAt,
      receivedAt: now.toISOString(),
      gps: rec.gps,
      gpsAccuracyM: Math.round(rec.gpsAccuracyM),
      insideGeofence: fence.inside,
      distanceOutsideM: Math.round(fence.distanceOutsideM),
      mockLocation: rec.mockLocationDetected,
      outOfFenceReason: fence.inside
        ? undefined
        : rec.outOfFenceReason || 'No reason given: the device reported this record inside the fence.',
      capturedBy: ctx.faId,
      deviceId: rec.deviceId,
      appVersion: rec.appVersion,
      data: rec.remarks ? { ...rec.data, remarks: rec.remarks } : rec.data,
      photoCount: rec.photoIds.length,
      reviewStatus: flagged ? 'PENDING' : 'NONE',
    };
    dataset.records.push(stored);
    known.add(stored.id);
    accepted.push(stored.id);
  }

  return { accepted, rejected, serverTime: now.getTime() };
}

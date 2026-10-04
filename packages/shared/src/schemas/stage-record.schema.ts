import { z } from 'zod';
import { STAGE_CODES } from '../constants/stages';
import { isoDate, lngLat } from './common';
import { lotIdSchema } from './lot.schema';

export const stageRecordSchema = z.object({
  recordUuid: z.string().uuid(),
  lotId: lotIdSchema,
  stageCode: z.enum(STAGE_CODES),
  roundNo: z.number().int().min(1).default(1),
  observedOn: isoDate,
  capturedAt: z.string().datetime({ offset: true }),
  gps: lngLat,
  gpsAccuracyM: z.number().nonnegative(),
  insideGeofence: z.boolean(),
  mockLocationDetected: z.boolean().default(false),
  outOfFenceReason: z.string().trim().optional(),
  capturedBy: z.string(),
  deviceId: z.string(),
  appVersion: z.string(),
  data: z.record(z.string(), z.unknown()),
  remarks: z.string().optional(),
  photoIds: z.array(z.string().uuid()).default([]),
  supersedes: z.string().uuid().nullable().default(null),
}).refine((r) => r.insideGeofence || !!r.outOfFenceReason, {
  message: 'A reason is required for records outside the geo-fence',
  path: ['outOfFenceReason'],
});
export type StageRecordInput = z.infer<typeof stageRecordSchema>;

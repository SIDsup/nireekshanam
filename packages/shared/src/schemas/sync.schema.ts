import { z } from 'zod';
import { stageRecordSchema } from './stage-record.schema';

export const syncPushSchema = z.object({
  deviceId: z.string().min(1),
  lastPulledAt: z.number().int().nonnegative(),
  changes: z.object({
    stageRecords: z.object({ created: z.array(stageRecordSchema).default([]) }),
  }),
});
export type SyncPush = z.infer<typeof syncPushSchema>;

export const syncPushResultSchema = z.object({
  accepted: z.array(z.string().uuid()),
  rejected: z.array(z.object({ recordUuid: z.string(), reason: z.string() })),
  serverTime: z.number().int(),
});
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;

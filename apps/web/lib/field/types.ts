import type { LngLat, ReviewStatus, StageCode, StageDefinition, StageRecordInput } from '@nk/shared';

/** A stage record as the device needs it: enough to compute progress and date order. */
export interface BundleRecord {
  recordUuid: string;
  stageCode: StageCode;
  roundNo: number;
  observedOn: string;
  insideGeofence: boolean;
  reviewStatus: ReviewStatus;
}

export interface BundleLot {
  lotId: string;
  status: string;
  farmer: { name: string; code: string };
  village: { name: string };
  cropCode: string;
  cropName: string;
  hybridCode: string;
  /** Planned female : male ratio from the hybrid master, e.g. "4:1". */
  ratio: string;
  isTransplanted: boolean;
  femaleSowingDate: string;
  contractedAreaSqm: number;
  targetYieldKg: number;
  farmCentre: LngLat;
  geofence: LngLat[];
  /** Latest values the device needs for computed fields. */
  facts: {
    femalePlants: number | null;
    malePlants: number | null;
    estimateKg: number | null;
  };
  records: BundleRecord[];
}

export interface FieldBundle {
  version: 1;
  serverTime: number;
  /** Day the device should treat as today. Fixed to the demo date in the demo build. */
  today: string;
  demo: boolean;
  season: string;
  fa: { id: string; name: string; initials: string; deviceId: string | null };
  lots: BundleLot[];
  /** Stage definitions keyed by crop code. */
  stages: Record<string, StageDefinition[]>;
}

export type OutboxStatus = 'pending' | 'syncing' | 'rejected';

export interface OutboxItem {
  recordUuid: string;
  record: StageRecordInput;
  status: OutboxStatus;
  reason?: string;
  createdAt: number;
  attempts: number;
  /** Display helpers so the sync screen does not need the bundle. */
  stageName: string;
  farmerName: string;
  photoCount: number;
  photoBytes: number;
}

export interface PhotoItem {
  id: string;
  recordUuid: string;
  lotId: string;
  blob: Blob;
  size: number;
  width: number;
  height: number;
  createdAt: number;
}

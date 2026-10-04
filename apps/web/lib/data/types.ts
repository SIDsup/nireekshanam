import type { LngLat, LotStatus, ReviewStatus, Role, StageCode } from '@nk/shared';

export interface Village {
  id: string;
  code: string;
  name: string;
  talukCode: string;
  talukName: string;
  districtCode: string;
  districtName: string;
  stateCode: string;
  pincode: string;
  center: LngLat;
}

export interface Organiser {
  id: string;
  code: string;
  name: string;
  mobile: string;
  villageId: string;
}

export interface AppUser {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  scopeLabel: string;
  villageIds: string[];
  joined: string;
  lastSyncAt: string | null;
  deviceId: string | null;
}

export interface Hybrid {
  id: string;
  cropCode: string;
  hybridCode: string;
  femaleCode: string;
  maleCode: string;
  ratio: string;
  expectedKgPerAcre: number;
  active: boolean;
}

export interface Farmer {
  id: string;
  code: string;
  name: string;
  organiserId: string;
  villageId: string;
  mobile: string;
}

export interface Farm {
  id: string;
  farmerId: string;
  farmSeq: number;
  surveyNo: string;
  declaredAreaSqm: number;
  computedAreaSqm: number;
  soilType: string;
  irrigation: string;
  location: LngLat;
  geofence: LngLat[];
}

export interface Lot {
  id: string;
  lotId: string;
  seasonCode: string;
  year: number;
  hybridId: string;
  organiserId: string;
  farmerId: string;
  farmId: string;
  faId: string;
  contractedAreaSqm: number;
  targetYieldKg: number;
  status: LotStatus;
  femaleSowingDate: string;
  createdAt: string;
}

export interface StageRecord {
  id: string;
  lotId: string;
  stageCode: StageCode;
  roundNo: number;
  observedOn: string;
  capturedAt: string;
  receivedAt: string;
  gps: LngLat;
  gpsAccuracyM: number;
  insideGeofence: boolean;
  distanceOutsideM: number;
  mockLocation: boolean;
  outOfFenceReason?: string;
  capturedBy: string;
  deviceId: string;
  appVersion: string;
  data: Record<string, unknown>;
  photoCount: number;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewComment?: string;
}

export interface AuditEntry {
  id: string;
  lotId: string;
  actorId: string;
  action: string;
  at: string;
  via: string;
}

export interface ReviewDecision {
  itemId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment: string;
  by: string;
  at: string;
}

export interface Dataset {
  today: string;
  villages: Village[];
  organisers: Organiser[];
  users: AppUser[];
  hybrids: Hybrid[];
  farmers: Farmer[];
  farms: Farm[];
  lots: Lot[];
  records: StageRecord[];
  audit: AuditEntry[];
  decisions: ReviewDecision[];
}

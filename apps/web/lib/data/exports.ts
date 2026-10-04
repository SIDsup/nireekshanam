import { getCrop, SQM_PER_ACRE } from '@nk/shared';
import type { CsvCell } from '@/lib/csv';
import { lotViews, organiserPerformance, seasonOverview, STAGE_GROUPS } from './queries';
import { db } from './store';

export interface ReportDef {
  key: string;
  title: string;
  description: string;
  build: () => { header: string[]; rows: CsvCell[][] };
}

const acres = (sqm: number) => Number((sqm / SQM_PER_ACRE).toFixed(2));
const pct = (v: number) => Number((v * 100).toFixed(1));
const groupLabel = new Map<string, string>(STAGE_GROUPS.map((g) => [g.key, g.label]));

/** CSV exports offered on the Labels & exports page. Keys are the `[report]` route segment. */
export const REPORTS: readonly ReportDef[] = [
  {
    key: 'lots',
    title: 'Lots by stage',
    description: 'Every lot with its current stage, area and yield',
    build: () => ({
      header: ['lot_id', 'crop', 'hybrid', 'organiser_code', 'organiser', 'farmer', 'village', 'taluk', 'district', 'field_assistant', 'status', 'stage_group', 'current_stage', 'next_stage', 'overdue_days', 'contracted_acres', 'target_kg', 'estimated_kg', 'final_kg'],
      rows: lotViews().map((v) => [
        v.lot.lotId, v.hybrid.cropCode, v.hybrid.hybridCode, v.organiser.code, v.organiser.name, v.farmer.name,
        v.village.name, v.village.talukName, v.village.districtName, v.faName, v.lot.status,
        groupLabel.get(v.group) ?? v.group, v.current?.definition.name ?? 'Not started', v.next?.definition.name ?? '',
        v.overdueDays, acres(v.lot.contractedAreaSqm), v.lot.targetYieldKg, v.estimateKg, v.finalKg,
      ]),
    }),
  },
  {
    key: 'overdue',
    title: 'Overdue inspections',
    description: 'Stages past their due day with no record',
    build: () => ({
      header: ['lot_id', 'farmer', 'village', 'district', 'stage_due', 'due_on', 'days_overdue', 'field_assistant', 'organiser_code'],
      rows: seasonOverview().overdue.map((v) => [
        v.lot.lotId, v.farmer.name, v.village.name, v.village.districtName, v.next?.definition.name ?? '',
        v.next?.dueOn ?? '', v.overdueDays, v.faName, v.organiser.code,
      ]),
    }),
  },
  {
    key: 'yield-by-hybrid',
    title: 'Estimated vs actual yield',
    description: 'Target, estimate and final seed per hybrid',
    build: () => ({
      header: ['crop', 'crop_name', 'hybrid', 'lots', 'contracted_acres', 'target_kg', 'estimated_kg', 'final_kg_to_date', 'estimate_vs_target_pct'],
      rows: seasonOverview().hybridRows.map((r) => [
        r.hybrid.cropCode, r.crop.name, r.hybrid.hybridCode, r.lots, acres(r.areaSqm), r.targetKg, r.estimateKg, r.finalKg,
        r.targetKg ? pct(r.estimateKg / r.targetKg - 1) : '',
      ]),
    }),
  },
  {
    key: 'organisers',
    title: 'Organiser performance',
    description: 'Lots, acreage, compliance and yield vs target',
    build: () => ({
      header: ['organiser_code', 'organiser', 'lots', 'contracted_acres', 'records_inside_fence_pct', 'estimate_vs_target_pct', 'lots_overdue'],
      rows: organiserPerformance().map((r) => [
        r.organiser.code, r.organiser.name, r.lots, acres(r.areaSqm), pct(r.insidePct), pct(r.yieldVsTarget), r.overdue,
      ]),
    }),
  },
  {
    key: 'records-compliance',
    title: 'Compliance and audit log',
    description: 'Every stage record with GPS, fence result and review',
    build: () => {
      const d = db();
      const users = new Map(d.users.map((u) => [u.id, u.name]));
      const crops = new Map(lotViews().map((v) => [v.lot.lotId, getCrop(v.hybrid.cropCode)?.code ?? '']));
      return {
        header: ['record_id', 'lot_id', 'crop', 'stage_code', 'round', 'observed_on', 'captured_at', 'received_at', 'captured_by', 'device_id', 'app_version', 'lat', 'lng', 'gps_accuracy_m', 'inside_geofence', 'distance_outside_m', 'mock_location', 'out_of_fence_reason', 'photos', 'review_status', 'reviewed_by', 'review_comment'],
        rows: [...d.records]
          .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
          .map((r) => [
            r.id, r.lotId, crops.get(r.lotId), r.stageCode, r.roundNo, r.observedOn, r.capturedAt, r.receivedAt,
            users.get(r.capturedBy) ?? r.capturedBy, r.deviceId, r.appVersion, Number(r.gps.lat.toFixed(6)), Number(r.gps.lng.toFixed(6)), r.gpsAccuracyM,
            r.insideGeofence ? 'yes' : 'no', r.distanceOutsideM, r.mockLocation ? 'yes' : 'no', r.outOfFenceReason ?? '',
            r.photoCount, r.reviewStatus, r.reviewedBy ? (users.get(r.reviewedBy) ?? r.reviewedBy) : '', r.reviewComment ?? '',
          ]),
      };
    },
  },
];

export function findReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}

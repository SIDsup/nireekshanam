import { centroid, getCrop, type LngLat } from '@nk/shared';
import { lotViews, mapFarms, STAGE_GROUPS, type StageGroupKey } from './queries';
import { db } from './store';

/* ------------------------------------------------------------------------------------------------
 * Farm map: project every geo-fence into a fixed SVG viewBox on the server, so the client
 * component only receives plain numbers.
 * ---------------------------------------------------------------------------------------------- */

export const MAP_W = 1000;
export const MAP_H = 680;
const EARTH_M_PER_DEG = 111_320;

export type Compliance = 'ok' | 'reason' | 'review';

export interface MapFarm {
  lotId: string;
  farmer: string;
  village: string;
  district: string;
  cropCode: string;
  cropName: string;
  hybridCode: string;
  group: StageGroupKey;
  compliance: Compliance;
  /** Polygon points in viewBox units, "x,y x,y …". */
  points: string;
  cx: number;
  cy: number;
  outside: { x: number; y: number }[];
  declaredAreaSqm: number;
  computedAreaSqm: number;
  stageName: string;
  nextName: string | null;
  nextDays: number | null;
  lastVisit: string | null;
  faName: string;
  recordCount: number;
  outsideCount: number;
}

export interface MapData {
  farms: MapFarm[];
  villages: { name: string; x: number; y: number; lots: number }[];
  /** Metres represented by one viewBox unit. */
  metresPerUnit: number;
  graticule: { lng: { x: number; label: string }[]; lat: { y: number; label: string }[] };
  stageGroups: { key: StageGroupKey; label: string }[];
  crops: { code: string; name: string }[];
}

export function mapData(): MapData {
  const raw = mapFarms();
  const all = raw.flatMap((f) => [...f.fence, ...f.outside]);
  const minLng = Math.min(...all.map((p) => p.lng));
  const maxLng = Math.max(...all.map((p) => p.lng));
  const minLat = Math.min(...all.map((p) => p.lat));
  const maxLat = Math.max(...all.map((p) => p.lat));
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  // Equirectangular: x ∝ lng·cos(φ0), y ∝ −lat. Fit the bounds with padding, keep aspect.
  const pad = 70;
  const spanX = (maxLng - minLng) * kx;
  const spanY = maxLat - minLat;
  const scale = Math.min((MAP_W - pad * 2) / spanX, (MAP_H - pad * 2) / spanY);
  const offX = (MAP_W - spanX * scale) / 2;
  const offY = (MAP_H - spanY * scale) / 2;
  const project = (p: LngLat) => ({
    x: round(offX + (p.lng - minLng) * kx * scale),
    y: round(offY + (maxLat - p.lat) * scale),
  });

  const villagesById = new Map(db().villages.map((v) => [v.name, v]));
  const farms: MapFarm[] = raw.map((f) => {
    const c = project(centroid(f.fence));
    return {
      lotId: f.lotId,
      farmer: f.farmer,
      village: f.village,
      district: villagesById.get(f.village)?.districtName ?? '',
      cropCode: f.cropCode,
      cropName: getCrop(f.cropCode)?.name ?? f.cropCode,
      hybridCode: f.hybridCode,
      group: f.group,
      compliance: f.compliance as Compliance,
      points: f.fence.map((p) => { const q = project(p); return `${q.x},${q.y}`; }).join(' '),
      cx: c.x,
      cy: c.y,
      outside: f.outside.map(project),
      declaredAreaSqm: f.declaredAreaSqm,
      computedAreaSqm: f.computedAreaSqm,
      stageName: f.stageName,
      nextName: f.nextName ?? null,
      nextDays: f.nextDays,
      lastVisit: f.lastVisit,
      faName: f.faName,
      recordCount: f.recordCount,
      outsideCount: f.outsideCount,
    };
  });

  const lotsByVillage = new Map<string, number>();
  for (const f of raw) lotsByVillage.set(f.village, (lotsByVillage.get(f.village) ?? 0) + 1);
  const villages = db().villages
    .filter((v) => lotsByVillage.has(v.name))
    .map((v) => ({ name: v.name, ...project(v.center), lots: lotsByVillage.get(v.name) ?? 0 }));

  // Graticule every 0.05° inside the fitted area (plus margin), labelled in degrees.
  const step = 0.05;
  const lngLines: { x: number; label: string }[] = [];
  for (let lng = Math.ceil((minLng - 0.2) / step) * step; lng <= maxLng + 0.2; lng += step) {
    lngLines.push({ x: project({ lng, lat: maxLat }).x, label: `${lng.toFixed(2)}° E` });
  }
  const latLines: { y: number; label: string }[] = [];
  for (let lat = Math.ceil((minLat - 0.2) / step) * step; lat <= maxLat + 0.2; lat += step) {
    latLines.push({ y: project({ lng: minLng, lat }).y, label: `${lat.toFixed(2)}° N` });
  }

  const cropCodes = [...new Set(raw.map((f) => f.cropCode))].sort();
  return {
    farms,
    villages,
    metresPerUnit: (EARTH_M_PER_DEG) / scale,
    graticule: { lng: lngLines, lat: latLines },
    stageGroups: STAGE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
    crops: cropCodes.map((code) => ({ code, name: getCrop(code)?.name ?? code })),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------------------------------------
 * Lot detail helpers.
 * ---------------------------------------------------------------------------------------------- */

export function lotPeople(lotId: string) {
  const d = db();
  const views = lotViews();
  const v = views.find((x) => x.lot.lotId === lotId);
  if (!v) return null;
  const fa = d.users.find((u) => u.id === v.lot.faId);
  return {
    faLastSyncAt: fa?.lastSyncAt ?? null,
    faDevice: fa?.deviceId ?? null,
    organiserLots: views.filter((x) => x.organiser.id === v.organiser.id).length,
    userNames: new Map(d.users.map((u) => [u.id, u.name])),
    userRoles: new Map(d.users.map((u) => [u.id, u.role])),
    today: d.today,
  };
}

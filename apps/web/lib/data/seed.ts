import {
  addDays,
  checkFence,
  generateLotId,
  getCrop,
  polygonAreaSqm,
  SQM_PER_ACRE,
  targetYieldKg,
  toUtcDay,
  type LngLat,
} from '@nk/shared';
import { defaultStages } from '@nk/stage-config';
import type { AppUser, AuditEntry, Dataset, Farm, Farmer, Hybrid, Lot, Organiser, StageRecord, Village } from './types';

/**
 * Synthetic demo data for Kharif 2026 (no real persons). Deterministic, so every reload
 * and every server instance shows the same numbers. Replace with the Postgres repository
 * once the database is provisioned.
 */
export const DEMO_TODAY = '2026-10-02';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VILLAGES: [string, string, string, string, string, string, number, number, string][] = [
  // name, code, taluk code, taluk, district code, district, lat, lng, pincode
  ['Nawabpet', '01', '04', 'Nawabpet', '21', 'Vikarabad', 17.2905, 77.9902, '501111'],
  ['Ellakonda', '03', '04', 'Nawabpet', '21', 'Vikarabad', 17.2702, 77.9621, '501111'],
  ['Mamdapur', '04', '04', 'Nawabpet', '21', 'Vikarabad', 17.3051, 78.0104, '501111'],
  ['Pulumaddi', '05', '04', 'Nawabpet', '21', 'Vikarabad', 17.3203, 77.9702, '501111'],
  ['Pargi', '01', '07', 'Pargi', '21', 'Vikarabad', 17.1781, 77.8733, '501501'],
  ['Kodangal', '01', '11', 'Kodangal', '21', 'Vikarabad', 17.1092, 77.6241, '509338'],
  ['Dharur', '02', '01', 'Vikarabad', '21', 'Vikarabad', 17.2903, 77.7511, '501121'],
  ['Chevella', '01', '06', 'Chevella', '15', 'Rangareddy', 17.3062, 78.1353, '501503'],
  ['Shankarpalli', '01', '09', 'Shankarpalli', '15', 'Rangareddy', 17.4553, 78.1304, '501203'],
  ['Moinabad', '01', '08', 'Moinabad', '15', 'Rangareddy', 17.3301, 78.2702, '501504'],
  ['Mokila', '04', '09', 'Shankarpalli', '15', 'Rangareddy', 17.4204, 78.1906, '501203'],
];

const ORGANISERS: [string, string, string, string[]][] = [
  // code, name, home village, crops they contract
  ['015', 'D. Narsimha', 'Nawabpet', ['HP', 'TO', 'OK', 'CA']],
  ['007', 'K. Rajeshwari', 'Shankarpalli', ['TO', 'HP', 'WM']],
  ['031', 'P. Sujatha', 'Moinabad', ['SC', 'OK', 'CU']],
  ['011', 'G. Bhaskar', 'Chevella', ['CU', 'CA', 'BG']],
  ['022', 'M. Yadagiri', 'Pargi', ['HP', 'SC', 'OK']],
  ['040', 'S. Anitha', 'Kodangal', ['WM', 'BG', 'TO']],
];

const ORGANISER_VILLAGES: Record<string, string[]> = {
  '015': ['Nawabpet', 'Ellakonda', 'Mamdapur', 'Pulumaddi'],
  '007': ['Shankarpalli', 'Mokila'],
  '031': ['Moinabad'],
  '011': ['Chevella'],
  '022': ['Pargi', 'Dharur'],
  '040': ['Kodangal'],
};

const FIELD_ASSISTANTS: [string, string, string, string[], string][] = [
  ['u-fa-1', 'S. Mahesh', '9848022211', ['Nawabpet', 'Ellakonda', 'Mamdapur', 'Pulumaddi', 'Pargi'], 'R13-4471'],
  ['u-fa-2', 'A. Ravi', '9440211090', ['Chevella', 'Shankarpalli', 'Mokila'], 'R13-2210'],
  ['u-fa-3', 'N. Swathi', '7013455655', ['Moinabad', 'Kodangal'], 'R12-0937'],
  ['u-fa-4', 'B. Kiran', '9100877487', ['Dharur'], 'M14-1180'],
];

const HYBRIDS: [string, string, string, string, string, number, boolean][] = [
  ['HP', '2041', 'F7K2', 'M3P1', '4:1', 120, true],
  ['HP', '2108', 'F7K2', 'M5R8', '4:1', 110, true],
  ['TO', '1187', 'T2F9', 'T8M4', '5:1', 95, true],
  ['OK', '3302', 'OF41', 'OM07', '6:1', 340, true],
  ['SC', '7720', 'SC1F', 'SC4M', '4:2', 520, true],
  ['CU', '4410', 'CF22', 'CM18', '3:1', 180, true],
  ['WM', '0915', 'WF03', 'WM11', '4:1', 75, true],
  ['CA', '2205', 'CAF6', 'CAM2', '4:1', 85, true],
  ['BG', '5120', 'BGF1', 'BGM9', '5:1', 140, true],
  ['RG', '6003', 'RGF2', 'RGM5', '5:1', 130, false],
];

const GIVEN = ['Venkatesh', 'Sarojamma', 'Ramulu', 'Anjaiah', 'Padma', 'Srinivas', 'Yadamma', 'Mallesh', 'Lakshmi', 'Narayana', 'Balamani', 'Jangaiah', 'Ramesh', 'Shankar', 'Pentaiah', 'Yadaiah', 'Anasuya', 'Raju', 'Mallaiah', 'Sujatha', 'Krishna', 'Laxmamma', 'Buchaiah', 'Sathaiah', 'Pochamma', 'Ramakrishna', 'Narsamma', 'Chandraiah', 'Bhagya', 'Kistaiah', 'Ravinder', 'Swaroopa', 'Mogulaiah', 'Kavitha', 'Ilaiah', 'Sammaiah'];
const INITIALS = ['B.', 'K.', 'M.', 'P.', 'G.', 'T.', 'Ch.', 'V.', 'R.', 'S.', 'J.', 'N.', 'E.', 'A.', 'D.', 'L.'];
const SOILS = ['RED', 'RED', 'RED', 'BLACK', 'BLACK', 'LOAMY', 'SANDY', 'ALLUVIAL'];
const IRRIGATION = ['BOREWELL', 'BOREWELL', 'DRIP', 'DRIP', 'OPEN_WELL', 'CANAL', 'TANK'];
const OUT_REASONS = [
  'Field boundary path flooded after rain. Recorded from the bund.',
  'Entered while walking back to the road.',
  'Neighbouring field blocked the access path.',
  'GPS was slow under the canopy; saved after leaving the field.',
  'Recorded at the farmer’s house after the visit.',
];

const metresToLat = (m: number) => m / 111_320;
const metresToLng = (m: number, lat: number) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

function makeFence(rand: () => number, center: LngLat, areaSqm: number): LngLat[] {
  const vertices = 4 + Math.floor(rand() * 3);
  // Regular polygon of the requested area, then jitter the radius and angle.
  const r = Math.sqrt((2 * areaSqm) / (vertices * Math.sin((2 * Math.PI) / vertices)));
  const rotation = rand() * Math.PI;
  const pts: LngLat[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = rotation + (i / vertices) * 2 * Math.PI + (rand() - 0.5) * 0.25;
    const rr = r * (0.88 + rand() * 0.24);
    pts.push({
      lng: center.lng + metresToLng(Math.cos(angle) * rr * 1.25, center.lat),
      lat: center.lat + metresToLat(Math.sin(angle) * rr * 0.8),
    });
  }
  return pts;
}

function jitterInside(rand: () => number, fence: LngLat[], center: LngLat): LngLat {
  for (let i = 0; i < 20; i++) {
    const p = { lng: center.lng + metresToLng((rand() - 0.5) * 50, center.lat), lat: center.lat + metresToLat((rand() - 0.5) * 40) };
    if (checkFence(p, fence).inside) return p;
  }
  return center;
}

function pointOutside(rand: () => number, center: LngLat, distanceFromCenterM: number): LngLat {
  const a = rand() * 2 * Math.PI;
  return { lng: center.lng + metresToLng(Math.cos(a) * distanceFromCenterM, center.lat), lat: center.lat + metresToLat(Math.sin(a) * distanceFromCenterM) };
}

function uuidFrom(rand: () => number): string {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const s = Array.from({ length: 32 }, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-7${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

function recordData(stageCode: string, rand: () => number, lot: Lot, femalePlants: number, roundNo: number): Record<string, unknown> {
  const n = (min: number, max: number) => Math.round(min + rand() * (max - min));
  switch (stageCode) {
    case 'SOW_M': return { seed_qty_g: n(80, 160), rows_or_beds: n(4, 8) };
    case 'SOW_F': return { seed_qty_g: n(320, 560), rows_or_beds: n(14, 26) };
    case 'TP_M': return { seedlings_planted: Math.round(femalePlants / 4), spacing_cm: '60 × 45' };
    case 'TP_F': return { seedlings_planted: femalePlants, spacing_cm: '60 × 45', ratio_f_m: '4.0 : 1' };
    case 'VEG': return { crop_condition: rand() < 0.8 ? 'Good' : 'Average', plant_stand_pct: n(86, 98), pest_disease: rand() < 0.75 ? ['None'] : ['Thrips'] };
    case 'ROGUE_F_NURSERY': case 'ROGUE_M': case 'ROGUE_F_PREMAT': case 'ROGUE_F_PREHARV':
      return { off_types_removed: n(4, roundNo > 1 ? 18 : 40), reason: rand() < 0.7 ? 'Off-type' : 'Diseased' };
    case 'POLL': return lot.hybridId.includes('SC') ? { pct_detasseled: n(92, 99), labour_count: n(8, 18) } : { crosses: n(28_000, 61_000), male_flower_availability: rand() < 0.8 ? 'Good' : 'Average', labour_count: n(8, 18) };
    case 'MAT': return { crop_condition: 'Good', fruit_set_pct: n(62, 88) };
    case 'YIELD_EST': return { estimated_seed_kg: Math.round(lot.targetYieldKg * (0.84 + rand() * 0.26) * 10) / 10, sample_plant_count: 20 };
    case 'HARV': return { picking_no: roundNo, fruits_harvested_kg: n(300, 1400) };
    case 'SEED_COLL': return { raw_seed_kg: Math.round(lot.targetYieldKg * (0.3 + rand() * 0.2)), bags_count: n(2, 8) };
    case 'FINAL_YIELD': return { final_seed_kg: Math.round(lot.targetYieldKg * (0.8 + rand() * 0.35) * 10) / 10 };
    default: return {};
  }
}

export function buildDataset(): Dataset {
  const rand = mulberry32(20260618);
  const today = DEMO_TODAY;

  const villages: Village[] = VILLAGES.map(([name, code, talukCode, talukName, districtCode, districtName, lat, lng, pincode]) => ({
    id: `v-${name.toLowerCase()}`, code, name, talukCode, talukName, districtCode, districtName, stateCode: 'TS', pincode, center: { lat, lng },
  }));
  const villageByName = new Map(villages.map((v) => [v.name, v]));

  const organisers: Organiser[] = ORGANISERS.map(([code, name, home]) => ({
    id: `o-${code}`, code, name, mobile: `9${String(Math.floor(rand() * 1e9)).padStart(9, '0')}`, villageId: villageByName.get(home)!.id,
  }));

  const users: AppUser[] = [
    ...FIELD_ASSISTANTS.map(([id, name, mobile, vs, device], i) => ({
      id, name, mobile, role: 'FIELD_ASSISTANT' as const,
      scopeLabel: `${vs.slice(0, 2).join(', ')}${vs.length > 2 ? ` · ${vs.length} villages` : ''}`,
      villageIds: vs.map((v) => villageByName.get(v)!.id),
      joined: ['2025-03-04', '2024-06-12', '2026-01-08', '2025-07-21'][i]!,
      lastSyncAt: [`${today}T10:44:00Z`, `${today}T02:32:00Z`, '2026-09-29T14:10:00Z', `${today}T01:45:00Z`][i]!,
      deviceId: device,
    })),
    { id: 'u-sup-1', name: 'V. Prasad', mobile: '9963100302', role: 'SUPERVISOR', scopeLabel: 'Vikarabad district', villageIds: [], joined: '2023-02-14', lastSyncAt: `${today}T04:00:00Z`, deviceId: null },
    { id: 'u-sup-2', name: 'L. Sravani', mobile: '8331900146', role: 'SUPERVISOR', scopeLabel: 'Rangareddy district', villageIds: [], joined: '2024-08-02', lastSyncAt: '2026-10-01T12:35:00Z', deviceId: null },
    { id: 'u-pm-1', name: 'R. Kumar', mobile: '9848022901', role: 'PRODUCTION_MANAGER', scopeLabel: 'All regions', villageIds: [], joined: '2022-11-01', lastSyncAt: null, deviceId: null },
    { id: 'u-org-015', name: 'D. Narsimha', mobile: organisers[0]!.mobile, role: 'ORGANISER', scopeLabel: 'Organiser 015 · own farmers', villageIds: [], joined: '2024-04-10', lastSyncAt: '2026-09-30T06:40:00Z', deviceId: 'R11-7781' },
    { id: 'u-admin-1', name: 'A. Rao', mobile: '9030077777', role: 'ADMIN', scopeLabel: 'System-wide', villageIds: [], joined: '2022-11-01', lastSyncAt: null, deviceId: null },
    { id: 'u-view-1', name: 'H. Reddy', mobile: '9246500101', role: 'VIEWER', scopeLabel: 'All regions (read-only)', villageIds: [], joined: '2025-01-15', lastSyncAt: null, deviceId: null },
  ];
  const faForVillage = (villageName: string) => FIELD_ASSISTANTS.find((f) => f[3].includes(villageName))![0];

  const hybrids: Hybrid[] = HYBRIDS.map(([cropCode, hybridCode, femaleCode, maleCode, ratio, expectedKgPerAcre, active]) => ({
    id: `h-${cropCode}${hybridCode}`, cropCode, hybridCode, femaleCode, maleCode, ratio, expectedKgPerAcre, active,
  }));

  const farmers: Farmer[] = [];
  const farms: Farm[] = [];
  const lots: Lot[] = [];
  const records: StageRecord[] = [];
  const audit: AuditEntry[] = [];
  let farmerSerial = 40;

  for (const [orgCode, , , crops] of ORGANISERS) {
    const organiser = organisers.find((o) => o.code === orgCode)!;
    const farmerCount = 26 + Math.floor(rand() * 18);
    for (let f = 0; f < farmerCount; f++) {
      const villageName = ORGANISER_VILLAGES[orgCode]![Math.floor(rand() * ORGANISER_VILLAGES[orgCode]!.length)]!;
      const village = villageByName.get(villageName)!;
      farmerSerial += 1 + Math.floor(rand() * 3);
      const farmer: Farmer = {
        id: `f-${farmerSerial}`,
        code: `TS${String(farmerSerial).padStart(4, '0')}`,
        name: `${INITIALS[Math.floor(rand() * INITIALS.length)]} ${GIVEN[Math.floor(rand() * GIVEN.length)]}`,
        organiserId: organiser.id,
        villageId: village.id,
        mobile: `${[9, 8, 7, 6][Math.floor(rand() * 4)]}${String(Math.floor(rand() * 1e9)).padStart(9, '0')}`,
      };
      farmers.push(farmer);

      const farmCount = rand() < 0.18 ? 2 : 1;
      for (let s = 1; s <= farmCount; s++) {
        const center = {
          lat: village.center.lat + metresToLat((rand() - 0.5) * 3200),
          lng: village.center.lng + metresToLng((rand() - 0.5) * 3800, village.center.lat),
        };
        const targetAcres = 0.8 + rand() * 2.8;
        const fence = makeFence(rand, center, targetAcres * SQM_PER_ACRE);
        const computed = polygonAreaSqm(fence);
        const flagged = rand() < 0.07;
        const declared = computed * (flagged ? (rand() < 0.5 ? 1.13 + rand() * 0.1 : 0.82 + rand() * 0.04) : 0.95 + rand() * 0.1);
        // Declared area is entered in whole guntas.
        const declaredSqm = Math.round(declared / (SQM_PER_ACRE / 40)) * (SQM_PER_ACRE / 40);
        const farm: Farm = {
          id: `fm-${farmer.code}-${s}`, farmerId: farmer.id, farmSeq: s, surveyNo: `${100 + Math.floor(rand() * 300)}/${1 + Math.floor(rand() * 6)}`,
          declaredAreaSqm: declaredSqm, computedAreaSqm: computed,
          soilType: SOILS[Math.floor(rand() * SOILS.length)]!, irrigation: IRRIGATION[Math.floor(rand() * IRRIGATION.length)]!,
          location: center, geofence: fence,
        };
        farms.push(farm);

        const cropCode = crops[Math.floor(rand() * crops.length)]!;
        const hybridChoices = hybrids.filter((h) => h.cropCode === cropCode && h.active);
        const hybrid = hybridChoices[Math.floor(rand() * hybridChoices.length)]!;
        const crop = getCrop(cropCode)!;
        const sowWindowStart = crop.isTransplanted ? '2026-04-20' : '2026-04-01';
        const femaleSowingDate = addDays(sowWindowStart, Math.floor(rand() * (crop.isTransplanted ? 95 : 115)));
        const contracted = Math.min(declaredSqm, computed * 1.02);
        const lotId = generateLotId({
          seasonCode: '01', year: 2026, cropCode, hybridCode: hybrid.hybridCode,
          organiserCode: organiser.code, farmerCode: farmer.code, farmSeq: s,
        });
        const faId = faForVillage(villageName);
        const lot: Lot = {
          id: `l-${lotId}`, lotId, seasonCode: '01', year: 2026, hybridId: hybrid.id, organiserId: organiser.id,
          farmerId: farmer.id, farmId: farm.id, faId,
          contractedAreaSqm: contracted,
          targetYieldKg: targetYieldKg(contracted / SQM_PER_ACRE, hybrid.expectedKgPerAcre),
          status: 'ACTIVE', femaleSowingDate,
          createdAt: `${addDays(femaleSowingDate, -8)}T05:18:00Z`,
        };
        lots.push(lot);
        audit.push({ id: `a-${lotId}-c`, lotId, actorId: faId, action: `created lot ${lotId}`, at: lot.createdAt, via: 'offline' });
        audit.push({ id: `a-${lotId}-g`, lotId, actorId: faId, action: `drew geo-fence (${fence.length} vertices, walk mode)`, at: `${addDays(femaleSowingDate, -8)}T05:02:00Z`, via: 'device' });

        const fa = FIELD_ASSISTANTS.find((x) => x[0] === faId)!;
        const femalePlants = Math.round((contracted / SQM_PER_ACRE) * (2600 + rand() * 600));
        const negligent = rand() < 0.07;
        for (const def of defaultStages(cropCode)) {
          const due = addDays(femaleSowingDate, def.expectedDayOffset);
          const lag = Math.floor(rand() * 5) - 1;
          const observedOn = addDays(due, lag);
          if (toUtcDay(observedOn) > toUtcDay(today)) break;
          // Some lots fall behind: their most recent due stage is missing.
          if (negligent && toUtcDay(today) - toUtcDay(due) < 9) break;
          rand(); // kept so the rest of the seeded data stays stable
          const rounds = def.stageCode === 'ROGUE_M' ? 1 + Math.floor(rand() * 2) : def.stageCode === 'HARV' ? 2 + Math.floor(rand() * 3) : 1;
          for (let roundNo = 1; roundNo <= rounds; roundNo++) {
            const day = addDays(observedOn, (roundNo - 1) * 12);
            if (toUtcDay(day) > toUtcDay(today)) break;
            const mock = rand() < 0.004;
            const outside = !mock && rand() < 0.06;
            const accuracy = Math.round(3 + rand() * (rand() < 0.04 ? 60 : 14));
            const gps = outside ? pointOutside(rand, center, 80 + rand() * 90) : jitterInside(rand, fence, center);
            const fenceCheck = checkFence(gps, fence, accuracy);
            const recent = toUtcDay(today) - toUtcDay(day) <= 10;
            const hour = 3 + Math.floor(rand() * 9);
            const capturedAt = `${day}T${String(hour).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`;
            const record: StageRecord = {
              id: uuidFrom(rand), lotId, stageCode: def.stageCode, roundNo, observedOn: day, capturedAt,
              receivedAt: rand() < 0.85 ? capturedAt.replace(/T(\d{2})/, (_m, h) => `T${String(Math.min(23, Number(h) + 1)).padStart(2, '0')}`) : `${addDays(day, 1)}T02:10:00Z`,
              gps, gpsAccuracyM: accuracy, insideGeofence: fenceCheck.inside, distanceOutsideM: Math.round(fenceCheck.distanceOutsideM),
              mockLocation: mock,
              outOfFenceReason: fenceCheck.inside ? undefined : OUT_REASONS[Math.floor(rand() * OUT_REASONS.length)],
              capturedBy: faId, deviceId: fa[4], appVersion: '0.1.4',
              data: recordData(def.stageCode, rand, lot, femalePlants, roundNo),
              photoCount: def.minPhotos === 0 ? 0 : rand() < 0.03 ? 0 : def.minPhotos + Math.floor(rand() * 2),
              reviewStatus: (!fenceCheck.inside && !fenceCheck.acceptable) || mock ? (recent ? 'PENDING' : 'APPROVED') : 'NONE',
              reviewedBy: (!fenceCheck.inside || mock) && !recent ? 'u-sup-1' : undefined,
            };
            records.push(record);
          }
          if (def.stageCode === 'FINAL_YIELD') lot.status = 'CLOSED';
          else if (def.stageCode === 'HARV' || def.stageCode === 'PLOW' || def.stageCode === 'SEED_COLL') lot.status = 'HARVESTED';
        }
      }
    }
  }

  return { today, villages, organisers, users, hybrids, farmers, farms, lots, records, audit, decisions: [] };
}

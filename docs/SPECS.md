# Nireekshanam: Hybrid Seed Production Monitoring, Functional & Technical Specification

| Item     | Value                                                                    |
|----------|--------------------------------------------------------------------------|
| Version  | 0.1 (draft)                                                              |
| Date     | 2026-10-02                                                               |
| Source   | [readme_specs.md](readme_specs.md), converted from `readme_specs.docx`   |
| Status   | Draft. Items marked **[OPEN]** need a decision from the business before build. |

---

## 1. Purpose and scope

Nireekshanam is a field monitoring system for **hybrid vegetable seed production**. It follows every production lot from contracting to final seed yield. Field staff record stage-wise observations offline on a mobile app. Each record carries GPS, a timestamp, the user's identity and a geo-fence check. Managers track progress, compliance and yield on a web dashboard.

### 1.1 In scope (MVP)

- Masters: season, year, crop, hybrid (with male and female parent lines), the location hierarchy, organisers, farmers and farms.
- Farm registration with geo-location, geo-fence polygon and farm photo.
- Production lot creation with a deterministic lot ID and QR code.
- Stage-wise data capture for sowing, transplanting, the crop stages (rogueing, pollination, maturity, yield estimation, harvest, plow down, seed collection) and final yield.
- Offline-first mobile app with background sync.
- Web dashboard for monitoring, reports and master data administration.
- Role-based access control and an audit trail.

### 1.2 Out of scope for MVP (Phase 2 candidates)

These are taken from the reference cycle in section 1 of the source document:

- Seed certification agency inspections and approvals.
- Procurement at the processing plant (moisture, cleaning and grading losses, seed treatment).
- Quality testing (germination, GOT/genetic purity, physical purity).
- Grower payments and settlements.
- Isolation distance checks between neighbouring lots (geo-spatial).

---

## 2. Users and roles

**[OPEN]** The business has not yet confirmed which of these roles will use the app. The table below is the proposed model.

| Role | Platform | Responsibilities | Data scope |
|------|----------|------------------|------------|
| **Field Assistant (FA)** | Mobile | Registers farmers and farms, draws geo-fences, records stage observations | Lots assigned to them |
| **Organiser** | Mobile (optional) | Coordinates a group of farmers. Can view their farmers' lots and may record observations | Own farmers' lots |
| **Supervisor** | Mobile + Web | Verifies FA entries, reassigns lots, approves exceptions such as out-of-fence entries | Assigned region (district or taluk) |
| **Production Manager** | Web | Plans seasons, allocates hybrids and acreage, reviews dashboards | All lots |
| **Admin** | Web | Manages masters, users, roles and stage configuration | System-wide |
| **Viewer / Management** | Web | Read-only dashboards | All lots (read-only) |

---

## 3. Domain model

### 3.1 Key principle

**The production lot is the core record.** A farmer can own several farms, and one farm can grow a different hybrid each season. Every sowing date, rogueing visit and yield figure therefore attaches to a **lot**, never directly to the farmer or the farm.

```
State ─┬─ District ─┬─ Taluk ─┬─ Village
       │            │         │
Organiser ──< Farmer ──< Farm ──< ProductionLot >── Hybrid >── Crop
                                    │                 ├── Male parent line
                                    │                 └── Female parent line
                                    ├──< StageRecord ──< Media (photos)
                                    └── Season + Year
```

### 3.2 Entities

#### 3.2.1 Season

| Field | Type | Rule | Notes |
|-------|------|------|-------|
| code | char(2) | `^\d{2}$` | `01` = Kharif, `02` = Rabi, `03` = Summer (reserved, **[OPEN]**) |
| name | text | required | |
| typical_start_month / end_month | int | 1–12 | Used for default dates and reports |

#### 3.2.2 Year

Stored as a 2-digit code (`^\d{2}$`, e.g. `26`) inside the lot ID. Stored in full (`2026`) in the database.

#### 3.2.3 Crop

| Field | Type | Rule |
|-------|------|------|
| code | char(2) | `^[A-Z]{2}$`, unique |
| name | text | required |
| is_transplanted | bool | Controls whether nursery and transplanting stages apply |
| pollination_method | enum | `HAND_EMASCULATION`, `HAND_POLLINATION_ONLY`, `DETASSELING`, `BULB_CROSSING` (**[OPEN]** per crop) |
| active | bool | |

Proposed crop codes (Ridge Gourd is listed twice in the source, so there are 11 crops):

| Code | Crop | Transplanted? (proposed) |
|------|------|--------------------------|
| HP | Hot Pepper | Yes |
| OK | Okra | No |
| TO | Tomato | Yes |
| WM | Water Melon | No |
| CU | Cucumber | No |
| BG | Bitter Gourd | No |
| RG | Ridge Gourd | No |
| SG | Snake Gourd | No |
| ON | Onion | **[OPEN]** Hybrid onion seed usually goes seed → bulb → seed over two seasons. Its stage flow needs separate confirmation. |
| CA | Capsicum | Yes |
| SC | Sweet Corn | No |

#### 3.2.4 Hybrid and parent lines

| Field | Type | Rule |
|-------|------|------|
| crop_code | FK → Crop | required |
| hybrid_code | char(4) | `^\d{4}$`, unique **within a crop** |
| male_code | char(4) | `^[A-Z0-9]{4}$` |
| female_code | char(4) | `^[A-Z0-9]{4}$` |
| recommended_ratio_female_male | text / decimal | e.g. `4:1` |
| expected_yield_kg_per_acre | decimal | Used for target and estimate comparisons |
| active | bool | |

**[OPEN]** Can the same male or female parent line be shared across hybrids? If so, parent lines should become their own master table. The proposed design makes them a separate `ParentLine` table either way.

#### 3.2.5 Location master

Organisers and farmers both use a single cascading State → District → Taluk → Village master. Staff pick values from dropdowns rather than typing codes.

| Level | Code rule | Uniqueness |
|-------|-----------|------------|
| State | `^[A-Z]{2}$` (e.g. `TS`, `AP`, `KA`) | Global |
| District | `^\d{2}$` | Within a state |
| Taluk | **[OPEN]** length not specified. Proposed: `^\d{2,3}$` | Within a district |
| Village | `^\d{2}$` (max 99 per taluk, **[OPEN]**: could this limit be exceeded?) | Within a taluk |

The full village key is `State + District + Taluk + Village`. A village also stores its default pincode.

#### 3.2.6 Organiser

| # | Field | Type | Rule |
|---|-------|------|------|
| a | code | char(3) | `^\d{3}$`, unique |
| b | name | text | required, ≤ 100 chars |
| c | address_1 | text | required |
| d | address_2 | text | optional |
| e–j | village / taluk / district | FK → Village | Picked from the cascade. Codes and names are derived, not typed. |
| k | state | char(2) | Derived from the village |
| l | pincode | char(6) | `^[1-9]\d{5}$` |
| m | mobile | char(10) | `^[6-9]\d{9}$` (Indian mobile), unique |
| n | email | text | RFC 5322, optional |
| – | active | bool | |

#### 3.2.7 Farmer

Same address fields as the organiser, plus:

| # | Field | Type | Rule |
|---|-------|------|------|
| a | code | char(6) | `^[A-Z0-9]{6}$`, unique. **[OPEN]** Is it auto-generated (e.g. state prefix + 4-digit serial such as `TS0042`) or assigned manually? |
| – | organiser_id | FK → Organiser | **Required**. The source list leaves out this link, but reporting and access control depend on it. **[OPEN]** Can a farmer move between organisers across seasons? If so, the link should live on the lot. |
| – | photo | media | optional |
| – | id_proof_type / number | text | optional, **[OPEN]** (Aadhaar must be masked or avoided) |
| – | bank details | – | Phase 2 (payments) |

#### 3.2.8 Farm

| # | Field | Type | Rule |
|---|-------|------|------|
| – | farmer_id | FK → Farmer | required |
| – | farm_seq | int | 1–99, sequence per farmer. Used in the lot ID. |
| – | survey_number | text | optional (land record reference) |
| a | declared_area_sqm | decimal | Entered as acres + guntas **or** acres + cents depending on the state. Stored in m². |
| b | soil_type | enum | Red, Black, Alluvial, Laterite, Sandy, Loamy, Other (**[OPEN]** confirm the list) |
| c | irrigation_source | enum | Borewell, Open well, Canal, Tank, River, Rainfed, Drip, Sprinkler, Other |
| d | location | point (lat, long) | Captured by GPS with accuracy stored. Required. |
| e | geofence | polygon | Walk-the-boundary or tap-on-map. Minimum 3 vertices. Must not self-intersect. |
| – | computed_area_sqm | decimal | Derived from the geofence |
| f | photos | media[] | At least 1, geo-tagged |

**Area conversions** (stored internally in m²):

| Unit | m² | Relation |
|------|----|----------|
| Acre | 4046.856 | 1 acre = 40 guntas = 100 cents |
| Gunta | 101.171 | |
| Cent | 40.469 | |

The display unit is chosen per state: TS and KA use acres + guntas, AP and KL use acres + cents. **[OPEN]** confirm this mapping.

**Area variance check:** if `|declared − computed| / declared` is greater than 10% (configurable), the farm is flagged for supervisor review.

#### 3.2.9 Production Lot

| Field | Type | Rule |
|-------|------|------|
| lot_id | char(21) | Generated (see 3.3), unique, immutable |
| season_code, year | FK / int | required |
| hybrid_id | FK → Hybrid | Implies crop, male and female |
| organiser_id | FK | Defaults to the farmer's organiser |
| farmer_id | FK | required |
| farm_id | FK | required |
| field_assistant_id | FK → User | Assigned FA |
| contracted_area_sqm | decimal | ≤ farm area |
| target_yield_kg | decimal | |
| status | enum | `PLANNED`, `ACTIVE`, `HARVESTED`, `CLOSED`, `REJECTED`, `ABANDONED` |
| current_stage | FK → StageDefinition | Derived from the latest completed stage |
| qr_payload | text | Same as lot_id |

**Constraint:** each farm can hold only one active lot per season and year. **[OPEN]** Can a farm be split between two hybrids in the same season? If yes, the farm sequence becomes a sub-plot sequence.

### 3.3 Lot ID format

| Part | Length | Example |
|------|--------|---------|
| Season | 2 | `01` |
| Year | 2 | `26` |
| Crop | 2 | `HP` |
| Hybrid | 4 | `1234` |
| Organiser | 3 | `015` |
| Farmer | 6 | `TS0042` |
| Farm sequence | **2 (fixed, zero-padded)** | `01` |

Example: `0126HP1234015TS004201`, 21 characters.

> The source document allows a 1–2 digit farm sequence (`0126HP1234015TS00421`). This spec fixes it at 2 digits so every ID has the same length and parses unambiguously. **[OPEN]** confirm.

- The lot ID is generated on the device when the lot is created, so it works offline. The server rejects duplicates on sync and the conflict surfaces to the supervisor.
- The QR code encodes the lot ID. It is printable on field tags (A6) and seed bag labels.
- The lot ID is **immutable**. If the hybrid is entered wrongly, the lot is closed as `REJECTED` and a new lot is created.

### 3.4 Stage configuration

Stages are **configurable per crop**. Each `StageDefinition` holds:

| Field | Description |
|-------|-------------|
| crop_code | Crop it applies to |
| stage_code | e.g. `SOW_M`, `ROGUE_F_NURSERY` |
| sequence | Display and enforcement order |
| applies_to_parent | `MALE`, `FEMALE`, `BOTH`, `NA` |
| repeatable | Whether multiple rounds are allowed (rogueing, harvest pickings) |
| mandatory | Whether the lot must pass through this stage before it can close |
| expected_day_offset | Days after the reference date (female sowing) when the stage is due. Used to flag overdue stages. |
| form_schema | JSON schema of the fields to capture (see 3.5) |
| requires_photo | bool, plus a minimum photo count |
| requires_geofence | bool (true for all field stages) |

**Default stage sequence.** This is the order from the source with the nursery rogueing moved earlier, as the source analysis recommends:

| Seq | Code | Stage | Transplanted crops (HP, TO, CA) | Direct-sown crops (OK, WM, CU, BG, RG, SG, SC) |
|-----|------|-------|-----|-----|
| 10 | `SOW_M` | Date of Sowing: Male | ✔ (nursery) | ✔ |
| 11 | `SOW_F` | Date of Sowing: Female | ✔ (nursery) | ✔ |
| 15 | `ROGUE_F_NURSERY` | Female Rogueing before Transplantation | ✔ | – |
| 20 | `TP_M` | Date of Transplantation: Male | ✔ | – |
| 21 | `TP_F` | Date of Transplantation: Female | ✔ | – |
| 30 | `VEG` | Vegetative | ✔ | ✔ |
| 40 | `ROGUE_M` | Male Rogueing | ✔ (repeatable) | ✔ (repeatable) |
| 50 | `POLL` | Pollination | ✔ | ✔ (detasseling for SC) |
| 60 | `ROGUE_F_PREMAT` | Female Rogueing before Maturity | ✔ | ✔ |
| 70 | `MAT` | Maturity | ✔ | ✔ |
| 80 | `ROGUE_F_PREHARV` | Female Rogueing before Harvest | ✔ | ✔ |
| 90 | `YIELD_EST` | Estimation of Seed Yield | ✔ | ✔ |
| 100 | `HARV` | Harvesting | ✔ (repeatable: pickings) | ✔ (repeatable) |
| 110 | `PLOW` | Plow down | ✔ | ✔ |
| 120 | `SEED_COLL` | Seed Collection | ✔ (repeatable) | ✔ (repeatable) |
| 130 | `FINAL_YIELD` | Final Seed Yield | ✔ | ✔ |

Onion (ON) needs its own flow. **[OPEN]**

**Stage enforcement rules:**

- A stage cannot be recorded before its predecessor mandatory stages. The rule is soft (a warning with a reason) by default and can be made hard per crop.
- Dates must be in order: transplanting must come after sowing, harvest after pollination, and so on. The male–female sowing offset (the "nick" timing) is shown alongside so staff can check it.
- `FINAL_YIELD` closes the lot (status `CLOSED`) once all mandatory stages are present.

### 3.5 Stage data capture

**Common fields, captured automatically on every stage record:**

| Field | Source |
|-------|--------|
| record_uuid | Generated on the device (UUID v7) |
| lot_id, stage_code, round_no | Context |
| observed_on | Date entered by the user (defaults to today, cannot be in the future) |
| captured_at | Device timestamp. The server timestamp is added on sync. |
| gps_lat, gps_long, gps_accuracy_m | Device GPS. Required. Accuracy above 50 m triggers a warning. |
| inside_geofence | Computed on the device and re-verified on the server (point-in-polygon with an accuracy buffer) |
| captured_by | Logged-in user |
| device_id, app_version | Device |
| remarks | Free text, optional |
| photos | Geo-tagged and timestamped, with a watermark overlay showing lot ID, date and GPS |
| mock_location_detected | bool (Android mock-location flag) |

**Stage-specific fields:**

| Stage | Fields |
|-------|--------|
| Sowing (M / F) | sowing_date, seed_qty_g, nursery_area_sqm (if transplanted), no_of_rows/beds |
| Transplanting (M / F) | transplant_date, seedlings_planted, spacing_cm (row × plant), female:male ratio (computed) |
| Vegetative | crop_condition (Good/Average/Poor), plant_stand_pct, pest_disease_observed (multi-select), remarks |
| Rogueing (any round) | visit_date, off_types_removed_count, reason (off-type, diseased, volunteer, pollen shedder), photos ≥ 1 |
| Pollination | start_date, end_date, crosses/flowers_pollinated (count, daily log optional), male_flower_availability, labour_count. Sweet corn: detasseling_start/end, pct_detasseled. |
| Maturity | maturity_date, crop_condition, fruit_set_pct |
| Yield estimation | sample_plant_count, fruits_per_plant, seeds_per_fruit or seed_g_per_fruit, estimated_seed_kg (computed and editable) |
| Harvesting | harvest_date, picking_no, fruits_harvested (count or kg) |
| Plow down | plow_down_date, geo-tagged photo (required, as proof the field was destroyed), witness name (optional) |
| Seed collection | collection_date, wet/raw seed_kg, bags_count, receipt_no |
| Final seed yield | final_seed_kg (dry), variance vs estimate (computed: `(final − est) / est`), variance vs target |

### 3.6 Media

- Photos are compressed on the device to ≤ 300 KB at a long edge of 1600 px. EXIF GPS is kept.
- The upload queue is separate from the data sync. Data syncs first and photos follow over Wi-Fi or mobile data depending on a user setting.
- Photos are stored in object storage under `/{season}{year}/{lot_id}/{stage}/{uuid}.jpg`.

---

## 4. Functional requirements

### 4.1 Mobile app (field)

| ID | Requirement |
|----|-------------|
| M-01 | Login with mobile number + OTP. The session stays valid offline for up to 30 days (configurable). |
| M-02 | Download the assigned masters and lots for offline use, with incremental sync. |
| M-03 | Register farmer: cascading location pickers, field validation, photo. |
| M-04 | Register farm: capture GPS point, draw the geo-fence by walking the boundary or tapping on the map, compute area, show the variance against the declared area, take photos. |
| M-05 | Create a lot: choose season, year, hybrid, farmer and farm. The lot ID is generated and its QR code shown. |
| M-06 | Open a lot by search (ID, farmer name, village) or by **scanning its QR**. |
| M-07 | The lot timeline shows completed, due, overdue and not-applicable stages. |
| M-08 | Stage entry forms are rendered from `form_schema` and enforce validation, the GPS fix and the geo-fence check. |
| M-09 | Out-of-fence entries need a reason and are flagged for supervisor review. They are not blocked, because GPS drift happens. |
| M-10 | Today's work lists lots with stages due or overdue, sorted by village or distance. |
| M-11 | Sync status shows pending records and photos, the last sync time, and lets the user retry manually. |
| M-12 | All screens, labels, messages and reports are in English. |
| M-13 | Works on Android 9+ phones with 2 GB RAM. iOS is optional. |

### 4.2 Web dashboard

| ID | Requirement |
|----|-------------|
| W-01 | KPIs for the season: lots by status and stage, contracted acreage, estimated and final seed kg. |
| W-02 | Lots by stage, drillable by Region (State/District/Taluk), Organiser, Hybrid, Crop and FA. |
| W-03 | Overdue inspections: stages past `expected_day_offset` with no record. |
| W-04 | Estimated vs actual yield per hybrid, per organiser and per farmer. |
| W-05 | Organiser performance: lots, acreage, compliance %, yield vs target. |
| W-06 | Compliance: share of records inside the geo-fence, records with photos, and mock-location flags. |
| W-07 | Map view: farm polygons coloured by stage, with clustering. |
| W-08 | Lot detail: timeline, all records, photo gallery and audit history. |
| W-09 | Supervisor review queue: out-of-fence entries, area variance and duplicate lot IDs. Each item can be approved or rejected with a comment. |
| W-10 | Masters CRUD with bulk CSV/Excel import for the location master, organisers, farmers and hybrids. |
| W-11 | Stage configuration editor per crop. |
| W-12 | User and role management, and assignment of FAs to lots or villages. |
| W-13 | Export any report to Excel/CSV. Print QR labels in bulk as PDF. |

### 4.3 Notifications (Phase 1.5)

- A daily push to each FA listing stages due today.
- A weekly email to supervisors summarising overdue items.

---

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Offline | Every capture flow works with no connectivity. The local store must survive app restarts. Sync is idempotent (keyed on record_uuid). |
| Sync conflicts | Stage records are append-only: a correction is a new version with `supersedes` set. Master edits use last-write-wins with a server timestamp, and conflicts are logged. |
| Performance | The app opens a lot in under 1 s offline. Dashboard queries return in under 3 s for 50k lots. |
| Scale (assumed) | Up to 500 field users, 20k farmers and 50k lots per season. **[OPEN]** confirm. |
| Security | TLS everywhere. JWT with short-lived access tokens and refresh tokens. Role checks on the server. Personal data such as mobile numbers is protected by row-level security. |
| Privacy | Personal data is handled in line with India's DPDP Act 2023: collected with consent, used only for its purpose, and exportable or deletable on request. |
| Audit | Every create, update and delete is logged with who, when, what, the old and new values, and the device. |
| Integrity | Geo-fence verification and mock-location detection are re-checked on the server. Photo EXIF is cross-checked against the record's GPS. |
| Availability | 99.5% for the backend. The mobile app is unaffected by backend downtime. |
| Backup | Daily DB snapshots kept for 30 days. Object storage is versioned. |

---

## 6. Proposed technical architecture

> The source suggests Flutter **or** React Native. The stack below is a recommendation. **[OPEN]** confirm before Phase 1.

| Layer | Choice | Reason |
|-------|--------|--------|
| Mobile | **React Native (Expo)** + TypeScript | Shares types and validation with the web app. Expo makes OTA updates easy. |
| Local DB | **WatermelonDB** (SQLite) | Built for offline-first apps with a sync protocol |
| Maps | MapLibre / react-native-maps + Turf.js | Geo-fence drawing, area and point-in-polygon on the device |
| Web | **Next.js** + TypeScript, TanStack Table, MapLibre GL, Recharts | |
| Backend | **PostgreSQL + PostGIS** (e.g. Supabase or managed Postgres) with a Node/TypeScript API (Fastify or Next.js route handlers) | Spatial queries, row-level security |
| Auth | Phone OTP (Supabase Auth / MSG91 / Firebase Auth) | |
| Storage | S3-compatible object storage | Photos |
| Shared | `packages/shared`: Zod schemas, lot-ID logic, unit conversions, stage config types | Same validation on device and server |
| CI/CD | GitHub Actions, EAS Build (mobile), Vercel or a container host (web/API) | |

### 6.1 Sync protocol (summary)

1. The client sends a **push**: changes since `last_pulled_at`, as created, updated and deleted rows per table.
2. The server validates each record against the shared Zod schemas, re-checks the geo-fence, upserts by UUID, and returns rejections with reasons.
3. The client sends a **pull**: changes since `last_pulled_at`, scoped to the user's assigned lots and masters.
4. Photos upload separately through pre-signed URLs, and their `media.uploaded_at` is updated on completion.

### 6.2 Core API surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/otp/request`, `/auth/otp/verify` | Login |
| POST | `/sync/push`, GET `/sync/pull` | Offline sync |
| POST | `/media/presign` | Photo upload URL |
| GET | `/lots`, `/lots/{lotId}` | Listing and detail |
| GET | `/reports/{reportKey}` | Dashboard datasets |
| CRUD | `/masters/{entity}` | Admin masters |
| POST | `/masters/{entity}/import` | Bulk import |
| GET | `/lots/{lotId}/qr.pdf`, POST `/labels/qr.pdf` | QR labels |

---

## 7. Database schema (logical)

```sql
-- masters
season(code PK, name, start_month, end_month)
crop(code PK, name, is_transplanted, pollination_method, active)
parent_line(id PK, crop_code FK, code, sex CHECK IN ('M','F'), UNIQUE(crop_code, code, sex))
hybrid(id PK, crop_code FK, hybrid_code, male_line_id FK, female_line_id FK,
       ratio_f_m, expected_yield_kg_per_acre, active, UNIQUE(crop_code, hybrid_code))
state(code PK, name, area_display_unit)
district(id PK, state_code FK, code, name, UNIQUE(state_code, code))
taluk(id PK, district_id FK, code, name, UNIQUE(district_id, code))
village(id PK, taluk_id FK, code, name, pincode, UNIQUE(taluk_id, code))

-- parties
organiser(id PK, code UNIQUE, name, address_1, address_2, village_id FK, pincode, mobile UNIQUE, email, active)
farmer(id PK, code UNIQUE, organiser_id FK, name, address_1, address_2, village_id FK, pincode, mobile, email, active)
farm(id PK, farmer_id FK, farm_seq, survey_no, declared_area_sqm, computed_area_sqm,
     soil_type, irrigation_source, location geography(Point), geofence geography(Polygon),
     UNIQUE(farmer_id, farm_seq))

-- production
stage_definition(id PK, crop_code FK, stage_code, sequence, applies_to_parent, repeatable,
                 mandatory, expected_day_offset, requires_photo, min_photos, form_schema jsonb,
                 UNIQUE(crop_code, stage_code))
production_lot(id PK uuid, lot_id char(21) UNIQUE, season_code FK, year, hybrid_id FK, organiser_id FK,
               farmer_id FK, farm_id FK, field_assistant_id FK, contracted_area_sqm, target_yield_kg,
               status, current_stage_code, created_at, UNIQUE(farm_id, season_code, year))
stage_record(id PK uuid, lot_id FK, stage_code, round_no, observed_on, data jsonb,
             gps geography(Point), gps_accuracy_m, inside_geofence, mock_location,
             captured_by FK, captured_at, server_received_at, device_id, app_version,
             supersedes uuid NULL, review_status, reviewed_by, reviewed_at, remarks)
media(id PK uuid, owner_type, owner_id, storage_key, gps geography(Point), taken_at, uploaded_at, size_bytes)

-- system
app_user(id PK, name, mobile UNIQUE, email, role, active)
user_scope(user_id FK, scope_type, scope_id)        -- region / organiser / lot assignments
audit_log(id PK, table_name, row_id, action, old jsonb, new jsonb, actor_id, device_id, at)
```

---

## 8. Validation summary

| Field | Regex / rule |
|-------|--------------|
| Season | `^(01\|02\|03)$` |
| Year | `^\d{2}$` (UI limits it to the current year ± 1) |
| Crop | `^[A-Z]{2}$` and must exist in the crop master |
| Hybrid | `^\d{4}$` |
| Male / Female line | `^[A-Z0-9]{4}$` |
| Organiser code | `^\d{3}$` |
| Farmer code | `^[A-Z0-9]{6}$` |
| State | `^[A-Z]{2}$` |
| District / Village | `^\d{2}$` |
| Taluk | `^\d{2,3}$` **[OPEN]** |
| Pincode | `^[1-9]\d{5}$` |
| Mobile | `^[6-9]\d{9}$` |
| Lot ID | `^\d{2}\d{2}[A-Z]{2}\d{4}\d{3}[A-Z0-9]{6}\d{2}$` |
| Dates | Not in the future. Must follow the stage order. |
| Geo-fence | ≥ 3 vertices, valid and non-self-intersecting, area > 100 m² |

---

## 9. Open questions (consolidated)

1. Confirm the 11 crop codes and the treatment of the duplicate Ridge Gourd entry.
2. Should season `03` (Summer) be reserved?
3. What is the taluk code length? Can there be more than 99 villages in a taluk?
4. Farmer–organiser link: is it fixed or per season? How is the farmer code generated?
5. Area display unit per state.
6. What is the stage flow for Onion? Confirm the transplanted or direct-sown flag for each crop.
7. Should the lot ID farm sequence be a fixed 2 digits?
8. Can a farm hold more than one lot in a season (split plots)?
9. Which user roles will use the app? Do organisers and growers use it?
10. Final choice of mobile framework (React Native vs Flutter) and hosting.
11. Expected volumes: users, farmers, lots per season.
12. Which Phase 2 modules come first: certification, processing or QC?

# Nireekshanam: Proposed File Hierarchy

| Item | Value |
|------|-------|
| Version | 0.1 (draft) |
| Date | 2026-10-02 |
| Assumes | The stack proposed in [SPECS.md §6](SPECS.md#6-proposed-technical-architecture): a TypeScript monorepo (pnpm + Turborepo) with React Native (Expo), Next.js and PostgreSQL/PostGIS |

> If Flutter is chosen instead (ADR-001), `apps/mobile` becomes a Flutter project and `packages/shared` validation is mirrored in Dart, or generated from JSON Schema.

---

## 1. Top level

```
nireekshanam/
├── apps/
│   ├── mobile/                 # Offline-first field app (Expo / React Native)
│   ├── web/                    # Manager dashboard + admin (Next.js)
│   └── api/                    # Sync & REST API (Fastify) — optional if using Next.js route handlers
├── packages/
│   ├── shared/                 # Domain types, Zod schemas, lot-ID, units, geo utils
│   ├── stage-config/           # Default per-crop stage definitions + form schemas
│   └── ui/                     # Shared design tokens (colours, spacing, icons)
├── db/
│   ├── migrations/             # Ordered SQL migrations (PostGIS)
│   ├── seeds/                  # Masters + stage definitions seed data
│   └── policies/               # Row-level security policies
├── docs/                       # Specs, planning, ADRs, guides
├── scripts/                    # Import, QR label, maintenance scripts
├── .github/workflows/          # CI: lint, test, build, deploy
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 2. `docs/`

```
docs/
├── readme_specs.md             # Converted source requirements (from readme_specs.docx)
├── SPECS.md                    # Functional & technical specification
├── PLANNING.md                 # Phases, milestones, risks, acceptance criteria
├── FILE_HIERARCHY.md           # This file
├── adr/
│   ├── 001-mobile-framework.md
│   ├── 002-backend-hosting.md
│   ├── 003-lot-id-format.md
│   ├── 004-area-units.md
│   └── 005-farmer-organiser-link.md
├── data/
│   ├── crop-stage-matrix.csv   # Stage applicability per crop (signed off in Phase 0)
│   └── master-import-templates/
│       ├── locations.xlsx
│       ├── organisers.xlsx
│       ├── farmers.xlsx
│       └── hybrids.xlsx
├── api/
│   └── openapi.yaml            # API contract
└── guides/
    ├── field-assistant-guide.md
    ├── supervisor-guide.md
    └── admin-guide.md
```

---

## 3. `packages/shared/`: the single source of truth for domain rules

```
packages/shared/
├── src/
│   ├── index.ts
│   ├── constants/
│   │   ├── seasons.ts          # 01 Kharif, 02 Rabi, 03 Summer
│   │   ├── crops.ts            # HP, OK, TO, WM, CU, BG, RG, SG, ON, CA, SC
│   │   ├── enums.ts            # Soil type, irrigation source, lot status, roles
│   │   └── stages.ts           # Stage codes (SOW_M, ROGUE_F_NURSERY, ...)
│   ├── schemas/                # Zod — used by mobile, web & API
│   │   ├── location.schema.ts
│   │   ├── organiser.schema.ts
│   │   ├── farmer.schema.ts
│   │   ├── farm.schema.ts
│   │   ├── hybrid.schema.ts
│   │   ├── lot.schema.ts
│   │   ├── stage-record.schema.ts
│   │   ├── media.schema.ts
│   │   └── sync.schema.ts      # Push/pull payloads
│   ├── lot-id/
│   │   ├── generate.ts         # Season+Year+Crop+Hybrid+Org+Farmer+FarmSeq
│   │   ├── parse.ts
│   │   └── validate.ts
│   ├── units/
│   │   └── area.ts             # m² ⇄ acres/guntas/cents, display per state
│   ├── geo/
│   │   ├── polygon-area.ts
│   │   ├── point-in-fence.ts   # With accuracy buffer
│   │   └── validate-polygon.ts # ≥3 vertices, no self-intersection
│   ├── stages/
│   │   ├── sequence.ts         # Ordering & predecessor checks
│   │   └── due-dates.ts        # Expected day offsets → due/overdue
│   └── yield/
│       └── estimate.ts         # Estimated seed kg, variance calcs
├── test/                       # Vitest unit tests mirror src/
├── package.json
└── tsconfig.json
```

---

## 4. `packages/stage-config/`

```
packages/stage-config/
├── src/
│   ├── index.ts
│   ├── defaults/
│   │   ├── transplanted.ts     # HP, TO, CA
│   │   ├── direct-sown.ts      # OK, WM, CU, BG, RG, SG
│   │   ├── sweet-corn.ts       # SC (detasseling)
│   │   └── onion.ts            # ON (pending confirmation)
│   └── forms/                  # JSON form schemas per stage
│       ├── sowing.json
│       ├── transplanting.json
│       ├── vegetative.json
│       ├── rogueing.json
│       ├── pollination.json
│       ├── maturity.json
│       ├── yield-estimation.json
│       ├── harvesting.json
│       ├── plow-down.json
│       ├── seed-collection.json
│       └── final-yield.json
└── package.json
```

---

## 5. `apps/mobile/` (Expo + WatermelonDB)

```
apps/mobile/
├── app/                        # Expo Router screens
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── login.tsx           # Mobile number
│   │   └── verify-otp.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── today.tsx           # Due / overdue stages
│   │   ├── lots.tsx            # Search + list
│   │   ├── scan.tsx            # QR scanner
│   │   └── sync.tsx            # Sync status & queue
│   ├── farmer/
│   │   ├── new.tsx
│   │   └── [id].tsx
│   ├── farm/
│   │   ├── new.tsx
│   │   ├── [id].tsx
│   │   └── geofence.tsx        # Walk / tap boundary
│   ├── lot/
│   │   ├── new.tsx
│   │   ├── [lotId]/
│   │   │   ├── index.tsx       # Timeline
│   │   │   ├── qr.tsx
│   │   │   └── stage/[stageCode].tsx   # Dynamic stage form
│   └── settings.tsx
├── src/
│   ├── db/
│   │   ├── schema.ts           # WatermelonDB schema
│   │   ├── migrations.ts
│   │   └── models/
│   │       ├── Season.ts  Crop.ts  Hybrid.ts  ParentLine.ts
│   │       ├── State.ts  District.ts  Taluk.ts  Village.ts
│   │       ├── Organiser.ts  Farmer.ts  Farm.ts
│   │       ├── ProductionLot.ts  StageDefinition.ts  StageRecord.ts
│   │       └── Media.ts
│   ├── sync/
│   │   ├── syncEngine.ts       # push/pull
│   │   ├── mediaUploader.ts    # Background photo queue
│   │   └── backgroundTask.ts
│   ├── services/
│   │   ├── auth.ts
│   │   ├── location.ts         # GPS fix, accuracy, mock detection
│   │   ├── camera.ts           # Capture, compress, watermark
│   │   └── qr.ts
│   ├── components/
│   │   ├── forms/              # Schema-driven form renderer + fields
│   │   ├── LocationCascade.tsx # State → District → Taluk → Village
│   │   ├── AreaInput.tsx       # Acres+guntas / acres+cents
│   │   ├── GeofenceMap.tsx
│   │   ├── StageTimeline.tsx
│   │   ├── PhotoCapture.tsx
│   │   ├── GpsBadge.tsx
│   │   └── SyncIndicator.tsx
│   ├── hooks/
│   ├── store/                  # Session / UI state
│   └── utils/
├── assets/
├── test/
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```

---

## 6. `apps/web/` (Next.js App Router)

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar, role-based nav
│   │   ├── page.tsx            # Season overview KPIs
│   │   ├── lots/
│   │   │   ├── page.tsx        # Lots by stage, filters, drill-down
│   │   │   └── [lotId]/page.tsx
│   │   ├── map/page.tsx        # Farm polygons by stage
│   │   ├── reports/
│   │   │   ├── overdue/page.tsx
│   │   │   ├── yield/page.tsx  # Estimated vs actual
│   │   │   ├── organisers/page.tsx
│   │   │   └── compliance/page.tsx
│   │   ├── review/page.tsx     # Supervisor review queue
│   │   └── admin/
│   │       ├── masters/[entity]/page.tsx
│   │       ├── import/page.tsx
│   │       ├── stages/page.tsx # Stage config editor
│   │       ├── users/page.tsx
│   │       └── labels/page.tsx # Bulk QR PDF
│   └── api/                    # Route handlers (if no separate apps/api)
├── components/
│   ├── charts/
│   ├── tables/
│   ├── map/
│   ├── filters/
│   └── layout/
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   ├── rbac.ts
│   └── queries/                # Report SQL / views
├── test/e2e/                   # Playwright
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 7. `apps/api/` (Fastify, if separated)

```
apps/api/
├── src/
│   ├── server.ts
│   ├── plugins/                # auth, db, rbac, error handling
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── sync.ts             # /sync/push, /sync/pull
│   │   ├── media.ts            # /media/presign
│   │   ├── lots.ts
│   │   ├── reports.ts
│   │   ├── masters.ts          # CRUD + import
│   │   └── labels.ts           # QR PDFs
│   ├── services/
│   │   ├── syncService.ts
│   │   ├── geofenceService.ts  # Server-side re-verification (PostGIS)
│   │   ├── lotService.ts
│   │   ├── importService.ts
│   │   ├── auditService.ts
│   │   └── labelService.ts
│   └── repositories/
├── test/                       # Integration tests vs PostGIS
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 8. `db/`

```
db/
├── migrations/
│   ├── 0001_extensions.sql         # postgis, pgcrypto
│   ├── 0002_masters.sql            # season, crop, parent_line, hybrid
│   ├── 0003_locations.sql          # state, district, taluk, village
│   ├── 0004_parties.sql            # organiser, farmer, farm
│   ├── 0005_production.sql         # stage_definition, production_lot, stage_record, media
│   ├── 0006_users_scope.sql
│   ├── 0007_audit.sql
│   └── 0008_report_views.sql
├── policies/
│   └── rls.sql
└── seeds/
    ├── seasons.sql
    ├── crops.sql
    ├── stage_definitions.sql
    └── demo/                       # Synthetic demo data (no real persons)
```

---

## 9. `scripts/`

```
scripts/
├── import-masters.ts           # CSV/XLSX → DB with dry-run report
├── generate-qr-labels.ts
├── recompute-geofence-flags.ts
└── backup-verify.sh
```

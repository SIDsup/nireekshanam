# Nireekshanam: Project Plan

| Item | Value |
|------|-------|
| Version | 0.1 (draft) |
| Date | 2026-10-02 |
| Related | [SPECS.md](SPECS.md) · [FILE_HIERARCHY.md](FILE_HIERARCHY.md) · [readme_specs.md](readme_specs.md) |

> Durations are indicative for a small team (1 mobile, 1 web/backend, 1 shared/QA, plus a part-time designer). Re-estimate once the open questions in SPECS §9 are closed.

---

## 1. Goals

1. Every hybrid seed production lot is tracked from contracting to final seed yield.
2. Field data is trustworthy: each record is geo-fenced, GPS-stamped, time-stamped, attributed to a user and backed by photos.
3. Field staff can work a full day with no connectivity.
4. Managers can see stage progress, overdue inspections and estimated vs actual yield in near real time.

### Success metrics (first full season)

| Metric | Target |
|--------|--------|
| Active lots registered in the app | ≥ 95% of contracted lots |
| Stage records captured inside the geo-fence | ≥ 90% |
| Overdue mandatory stages at season end | < 5% |
| Sync success (records synced within 24 h of capture) | ≥ 98% |
| Yield estimate accuracy (median abs. variance vs final) | Tracked as a baseline in season 1 |

---

## 2. Phases and milestones

### Phase 0: Discovery & Decisions (Weeks 1–2)

| # | Task | Output |
|---|------|--------|
| 0.1 | Workshop with the business to close the open questions in SPECS §9 | Signed-off decisions log |
| 0.2 | Confirm the per-crop stage flows, including Onion | Stage config sheet (CSV) |
| 0.3 | Collect master data: the location hierarchy, organisers, hybrids and parent lines | Import-ready spreadsheets |
| 0.4 | Choose the tech stack and hosting (RN vs Flutter, Supabase vs self-managed) | ADR-001, ADR-002 |
| 0.5 | Field visit: observe FAs, the phones in use and connectivity | Persona and device notes |

**Exit criteria:** decisions logged, master data samples received, stack approved.

### Phase 1: Clickable Prototype (Weeks 2–4)

| # | Task |
|---|------|
| 1.1 | Wireframes: login, today's work, farmer/farm registration, geo-fence capture, lot creation + QR, lot timeline, stage forms (rogueing, pollination, yield est., plow down), sync status |
| 1.2 | Hi-fi clickable prototype (Figma, or an Expo build with mocked data) |
| 1.3 | Usability test with 5–8 field staff |
| 1.4 | Iterate. Freeze the MVP screen list. |

**Exit criteria:** field staff can complete lot creation and a rogueing entry without help.

### Phase 2: Foundations (Weeks 4–7)

| # | Task |
|---|------|
| 2.1 | Monorepo scaffold, CI, lint/format, env management |
| 2.2 | `packages/shared`: Zod schemas, lot-ID generator/parser, area conversions, geo utilities, stage config types, with unit tests |
| 2.3 | DB schema and migrations (Postgres + PostGIS), seeds for masters and stage definitions |
| 2.4 | Auth (phone OTP), roles, row-level security / scope filters |
| 2.5 | Sync API (push/pull) + media presign, with idempotency tests |
| 2.6 | Audit logging |

**Exit criteria:** the sync round-trip passes the integration tests, and masters are importable.

### Phase 3: Mobile MVP (Weeks 6–12)

| # | Task |
|---|------|
| 3.1 | Local DB models + sync engine + background sync |
| 3.2 | Login, offline session, masters download |
| 3.3 | Farmer registration (location cascade) |
| 3.4 | Farm registration: GPS, geo-fence drawing (walk + tap), area calc and variance, photos |
| 3.5 | Lot creation, lot ID + QR display, QR scanning |
| 3.6 | Lot timeline + dynamic stage forms from `form_schema` |
| 3.7 | Auto-capture: GPS, accuracy, geo-fence check, mock-location detection, photo watermark |
| 3.8 | Today's work list, overdue logic |
| 3.9 | Sync status screen, photo upload queue |

### Phase 4: Web Dashboard MVP (Weeks 8–13)

| # | Task |
|---|------|
| 4.1 | Auth, layout, role-based navigation |
| 4.2 | Masters CRUD + CSV/Excel import |
| 4.3 | Stage configuration editor |
| 4.4 | User management and FA assignment |
| 4.5 | Season overview KPIs, lots by stage (drill-down) |
| 4.6 | Overdue inspections, estimated vs actual yield, organiser performance, compliance |
| 4.7 | Map view with farm polygons |
| 4.8 | Lot detail (timeline, records, photos, audit) |
| 4.9 | Supervisor review queue |
| 4.10 | Exports + bulk QR label PDF |

### Phase 5: Pilot (Weeks 13–16)

| # | Task |
|---|------|
| 5.1 | UAT with the business against the acceptance criteria (§4) |
| 5.2 | Pilot with 1 organiser, 10–20 farmers and 2–3 FAs on 1–2 crops |
| 5.3 | Daily feedback loop, bug triage, hotfixes via OTA |
| 5.4 | Training material: a short video and a laminated quick guide |

**Exit criteria:** pilot lots carried through at least up to pollination with the targets in §1 met, and no P1 bugs open.

### Phase 6: Rollout (from Week 17, aligned to the next season's sowing)

- Load the full masters, assign FAs, run train-the-trainer sessions through supervisors.
- Staged rollout by district.
- Hypercare for 4 weeks, then BAU support.

### Phase 7: Post-MVP backlog

| Priority | Module |
|----------|--------|
| P1 | Push notifications for due stages, weekly supervisor digest |
| P1 | Certification agency inspections |
| P2 | Procurement & processing (receipt, moisture, cleaning/grading loss, treatment) |
| P2 | Quality testing (germination, GOT, physical purity) per lot |
| P2 | Isolation distance check using PostGIS between neighbouring lots |
| P3 | Grower payments / settlements |
| P3 | Grower-facing view (farmer app or WhatsApp updates) |
| P3 | Yield prediction model using historical estimate vs final data |

---

## 3. Timeline overview

```
Week:        1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17+
Phase 0     ██████
Phase 1        █████████
Phase 2              ████████████
Phase 3                    ████████████████████
Phase 4                          ███████████████████
Phase 5                                         ████████████
Phase 6                                                     ███▶
```

**Critical constraint:** the pilot must line up with a real sowing window. If the business targets the **Rabi 2026** sowings (roughly Oct–Dec), the timeline above is too long. In that case, run Phase 5 with a minimal mobile build covering registration, lot, sowing and rogueing, and backfill the dashboard. **[OPEN]** confirm the target season.

---

## 4. MVP acceptance criteria

1. An FA can register a farmer and farm, draw a geo-fence and create a lot **fully offline**, and the lot ID and QR code are generated correctly.
2. All configured stages for a crop can be recorded in order. Stages that don't apply to that crop are hidden.
3. Every stage record carries GPS, accuracy, timestamp, user and the geo-fence result, and the server re-verifies them.
4. Records captured offline for 7 days sync without loss or duplication.
5. Out-of-fence entries and area variances show up in the supervisor review queue.
6. The dashboard shows lots by stage, overdue stages, and estimated vs actual yield by hybrid and organiser. These numbers match the raw records.
7. A bulk QR label PDF prints legibly and scans from the app.
8. The audit log shows the full history of any lot.

---

## 5. Team & responsibilities

| Role | Responsibility |
|------|----------------|
| Product owner (business) | Decisions, master data, UAT sign-off |
| Tech lead / backend | Architecture, DB, sync API, security |
| Mobile developer | Offline app, maps/geo-fence, sync engine |
| Web developer | Dashboard, reports, admin |
| QA / field tester | Test plans, device matrix, pilot support |
| Designer (part-time) | Prototype, localisation, field usability |

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor GPS accuracy under crop canopy or near buildings | False out-of-fence flags | Accuracy buffer on the fence check. Warn without blocking. Supervisor review. |
| FAs fake location or photos | Untrustworthy data | Mock-location detection, EXIF vs GPS check, server re-verification, camera-only capture (no gallery) |
| Long offline periods causing sync conflicts | Data loss or duplicates | Append-only records, UUID idempotency, conflict log |
| Low-end Android devices | Crashes, slow maps | Test on a 2 GB RAM device, cache offline map tiles per village, compress images |
| Master data quality (codes, villages) | Bad lot IDs, broken reports | Import validation and dry-run reports. Lock codes after first use. |
| Stage flows differ per crop or hybrid | Rework | Config-driven stages from day one |
| Missing the sowing window | Pilot slips a full season | Scope a minimal pilot build (see §3) |
| Literacy and app familiarity | Low adoption by field staff | Icon-led UI, short plain labels, hands-on training by supervisors, voice notes (backlog) |
| Personal data (mobile, address) | Compliance exposure | DPDP-aligned consent, RLS, minimal data, masked IDs |

---

## 7. Testing strategy

| Level | Scope | Tooling |
|-------|-------|---------|
| Unit | Shared lot-ID, conversions, geo, validators | Vitest |
| API integration | Sync push/pull, idempotency, scope filtering, RLS | Vitest + test Postgres (PostGIS) |
| Mobile | Components, sync engine | Jest + React Native Testing Library |
| E2E web | Masters import, dashboards, review queue | Playwright |
| E2E mobile | Registration → lot → stages, offline mode | Maestro / Detox |
| Field | Real devices, real farms, airplane mode for days | Pilot checklist |

---

## 8. Decisions log (to fill)

| ID | Decision | Date | Owner |
|----|----------|------|-------|
| ADR-001 | Mobile framework | | |
| ADR-002 | Backend / hosting | | |
| ADR-003 | Lot ID farm sequence fixed at 2 digits | | |
| ADR-004 | Area storage unit (m²) and display per state | | |
| ADR-005 | Farmer–organiser link (fixed vs per lot) | | |

# Database

PostgreSQL 15+ with PostGIS. Apply in order:

```sh
for f in migrations/*.sql policies/rls.sql seeds/seasons.sql seeds/crops.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f seeds/stage_definitions.sql   # regenerate with: npx tsx scripts/gen-stage-seed.ts
```

- `stage_record` is append-only. Corrections are new rows with `supersedes` set.
- `inside_geofence` is the server's own check (PostGIS), and `device_inside` is what the phone computed.
- The web app currently runs on seeded demo data (`apps/web/lib/data/seed.ts`). The repository layer replaces it once this schema is provisioned.

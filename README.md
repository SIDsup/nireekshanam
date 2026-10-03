# nireekshanam

Hybrid seed production monitoring: an installable web app (PWA) with a manager dashboard and an offline-first field section.

- [Source requirements](docs/readme_specs.md) (converted from `readme_specs.docx`)
- [Specification](docs/SPECS.md)
- [Project plan](docs/PLANNING.md)
- [File hierarchy](docs/FILE_HIERARCHY.md)
- [Screen designs](docs/design/) (`.dc.html` design files, the reference for the UI)

## Getting started

Requires Node 22+ and pnpm 11.

```sh
pnpm install
pnpm dev            # http://localhost:3000
```

Sign in with one of the demo accounts on the login screen. The one-time code is `246810` in the demo build.

| Account | Mobile | Lands on |
|---------|--------|----------|
| Production Manager | 9848022901 | Season overview |
| Supervisor | 9963100302 | Season overview |
| Field Assistant | 9848022211 | Field app (`/field`) |

## What's in the repo

| Path | What it is |
|------|------------|
| `apps/web` | Next.js 16 PWA: dashboard, map, lots, review queue, stage config, masters, users, QR labels, and the offline field app at `/field` |
| `packages/shared` | Domain rules shared by every app: lot ID, area units, geo-fence maths, stage due dates, yield, Zod schemas |
| `packages/stage-config` | Default stage flow and field forms per crop |
| `db/` | PostgreSQL + PostGIS migrations, row-level security and seeds |
| `scripts/` | `gen-stage-seed.ts` regenerates the stage definition seed from `stage-config` |

## Demo data

Until the database is provisioned, the web app runs on a deterministic synthetic dataset for Kharif 2026 (`apps/web/lib/data/seed.ts`): about 240 lots, 2,400 stage records, and no real persons. The demo's "today" is fixed at 2026-10-02 so due and overdue stages stay meaningful. Review decisions and synced field records are kept in memory and reset when the server restarts.

## Checks

```sh
pnpm test        # unit tests (shared, stage-config, web)
pnpm typecheck
pnpm build
```

CI also applies every migration to a PostGIS container.

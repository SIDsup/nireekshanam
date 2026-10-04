import { CROPS, getCrop, POLLINATION_LABELS, type FormField, type Parent, type StageDefinition } from '@nk/shared';
import { defaultStages } from '@nk/stage-config';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Badge, Button, cx, PageHeader, type Tone } from '@/components/ui/primitives';
import { db } from '@/lib/data/store';

export const metadata = { title: 'Stage configuration' };

type Search = { crop?: string; stage?: string; view?: string; enforce?: string };

const PARENT: Record<Parent, { label: string; tone: Tone }> = {
  MALE: { label: 'Male', tone: 'sky' },
  FEMALE: { label: 'Female', tone: 'rose' },
  BOTH: { label: 'Both', tone: 'neutral' },
  NA: { label: 'n/a', tone: 'neutral' },
};

/** The hot-pepper flow is the full 16-stage sequence; other crops are a subset of it. */
const FULL_FLOW = defaultStages('HP');

export default async function StagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const crop = getCrop(sp.crop ?? '') ?? CROPS[0]!;
  const defs = defaultStages(crop.code);
  const byCode = new Map(defs.map((d) => [d.stageCode, d]));
  const selected = byCode.get(sp.stage as StageDefinition['stageCode']) ?? byCode.get('ROGUE_M') ?? defs[0]!;
  const view = sp.view === 'schema' ? 'schema' : 'preview';
  const enforce = sp.enforce === 'block' ? 'block' : 'warn';
  const hybrid = db().hybrids.find((h) => h.cropCode === crop.code);
  const sampleLotId = `0126${crop.code}${hybrid?.hybridCode ?? '0000'}015TS004201`;

  const href = (p: Search) => {
    const m = { crop: crop.code, stage: selected.stageCode, view, enforce, ...p };
    const q = new URLSearchParams();
    if (m.crop && m.crop !== 'HP') q.set('crop', m.crop);
    if (m.stage && m.stage !== 'ROGUE_M') q.set('stage', m.stage);
    if (m.view === 'schema') q.set('view', 'schema');
    if (m.enforce === 'block') q.set('enforce', 'block');
    const s = q.toString();
    return s ? `/admin/stages?${s}` : '/admin/stages';
  };

  return (
    <>
      <PageHeader
        eyebrow="Configure · applies to new and active lots on next device sync"
        title="Stage configuration"
        actions={
          <>
            <span className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="info" size={15} />Changes are not saved in the demo build</span>
            <Button disabled title="Publishing needs the database">Discard</Button>
            <Button variant="primary" disabled title="Publishing needs the database">Publish</Button>
          </>
        }
      />

      <nav aria-label="Crop" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CROPS.map((c) => {
          const on = c.code === crop.code;
          return (
            <Link
              key={c.code}
              href={href({ crop: c.code, stage: undefined })}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={cx('flex h-11 flex-none items-center gap-2 whitespace-nowrap rounded-xl border pr-3.5 pl-1.5 text-[13.5px]', on ? 'border-ink bg-ink font-medium text-white' : 'border-line-strong bg-surface hover:bg-ground-3')}
            >
              <span className={cx('rounded-lg px-[7px] py-[5px] font-mono text-[11.5px] font-semibold', on ? 'bg-[#2b3d34] text-leaf' : 'bg-ground-2 text-subtle')}>{c.code}</span>
              {c.name}
            </Link>
          );
        })}
      </nav>

      {crop.flowPending && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-[#f3d7ae] bg-[#fdf4e7] px-[18px] py-3.5 text-[#5e3206]">
          <Icon name="info" size={18} strokeWidth={2} className="mt-px flex-none" />
          <p className="text-[13.5px] leading-[1.55]"><b className="font-semibold">{crop.name} flow is waiting on a business decision.</b> Hybrid onion seed goes seed → bulb → seed across two seasons. The default flow below is a placeholder until the stage list is confirmed.</p>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="stages-title" className="flex min-w-0 flex-[2_1_480px] flex-col gap-3.5 rounded-[20px] border border-line bg-surface pt-[22px] pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6">
            <div>
              <h2 id="stages-title" className="text-[17px] font-semibold tracking-[-0.01em]">{crop.name} stages</h2>
              <p className="mt-1 text-[13px] text-muted">{crop.isTransplanted ? 'Transplanted' : 'Direct-sown'} · {POLLINATION_LABELS[crop.pollinationMethod]} · {defs.length} stages in use</p>
            </div>
            <div role="group" aria-label="Stage order enforcement" className="flex items-center gap-2.5 text-[13px]">
              <span className="text-muted">Order enforcement</span>
              <div className="flex rounded-[11px] bg-ground-2 p-[3px]">
                <Seg href={href({ enforce: 'warn' })} active={enforce === 'warn'}>Warn</Seg>
                <Seg href={href({ enforce: 'block' })} active={enforce === 'block'}>Block</Seg>
              </div>
            </div>
          </div>
          <p className="px-6 text-[12.5px] text-muted">
            {enforce === 'block' ? 'Field assistants cannot save a stage until the previous mandatory stage is recorded.' : 'Field assistants see a warning when they skip a stage, and can still save.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="w-11 border-b border-line-soft py-2.5 pr-2 pl-6 font-medium">Seq</th>
                  <th scope="col" className="border-b border-line-soft px-2 py-2.5 font-medium">Stage</th>
                  <th scope="col" className="border-b border-line-soft px-2 py-2.5 font-medium">Applies to</th>
                  <th scope="col" className="border-b border-line-soft px-2 py-2.5 text-center font-medium">Repeatable</th>
                  <th scope="col" className="border-b border-line-soft px-2 py-2.5 text-center font-medium">Mandatory</th>
                  <th scope="col" className="border-b border-line-soft px-2 py-2.5 text-right font-medium">Due day</th>
                  <th scope="col" className="border-b border-line-soft py-2.5 pr-6 pl-2 text-right font-medium">Min photos</th>
                </tr>
              </thead>
              <tbody>
                {FULL_FLOW.map((base) => {
                  const d = byCode.get(base.stageCode);
                  const row = d ?? base;
                  const na = !d;
                  const on = d?.stageCode === selected.stageCode;
                  const p = PARENT[row.appliesToParent];
                  return (
                    <tr key={base.stageCode} className={cx(on && 'bg-brand-soft', na && 'text-muted')}>
                      <td className="tabular border-b border-row py-2 pr-2 pl-6 text-muted">{row.sequence}</td>
                      <td className="border-b border-row p-2">
                        {na ? (
                          <span className="flex min-h-10 flex-col justify-center gap-0.5 py-1 opacity-60">
                            <span className="text-[13.5px] font-medium line-through">{row.name}</span>
                            <span className="font-mono text-[11px]">{row.stageCode} · not used for direct-sown crops</span>
                          </span>
                        ) : (
                          <Link href={href({ stage: row.stageCode })} scroll={false} aria-current={on ? 'true' : undefined} className="flex min-h-10 flex-col justify-center gap-0.5 py-1 hover:underline">
                            <span className={cx('text-[13.5px] text-ink', on ? 'font-semibold' : 'font-medium')}>{row.name}</span>
                            <span className="font-mono text-[11px] text-muted">{row.stageCode}</span>
                          </Link>
                        )}
                      </td>
                      <td className="border-b border-row p-2">
                        {na ? <Badge className="px-[9px] py-0.5 text-[11.5px]">Not used</Badge> : <Badge tone={p.tone} className="px-[9px] py-0.5 text-[11.5px]">{p.label}</Badge>}
                      </td>
                      <td className="border-b border-row p-2 text-center">
                        <input type="checkbox" aria-label={`${row.name} is repeatable`} defaultChecked={!na && row.repeatable} disabled={na} className="size-[18px] accent-brand align-middle" />
                      </td>
                      <td className="border-b border-row p-2 text-center">
                        <input type="checkbox" aria-label={`${row.name} is mandatory`} defaultChecked={!na && row.mandatory} disabled={na} className="size-[18px] accent-brand align-middle" />
                      </td>
                      <td className="tabular border-b border-row p-2 text-right font-mono text-[12.5px]">{na ? '—' : `${row.expectedDayOffset > 0 ? '+' : ''}${row.expectedDayOffset}`}</td>
                      <td className="tabular border-b border-row py-2 pr-6 pl-2 text-right">{na ? '—' : row.minPhotos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-6 pt-1 pb-2 text-xs text-muted">Due day counts from female sowing. Stages past their due day with no record appear under Overdue inspections.</p>
        </section>

        <section aria-labelledby="form-title" className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 rounded-[20px] border border-line bg-surface px-6 py-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="form-title" className="text-[17px] font-semibold tracking-[-0.01em]">{selected.name}</h2>
              <p className="mt-1 text-[13px] text-muted">Field form · {selected.fields.length} fields{selected.minPhotos ? ` · min ${selected.minPhotos} photo${selected.minPhotos > 1 ? 's' : ''}` : ''}</p>
            </div>
            <div role="group" aria-label="View" className="flex rounded-[11px] bg-ground-2 p-[3px]">
              <Seg href={href({ view: 'preview' })} active={view === 'preview'}>Preview</Seg>
              <Seg href={href({ view: 'schema' })} active={view === 'schema'}>Schema</Seg>
            </div>
          </div>

          {view === 'preview' ? <PhonePreview def={selected} lotId={sampleLotId} /> : (
            <pre className="max-h-[560px] overflow-auto rounded-[14px] bg-forest p-4 font-mono text-xs leading-[1.6] whitespace-pre text-forest-text" tabIndex={0} aria-label="Stage definition as JSON">
              {JSON.stringify(schemaOf(selected), null, 2)}
            </pre>
          )}

          <p className="text-xs leading-normal text-muted">Every record also captures GPS, accuracy, geo-fence result, user, device and timestamp automatically.</p>
        </section>
      </div>
    </>
  );
}

function Seg({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-current={active ? 'true' : undefined} className={cx('flex h-[38px] items-center rounded-lg px-3 text-[12.5px]', active ? 'bg-surface font-medium shadow-[0_1px_2px_rgba(16,32,26,0.12)]' : 'text-muted hover:text-ink')}>
      {children}
    </Link>
  );
}

function fieldSchema(f: FormField): Record<string, unknown> {
  switch (f.type) {
    case 'date': return { type: 'string', format: 'date' };
    case 'number': return { type: 'number', minimum: 0, ...(f.unit ? { unit: f.unit } : {}) };
    case 'text': return { type: 'string', maxLength: 200 };
    case 'choice': return { enum: f.options };
    case 'multichoice': return { type: 'array', items: { enum: f.options }, uniqueItems: true };
    case 'photo': return { type: 'array', items: { $ref: '#/media' } };
    case 'computed': return { readOnly: true, ...(f.unit ? { unit: f.unit } : {}) };
  }
}

function schemaOf(d: StageDefinition) {
  return {
    crop_code: d.cropCode,
    stage_code: d.stageCode,
    sequence: d.sequence,
    applies_to_parent: d.appliesToParent,
    repeatable: d.repeatable,
    mandatory: d.mandatory,
    expected_day_offset: d.expectedDayOffset,
    requires_photo: d.minPhotos > 0,
    min_photos: d.minPhotos,
    requires_geofence: d.requiresGeofence,
    form_schema: {
      type: 'object',
      required: d.fields.filter((f) => f.required).map((f) => f.key),
      properties: Object.fromEntries(d.fields.map((f) => [f.key, { title: f.label, ...fieldSchema(f) }])),
    },
  };
}

const COMPUTED_HINT: Record<string, string> = {
  ratio_f_m: '4.0 : 1',
  estimated_seed_kg: '—',
  picking_no: 'Picking 1',
  variance_vs_estimate: '—',
  variance_vs_target: '—',
};

function PhonePreview({ def, lotId }: { def: StageDefinition; lotId: string }) {
  return (
    <div className="w-full max-w-[320px] self-center rounded-[34px] bg-ink p-2.5" role="img" aria-label={`Phone preview of the ${def.name} form`}>
      <div className="flex flex-col overflow-hidden rounded-[26px] bg-ground" aria-hidden="true">
        <div className="flex flex-col gap-2 bg-forest px-4 pt-4 pb-3.5 text-white">
          <div className="font-mono text-[10.5px] text-[#9fb3a8]">{lotId}</div>
          <div className="text-base font-semibold">{def.name}{def.repeatable ? ' · Round 2' : ''}</div>
          <div className="flex flex-wrap gap-1.5 text-[10.5px] font-medium">
            <span className="rounded-full bg-forest-3 px-2 py-[3px] text-leaf">GPS ±6 m</span>
            <span className="rounded-full bg-forest-3 px-2 py-[3px] text-leaf">Inside fence</span>
            <span className="rounded-full bg-forest-3 px-2 py-[3px] text-forest-text">Offline · saved on device</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          {def.fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-[5px]">
              <span className="text-[11.5px] font-medium text-subtle">
                {f.label}
                {f.type === 'photo' && def.minPhotos > 0 ? ` (min ${def.minPhotos})` : ''}
                {f.required && <span className="text-signal"> *</span>}
                {f.type === 'multichoice' && <span className="font-normal text-muted"> · select all that apply</span>}
              </span>
              <FieldPreview f={f} />
            </div>
          ))}
          <span className="mt-1 flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">Save record</span>
        </div>
      </div>
    </div>
  );
}

function FieldPreview({ f }: { f: FormField }) {
  const box = 'flex h-[38px] items-center justify-between rounded-[10px] px-2.5 text-[13px]';
  switch (f.type) {
    case 'date':
    case 'number':
    case 'text':
      return (
        <span className={cx(box, 'border border-line-strong bg-surface text-faint')}>
          {f.type === 'date' ? 'dd-mm-yyyy' : f.type === 'number' ? '0' : f.required ? '' : 'Optional'}
          <span className="text-[11px] text-muted">{f.type === 'date' ? <Icon name="calendar" size={14} /> : f.unit}</span>
        </span>
      );
    case 'choice':
    case 'multichoice':
      return (
        <span className="flex flex-wrap gap-1.5">
          {(f.options ?? []).map((o, i) => (
            <span key={o} className={cx('inline-flex h-[30px] items-center gap-1 rounded-full px-2.5 text-xs', i === 0 ? 'bg-brand text-white' : 'border border-line-strong bg-surface text-subtle')}>
              {f.type === 'multichoice' && i === 0 && <Icon name="check" size={12} strokeWidth={2.4} />}
              {o}
            </span>
          ))}
        </span>
      );
    case 'photo':
      return (
        <span className="flex gap-1.5">
          <span className="flex size-[58px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#9aa79f] text-muted"><Icon name="camera" size={18} /></span>
          <span className="self-center text-[11px] leading-[1.4] text-muted">Camera only · watermarked</span>
        </span>
      );
    case 'computed':
      return (
        <span className={cx(box, 'bg-[#e9eee8] text-subtle')}>
          {COMPUTED_HINT[f.key] ?? '—'}{f.unit && COMPUTED_HINT[f.key] === '—' ? ` ${f.unit}` : ''}
          <span className="rounded-md bg-brand-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-text">AUTO</span>
        </span>
      );
  }
}

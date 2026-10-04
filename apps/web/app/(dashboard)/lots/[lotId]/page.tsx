import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { areaVariance, daysBetween, getCrop, isAreaVarianceFlagged, lotIdSegments, nickOffsetDays, parseLotId, seasonName, type FormField, type StageProgress } from '@nk/shared';
import { Icon } from '@/components/ui/icon';
import { Avatar, Badge, ButtonLink, Card, CardHeader, cx, type Tone } from '@/components/ui/primitives';
import { lotPeople } from '@/lib/data/lots-extra';
import { auditFor, lotView } from '@/lib/data/queries';
import type { StageRecord } from '@/lib/data/types';
import { fmtDateTime, fmtDay, fmtDays, fmtGuntas, fmtInt, fmtSignedPct, initials } from '@/lib/format';
import { FenceMap } from './fence-map';

export async function generateMetadata({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await params;
  return { title: `Lot ${lotId}` };
}

const STATUS_TONE: Record<string, Tone> = { ACTIVE: 'brand', PLANNED: 'neutral', HARVESTED: 'sky', CLOSED: 'dark', REJECTED: 'danger', ABANDONED: 'neutral' };
const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso: string) => `${fmtDay(iso)} ${iso.slice(0, 4)}`;
const time = (iso: string) => fmtDateTime(iso).split(', ')[1] ?? '';

export default async function LotDetailPage({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId: raw } = await params;
  const lotId = decodeURIComponent(raw).toUpperCase();
  const v = lotView(lotId);
  if (!v) notFound();
  const people = lotPeople(lotId)!;
  const audit = auditFor(lotId);
  const crop = getCrop(v.hybrid.cropCode);
  const parsed = parseLotId(lotId);
  const segments = parsed.ok ? lotIdSegments(parsed.parts) : [];

  const qrSvg = await QRCode.toString(lotId, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#10201a', light: '#0000' } });

  const today = people.today;
  const cropAge = daysBetween(v.lot.femaleSowingDate, today);
  const maleSow = v.records.find((r) => r.stageCode === 'SOW_M');
  const femaleSow = v.records.find((r) => r.stageCode === 'SOW_F');
  const nick = maleSow && femaleSow ? nickOffsetDays(maleSow.observedOn, femaleSow.observedOn) : null;
  const latest = v.records.at(-1);
  const defs = new Map(v.progress.map((p) => [p.definition.stageCode, p.definition]));
  const recordsByStage = new Map<string, StageRecord[]>();
  for (const r of v.records) recordsByStage.set(r.stageCode, [...(recordsByStage.get(r.stageCode) ?? []), r]);

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <Link href="/lots" className="flex min-h-8 items-center hover:text-ink">Production lots</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-mono text-ink">{lotId}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone={STATUS_TONE[v.lot.status] ?? 'neutral'} className="font-semibold tracking-[0.06em] uppercase">{titleCase(v.lot.status)}</Badge>
            <span className="text-[13px] text-muted">Created {fmtDate(v.lot.createdAt)} by {v.faName} · offline, synced {fmtDateTime(v.lot.createdAt)}</span>
          </div>
          <h1 className="sr-only">Lot {lotId}</h1>
          {segments.length ? (
            <div className="flex flex-wrap items-start gap-1.5" aria-hidden="true">
              {segments.map((s, i) => (
                <div key={s.label} className="flex flex-col items-center gap-1.5">
                  <span className={cx('rounded-xl px-3 py-2.5 font-mono text-[clamp(22px,2.6vw,32px)] leading-none font-semibold tracking-[0.02em]', i === 2 || i === 3 ? 'bg-ink text-white' : 'border border-line-strong bg-surface')}>{s.value}</span>
                  <span className="text-[11px] whitespace-nowrap text-muted">{i === 0 ? `Season · ${seasonName(s.value)}` : s.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[28px] font-semibold">{lotId}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={`/map?lot=${lotId}`} icon="map">Open on map</ButtonLink>
          <ButtonLink href={`/review`} icon="shield">Review queue</ButtonLink>
          <ButtonLink href={`/admin/labels?lots=${lotId}`} icon="printer" variant="primary">Print field tag</ButtonLink>
        </div>
      </header>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(max(170px,calc((100%-2px)/3)),1fr))] gap-px overflow-hidden rounded-[18px] border border-line bg-line">
        <Fact label="Hybrid" value={`${crop?.name ?? v.hybrid.cropCode} ${v.hybrid.hybridCode}`} sub={<span className="font-mono">♀ {v.hybrid.femaleCode} × ♂ {v.hybrid.maleCode} · {v.hybrid.ratio.replace(':', ' : ')}</span>} />
        <Fact label="Farmer" value={v.farmer.name} sub={`${v.village.name}, ${v.village.districtName}, ${v.village.stateCode}`} />
        <Fact label="Organiser" value={v.organiser.name} sub={`Code ${v.organiser.code} · ${people.organiserLots} lots`} />
        <Fact label="Field assistant" value={v.faName} sub={people.faLastSyncAt ? `Last synced ${fmtDateTime(people.faLastSyncAt)}` : 'Not synced yet'} />
        <Fact label="Crop age" value={cropAge >= 0 ? `Day ${cropAge}` : `Sows in ${fmtDays(-cropAge)}`} sub={`Since female sowing${nick !== null ? ` · nick ${nick > 0 ? '+' : nick < 0 ? '−' : ''}${Math.abs(nick)} d` : ''}`} />
        <Fact label="Target yield" value={`${fmtInt(v.lot.targetYieldKg)} kg`} sub={`${fmtGuntas(v.lot.contractedAreaSqm)} × ${v.hybrid.expectedKgPerAcre} kg/ac`} />
      </dl>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 px-6 py-[22px]">
          <CardHeader
            title="Stage timeline"
            subtitle={`${crop?.isTransplanted ? 'Transplanted' : 'Direct-sown'} flow · ${v.progress.length} stages · due dates from female sowing (${fmtDay(v.lot.femaleSowingDate)})`}
            actions={
              <div className="flex flex-wrap gap-3.5 text-xs text-subtle">
                <LegendDot className="bg-brand-mid" label="Done" />
                <LegendDot className="border-[2.5px] border-sky bg-surface" label="In progress" />
                <LegendDot className="border-[2.5px] border-signal-mid bg-surface" label="Due soon" />
                <LegendDot className="bg-signal" label="Overdue" />
                <LegendDot className="border-[1.5px] border-[#c9d1c8] bg-surface" label="Upcoming" />
              </div>
            }
          />
          <ol className="flex flex-col">
            {v.progress.map((p, i) => (
              <TimelineItem key={p.definition.stageCode} p={p} last={i === v.progress.length - 1} records={recordsByStage.get(p.definition.stageCode) ?? []} names={people.userNames} />
            ))}
          </ol>
        </Card>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <Card className="flex flex-col gap-3.5 px-6 py-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Farm &amp; geo-fence</h2>
              <span className="text-xs text-muted">Farm {String(v.farm.farmSeq).padStart(2, '0')} · Sy. No. {v.farm.surveyNo}</span>
            </div>
            <FenceMap fence={v.farm.geofence} records={v.records.map((r) => ({ gps: r.gps, inside: r.insideGeofence, distanceOutsideM: r.distanceOutsideM }))} />
            <AreaFacts declared={v.farm.declaredAreaSqm} computed={v.farm.computedAreaSqm} soil={v.farm.soilType} water={v.farm.irrigation} />
          </Card>

          <Card className="flex flex-wrap items-center gap-[18px] px-6 py-[22px]">
            <div className="flex-none rounded-xl border border-line bg-surface p-2.5">
              <div role="img" aria-label={`QR code for lot ${lotId}`} className="size-[126px] [&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-1.5">
              <h2 className="text-[15px] font-semibold">Lot QR</h2>
              <p className="text-[12.5px] leading-normal text-muted">Encodes the lot ID. Scan from the field app to open this lot offline.</p>
              <Link href={`/admin/labels?lots=${lotId}`} className="flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-brand hover:text-brand-strong">
                <Icon name="printer" size={15} />Print A6 field tag
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {latest ? (
          <LatestRecord lotId={lotId} record={latest} stageName={defs.get(latest.stageCode)?.name ?? latest.stageCode} repeatable={!!defs.get(latest.stageCode)?.repeatable} fields={defs.get(latest.stageCode)?.fields ?? []} names={people.userNames} />
        ) : (
          <Card className="flex min-w-0 flex-[2_1_560px] flex-col gap-2 px-6 py-[22px]">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Latest record</h2>
            <p className="text-[13px] text-muted">No stage records yet. The first record is due on {fmtDate(v.progress[0]?.dueOn ?? v.lot.femaleSowingDate)}.</p>
          </Card>
        )}

        <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 px-6 py-[22px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Audit history</h2>
            <span className="text-xs text-muted">{audit.length} entries</span>
          </div>
          <AuditList entries={audit.slice(0, 6)} roles={people.userRoles} />
          {audit.length > 6 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-brand [&::-webkit-details-marker]:hidden">
                <Icon name="chevronDown" size={15} className="transition-transform group-open:rotate-180" />
                <span className="group-open:hidden">Show full log ({audit.length - 6} more)</span>
                <span className="hidden group-open:inline">Hide older entries</span>
              </summary>
              <div className="mt-3"><AuditList entries={audit.slice(6)} roles={people.userRoles} /></div>
            </details>
          )}
        </Card>
      </div>
    </>
  );
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="bg-surface px-[18px] py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-[14.5px] font-medium">{value}</dd>
      <dd className="mt-0.5 text-xs text-muted">{sub}</dd>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span aria-hidden="true" className={cx('size-2.5 rounded-full', className)} />{label}</span>;
}

/* ------------------------------------------------------------------------------------------------ */

function fmtValue(value: unknown, field?: FormField): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? fmtInt(value) : value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
    return field?.unit ? `${n}${field.unit === '%' ? '%' : ` ${field.unit}`}` : n;
  }
  return String(value ?? '—');
}

function fieldEntries(data: Record<string, unknown>, fields: readonly FormField[]) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return Object.entries(data).map(([key, value]) => {
    const f = byKey.get(key);
    const label = f?.label ?? titleCase(key.replace(/_(kg|g|pct|cm|sqm)$/, ''));
    const unitFallback = f ? undefined : key.endsWith('_kg') ? 'kg' : key.endsWith('_pct') ? '%' : key.endsWith('_g') ? 'g' : undefined;
    return { key, label, value: fmtValue(value, f ?? (unitFallback ? { key, label, type: 'number', unit: unitFallback } : undefined)), numeric: typeof value === 'number' ? value : null };
  });
}

const NODE: Record<StageProgress['status'], string> = {
  DONE: 'bg-brand-mid',
  IN_PROGRESS: 'border-[3px] border-sky bg-surface shadow-[0_0_0_5px_var(--color-sky-tint)]',
  DUE: 'border-[3px] border-signal-mid bg-surface',
  OVERDUE: 'bg-signal shadow-[0_0_0_5px_var(--color-signal-tint)]',
  UPCOMING: 'border-2 border-[#c9d1c8] bg-surface',
};

const STATUS_LABEL: Record<StageProgress['status'], string> = { DONE: 'Done', IN_PROGRESS: 'In progress', DUE: 'Due soon', OVERDUE: 'Overdue', UPCOMING: 'Upcoming' };

function TimelineItem({ p, last, records, names }: { p: StageProgress; last: boolean; records: StageRecord[]; names: Map<string, string> }) {
  const st = p.status;
  const first = records[0];
  const latest = records.at(-1);
  let date: string;
  if (st === 'DONE') date = records.length > 1 ? `${fmtDay(first!.observedOn)} · ${fmtDay(latest!.observedOn)}` : fmtDay(first!.observedOn);
  else if (st === 'IN_PROGRESS') date = `Since ${fmtDay(first!.observedOn)}`;
  else if (st === 'OVERDUE') date = `Due ${fmtDay(p.dueOn)} · ${fmtDays(p.daysLate)} late`;
  else if (st === 'DUE') date = p.daysLate === 0 ? 'Due today' : `Due ${fmtDay(p.dueOn)}`;
  else date = `Due ${fmtDay(p.dueOn)}`;

  let meta = '';
  if (latest) {
    const entries = fieldEntries(latest.data, p.definition.fields).slice(0, 3).map((e) => `${e.label} ${e.value}`);
    meta = [p.definition.repeatable && records.length > 1 ? `${records.length} rounds` : '', ...entries].filter(Boolean).join(' · ');
  } else if (st === 'DUE') meta = p.daysLate === 0 ? 'Due today' : `Due in ${fmtDays(-p.daysLate)}`;
  else if (st === 'OVERDUE') meta = 'No record received from the field yet';
  else if (p.definition.repeatable) meta = 'Repeatable · one record per round';

  const flags = records.filter((r) => !r.insideGeofence || r.mockLocation).map((r) => {
    const round = p.definition.repeatable ? `Round ${r.roundNo} ` : '';
    const what = r.mockLocation ? `${round}flagged for a mock location provider` : `${round}recorded ${r.distanceOutsideM} m outside fence`;
    const review = r.reviewStatus === 'APPROVED' ? `approved by ${names.get(r.reviewedBy ?? '') ?? 'supervisor'}` : r.reviewStatus === 'PENDING' ? 'awaiting review' : r.reviewStatus === 'REJECTED' ? 'rejected' : 'within GPS tolerance';
    return { id: r.id, text: `${what} · ${review}`, pending: r.reviewStatus === 'PENDING' };
  });

  const series = st === 'IN_PROGRESS' && records.length > 1 ? records.map((r) => fieldEntries(r.data, p.definition.fields).find((e) => e.numeric !== null)) : [];
  const seriesMax = Math.max(1, ...series.map((e) => e?.numeric ?? 0));

  return (
    <li className="flex items-stretch gap-4">
      <div className="flex w-[22px] flex-none flex-col items-center">
        <span className={cx('flex size-[22px] flex-none items-center justify-center rounded-full', NODE[st])}>
          {st === 'DONE' && <Icon name="check" size={12} strokeWidth={3.2} className="text-white" />}
          {st === 'IN_PROGRESS' && <span className="size-2 rounded-full bg-sky" />}
          {st === 'OVERDUE' && <span className="text-[13px] leading-none font-bold text-white">!</span>}
        </span>
        {!last && <span className={cx('min-h-3 w-0.5 flex-1', st === 'DONE' ? 'bg-brand-mid' : 'bg-line')} />}
      </div>
      <div className={cx('flex min-w-0 flex-1 flex-col gap-1 pt-px', last ? 'pb-0' : 'pb-[18px]', st === 'UPCOMING' && 'opacity-[0.72]')}>
        <span className="sr-only">{STATUS_LABEL[st]}: </span>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className={cx('text-sm', st === 'IN_PROGRESS' || st === 'DUE' || st === 'OVERDUE' ? 'font-semibold' : 'font-medium')}>{p.definition.name}</span>
            <span className="rounded-md bg-ground px-1.5 py-px font-mono text-[11px] text-muted">{p.definition.stageCode}</span>
          </div>
          <span className={cx('tabular text-[12.5px] whitespace-nowrap', st === 'OVERDUE' ? 'rounded-md bg-signal-tint px-1.5 font-semibold text-signal-text' : st === 'DUE' ? 'font-semibold text-signal-text' : st === 'IN_PROGRESS' ? 'font-semibold text-sky-text' : 'text-muted')}>{date}</span>
        </div>
        {meta && <div className="text-[12.5px] text-muted">{meta}</div>}
        {flags.map((f) => (
          <div key={f.id} className={cx('inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-[3px] text-xs font-medium', f.pending ? 'bg-signal text-white' : 'bg-signal-tint text-signal-text')}>
            <Icon name="pin" size={12} strokeWidth={2.2} />{f.text}
          </div>
        ))}
        {st === 'IN_PROGRESS' && latest && (
          <div className="mt-2 flex flex-col gap-2.5 rounded-[14px] border border-[#d6e4f1] bg-[#f5f9fd] px-4 py-3.5">
            <div className="flex flex-wrap justify-between gap-2 text-[12.5px]">
              <span className="font-medium">{records.length} {records.length === 1 ? 'record' : 'records'} so far</span>
              <span className="text-subtle">Latest {fmtDay(latest.observedOn)} · {names.get(latest.capturedBy) ?? latest.capturedBy}</span>
            </div>
            {series.length > 1 && series.every(Boolean) && (
              <>
                <svg viewBox={`0 0 ${series.length * 20} 56`} width="100%" height="56" preserveAspectRatio="none" role="img" aria-label={`${series[0]!.label} per record`}>
                  {series.map((e, i) => {
                    const h = Math.max(4, ((e!.numeric ?? 0) / seriesMax) * 52);
                    return <rect key={i} x={i * 20 + 2} y={56 - h} width={16} height={h} rx={2} fill="#1f6fb2" />;
                  })}
                </svg>
                <div className="flex justify-between text-[11.5px] text-muted"><span>{fmtDay(first!.observedOn)}</span><span>{series[0]!.label}</span><span>{fmtDay(latest.observedOn)}</span></div>
              </>
            )}
            {series.length <= 1 && (
              <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
                {fieldEntries(latest.data, p.definition.fields).map((e) => (
                  <div key={e.key} className="flex gap-1.5"><dt className="text-muted">{e.label}</dt><dd className="tabular font-medium">{e.value}</dd></div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------------------------------ */

function AreaFacts({ declared, computed, soil, water }: { declared: number; computed: number; soil: string; water: string }) {
  const variance = areaVariance(declared, computed);
  const flagged = isAreaVarianceFlagged(declared, computed);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
      <div><dt className="text-xs text-muted">Declared</dt><dd className="mt-0.5 font-medium">{fmtGuntas(declared)} <span className="font-normal text-muted">· {fmtInt(declared)} m²</span></dd></div>
      <div><dt className="text-xs text-muted">From geo-fence</dt><dd className="mt-0.5 font-medium">{fmtGuntas(computed)} <span className="font-normal text-muted">· {fmtInt(computed)} m²</span></dd></div>
      <div><dt className="text-xs text-muted">Variance</dt><dd className={cx('mt-0.5 font-medium', flagged ? 'text-signal-text' : 'text-brand-text')}>{fmtSignedPct(variance)} · {flagged ? 'over 10%, flagged' : 'within 10%'}</dd></div>
      <div><dt className="text-xs text-muted">Soil · water</dt><dd className="mt-0.5 font-medium">{titleCase(soil)} · {titleCase(water)}</dd></div>
    </dl>
  );
}

function LatestRecord({ lotId, record: r, stageName, repeatable, fields, names }: { lotId: string; record: StageRecord; stageName: string; repeatable: boolean; fields: readonly FormField[]; names: Map<string, string> }) {
  const entries = fieldEntries(r.data, fields);
  const gps = `${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)}`;
  const d = new Date(new Date(r.capturedAt).getTime() + 5.5 * 3600_000);
  const stamp = `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()} ${time(r.capturedAt)}`;

  return (
    <Card className="flex min-w-0 flex-[2_1_560px] flex-col gap-[18px] px-6 py-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Latest record</h2>
          <p className="mt-1 text-[13px] text-muted">{stageName}{repeatable ? ` · round ${r.roundNo}` : ''} · {fmtDate(r.observedOn)} · by {names.get(r.capturedBy) ?? r.capturedBy}</p>
        </div>
        {r.mockLocation ? (
          <Badge tone="danger" className="px-[11px] py-[5px] text-[12.5px]"><Icon name="alert" size={13} strokeWidth={2.4} />Mock location reported by device</Badge>
        ) : r.insideGeofence ? (
          <Badge tone="sky" className="px-[11px] py-[5px] text-[12.5px]"><Icon name="check" size={13} strokeWidth={2.4} />Inside geo-fence · re-verified on server</Badge>
        ) : (
          <Badge tone="signal" className="px-[11px] py-[5px] text-[12.5px]"><Icon name="pin" size={13} strokeWidth={2.4} />{r.distanceOutsideM} m outside geo-fence</Badge>
        )}
      </div>

      {!r.insideGeofence && r.outOfFenceReason && (
        <p className="rounded-xl bg-signal-tint px-3.5 py-2.5 text-[13px] text-signal-text">
          <span className="font-semibold">Reason given: </span>{r.outOfFenceReason}
          {r.reviewStatus === 'PENDING' && <> · <Link href="/review" className="font-medium underline">Awaiting review</Link></>}
        </p>
      )}

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-4 text-[13.5px]">
        {entries.map((e, i) => (
          <div key={e.key}>
            <dt className="text-xs text-muted">{e.label}</dt>
            <dd className={cx('mt-[3px]', i === 0 && e.numeric !== null ? 'tabular text-lg font-semibold' : 'font-medium')}>{e.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted">GPS</dt>
          <dd className="mt-[3px] font-mono text-[12.5px] font-medium">{gps} · <span className={r.gpsAccuracyM > 50 ? 'text-signal-text' : undefined}>±{r.gpsAccuracyM} m</span></dd>
        </div>
        <div><dt className="text-xs text-muted">Captured · received</dt><dd className="mt-[3px] font-medium">{time(r.capturedAt)} · {fmtDateTime(r.receivedAt).replace(`${fmtDay(r.capturedAt)}, `, '')}</dd></div>
        <div><dt className="text-xs text-muted">Device</dt><dd className="mt-[3px] font-medium"><span className="font-mono text-[12.5px]">{r.deviceId}</span> · app {r.appVersion}</dd></div>
      </dl>

      {r.photoCount > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {Array.from({ length: r.photoCount }, (_, i) => (
            <PhotoPlaceholder key={i} index={i} total={r.photoCount} mark={`${lotId}\n${stamp} · ${gps}`} caption={`${stageName} · photo ${i + 1} of ${r.photoCount}`} />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-ground px-3.5 py-3 text-[13px] text-muted"><Icon name="camera" size={16} />No photos attached to this record.</p>
      )}
    </Card>
  );
}

const SKIES = ['#c9d9cf', '#d6e2d9', '#bfd1c5'];

function PhotoPlaceholder({ index, total, mark, caption }: { index: number; total: number; mark: string; caption: string }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#2c4a39]" role="img" aria-label={`Photo ${index + 1} of ${total} placeholder. Watermark: ${mark.replace('\n', ', ')}`}>
        <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
          <rect width="160" height="120" fill={SKIES[index % SKIES.length]} />
          <path d={`M0 ${46 + index * 2} L160 ${40 - index} L160 120 L0 120 Z`} fill="#2c4a39" />
          <g stroke="#3f6a50" strokeWidth="3">
            {[-10, 20, 50, 80, 110, 140, 170].map((x, j) => <path key={j} d={`M${x} 120 L${60 + j * 12} ${46 - j * 0.6}`} />)}
          </g>
          <g fill="#5c8f6b">
            <circle cx={40 + index * 6} cy="92" r="9" /><circle cx="78" cy={80 - index * 3} r="7" /><circle cx={118 - index * 4} cy="96" r="10" /><circle cx="98" cy="64" r="5" />
          </g>
        </svg>
        <span className="absolute top-2 left-2 rounded-md bg-ink/60 px-[7px] py-0.5 text-[11px] font-medium text-white">Photo {index + 1} · not in demo data</span>
        <span className="absolute inset-x-0 bottom-0 bg-forest/80 px-2 py-[5px] font-mono text-[9.5px] leading-[1.35] whitespace-pre-line text-white">{mark}</span>
      </div>
      <figcaption className="text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

function AuditList({ entries, roles }: { entries: ReturnType<typeof auditFor>; roles: Map<string, string> }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {entries.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar initials={initials(a.actorName)} size={30} tone={roles.get(a.actorId) === 'FIELD_ASSISTANT' ? 'brand' : 'sky'} />
          <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
            <div className="break-words"><b className="font-semibold">{a.actorName}</b> <span className="text-subtle">{a.action}</span></div>
            <div className="text-xs text-muted">{fmtDateTime(a.at)} · {a.via}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}


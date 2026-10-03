import { areaVariance, ROLE_LABELS } from '@nk/shared';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Badge, cx, PageHeader, type Tone } from '@/components/ui/primitives';
import { reviewQueue, type ReviewItem } from '@/lib/data/queries';
import { db } from '@/lib/data/store';
import { centroid, fitProjection, nearestOnRing, pointsAttr, toMetres, type XY } from '@/lib/geo-svg';
import { fmtDateTime, fmtDay, fmtGuntas, fmtInt, fmtSignedPct } from '@/lib/format';
import { viewer } from '@/lib/session';
import { approveItem, rejectItem, undoItem } from './actions';
import { DecisionButtons, UndoButton } from './decision-buttons';

export const metadata = { title: 'Review queue' };

const TABS = [
  { key: 'all', label: 'All', kinds: ['geo', 'mock', 'area'] },
  { key: 'geo', label: 'Geo-fence & GPS', kinds: ['geo', 'mock'] },
  { key: 'area', label: 'Area variance', kinds: ['area'] },
] as const;

const PAGE = 12;
const SEVERITY_TONE: Record<ReviewItem['severity'], Tone> = { High: 'signalStrong', Medium: 'signal', Low: 'sky' };
const TYPE_LABEL: Record<ReviewItem['kind'], string> = { geo: 'Outside geo-fence', mock: 'Mock location', area: 'Area variance', dup: 'Duplicate lot ID' };
const LABELS: Record<ReviewItem['kind'], [string, string]> = {
  geo: ['Accept record', 'Reject record'],
  mock: ['Accept anyway', 'Reject and flag device'],
  area: ['Accept geo-fence area', 'Ask to redraw'],
  dup: ['Keep first copy', 'Void both'],
};

type Search = { tab?: string; item?: string; show?: string };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await viewer();
  const all = reviewQueue();
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const inTab = all.filter((i) => (tab.kinds as readonly string[]).includes(i.kind));
  const show = Math.max(PAGE, Number(sp.show) || PAGE);
  const visible = inTab.slice(0, show);
  const selected = inTab.find((i) => i.id === sp.item) ?? inTab.find((i) => !i.decision) ?? inTab[0];
  const decided = db().decisions.length;
  const users = new Map(db().users.map((u) => [u.id, u.name]));

  const href = (p: Search) => {
    const q = new URLSearchParams();
    const merged = { tab: tab.key, show: show > PAGE ? String(show) : undefined, ...p };
    if (merged.tab && merged.tab !== 'all') q.set('tab', merged.tab);
    if (merged.item) q.set('item', merged.item);
    if (merged.show) q.set('show', merged.show);
    const s = q.toString();
    return s ? `/review?${s}` : '/review';
  };

  return (
    <>
      <PageHeader
        eyebrow={`${ROLE_LABELS[user.role]} · ${user.scopeLabel}`}
        title="Review queue"
        actions={
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span className="tabular font-semibold text-ink">{fmtInt(decided)}</span> decided this session · highest severity first
          </p>
        }
      />

      <nav aria-label="Review type" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab.key;
          const open = all.filter((i) => (t.kinds as readonly string[]).includes(i.kind) && !i.decision).length;
          return (
            <Link
              key={t.key}
              href={href({ tab: t.key, item: undefined, show: undefined })}
              aria-current={on ? 'page' : undefined}
              className={cx('flex h-11 items-center gap-2 rounded-full border pr-2 pl-3.5 text-[13.5px]', on ? 'border-ink bg-ink font-medium text-white' : 'border-line-strong bg-surface hover:bg-ground-3')}
            >
              {t.label}
              <span className={cx('tabular rounded-full px-2 py-0.5 text-xs font-semibold', on ? 'bg-[#2b3d34] text-white' : 'bg-ground-2 text-subtle')} aria-label={`${open} open`}>{open}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Items" className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 rounded-[20px] border border-line bg-surface p-2">
          {visible.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand-text"><Icon name="check" size={20} strokeWidth={2.2} /></span>
              <p className="font-medium">Nothing to review here</p>
              <p className="text-[13px] text-muted">New out-of-fence records and area mismatches appear after the next field sync.</p>
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {visible.map((i) => (
              <li key={i.id}>
                <ItemRow item={i} selected={i.id === selected?.id} href={href({ item: i.id })} />
              </li>
            ))}
          </ul>
          {inTab.length > 0 && (
            <p className="mx-3 mt-1.5 mb-2.5 flex flex-wrap items-center gap-1 text-xs text-muted">
              Showing {fmtInt(visible.length)} of {fmtInt(inTab.length)}
              {visible.length < inTab.length && (
                <>
                  {' · '}
                  <Link href={href({ item: selected?.id, show: String(show + PAGE) })} scroll={false} className="inline-flex min-h-8 items-center font-medium text-brand">Load more</Link>
                </>
              )}
            </p>
          )}
        </section>

        {selected ? <Detail item={selected} capturedBy={selected.record ? (users.get(selected.record.capturedBy) ?? selected.lot.faName) : selected.lot.faName} /> : null}
      </div>
    </>
  );
}

function KindIcon({ kind }: { kind: ReviewItem['kind'] }) {
  return (
    <span className={cx('flex size-[34px] flex-none items-center justify-center rounded-[10px]', kind === 'area' ? 'bg-brand-tint text-brand-text' : kind === 'mock' ? 'bg-danger-tint text-danger-text' : 'bg-signal-tint text-signal-text')}>
      <Icon name={kind === 'area' ? 'box' : kind === 'dup' ? 'copy' : 'pin'} size={16} strokeWidth={2} />
    </span>
  );
}

function DecisionBadge({ d }: { d: NonNullable<ReviewItem['decision']> }) {
  return <Badge tone={d.decision === 'APPROVED' ? 'brand' : 'danger'} className="px-2 py-0.5 text-[11.5px] font-semibold">{d.decision === 'APPROVED' ? 'Accepted' : 'Rejected'}</Badge>;
}

function ItemRow({ item, selected, href }: { item: ReviewItem; selected: boolean; href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? 'true' : undefined}
      className={cx(
        'flex w-full items-start gap-3 rounded-[14px] border-[1.5px] p-3.5 text-left transition-colors',
        selected ? 'border-brand-mid bg-brand-soft' : 'border-transparent hover:bg-ground-3',
        item.decision && !selected && 'opacity-70',
      )}
    >
      <KindIcon kind={item.kind} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold">{TYPE_LABEL[item.kind]}</span>
          <span className="whitespace-nowrap text-[11.5px] text-muted">{fmtDateTime(item.when)}</span>
        </span>
        <span className="truncate font-mono text-xs text-subtle">{item.lot.lot.lotId}</span>
        <span className="text-[12.5px] text-muted">{item.stageName} · {item.lot.farmer.name}</span>
        <span className="mt-[3px] flex flex-wrap gap-1.5">
          <Badge tone={SEVERITY_TONE[item.severity]} className="px-2 py-0.5 text-[11.5px] font-semibold">{item.severity}</Badge>
          <Badge className="px-2 py-0.5 text-[11.5px]">{item.headline}</Badge>
          {item.decision && <DecisionBadge d={item.decision} />}
        </span>
      </span>
    </Link>
  );
}

function Detail({ item, capturedBy }: { item: ReviewItem; capturedBy: string }) {
  const { lot, record } = item;
  const [approveLabel, rejectLabel] = LABELS[item.kind];
  const variance = areaVariance(lot.farm.declaredAreaSqm, lot.farm.computedAreaSqm);
  const facts: [string, string][] = record
    ? [
        ['Distance outside', item.kind === 'mock' && record.insideGeofence ? '0 m (reported)' : `${fmtInt(record.distanceOutsideM)} m`],
        ['GPS accuracy', `±${fmtInt(record.gpsAccuracyM)} m`],
        ['Mock location', record.mockLocation ? 'Detected' : 'Not detected'],
        ['Photos', `${record.photoCount}`],
        ['Observed on', fmtDay(record.observedOn)],
        ['Received', fmtDateTime(record.receivedAt)],
        ['Device', `${record.deviceId} · app ${record.appVersion}`],
        ['Location', `${record.gps.lat.toFixed(5)}, ${record.gps.lng.toFixed(5)}`],
      ]
    : [
        ['Declared', fmtGuntas(lot.farm.declaredAreaSqm)],
        ['From geo-fence', fmtGuntas(lot.farm.computedAreaSqm)],
        ['Variance', `${fmtSignedPct(variance)} (limit 10%)`],
        ['Vertices', `${lot.farm.geofence.length}`],
        ['Survey no.', lot.farm.surveyNo],
        ['Farm', `${String(lot.farm.farmSeq).padStart(2, '0')} · ${lot.farm.soilType.toLowerCase()} soil`],
      ];
  const reason = record ? record.outOfFenceReason : undefined;

  return (
    <section aria-label="Selected item" className="flex min-w-0 flex-[2_1_400px] flex-col gap-5 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[item.severity]} className="px-2 py-0.5 text-[11.5px] font-semibold">{item.severity}</Badge>
            <span className="text-[13px] text-muted">{TYPE_LABEL[item.kind]} · {fmtDateTime(item.when)}</span>
          </div>
          <h2 className="mt-2.5 text-[22px] font-semibold tracking-[-0.015em]">{item.title}</h2>
          <p className="mt-1.5 text-[13.5px] text-muted">
            <Link href={`/lots/${lot.lot.lotId}`} className="break-all font-mono font-medium text-ink underline decoration-[#c9d1c8] underline-offset-[3px] hover:decoration-ink">{lot.lot.lotId}</Link>
            {' · '}{item.stageName} · {lot.farmer.name}, {lot.village.name}
          </p>
        </div>
        <span className="rounded-[10px] bg-ground px-3 py-2 text-[12.5px] leading-[1.4] text-subtle">{record ? 'Captured' : 'Registered'} by <b className="font-semibold">{capturedBy}</b></span>
      </div>

      {record ? <GeoVisual item={item} /> : <AreaVisual item={item} />}

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-3.5 text-[13.5px]">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={cx('mt-[3px] font-medium', k === 'Mock location' && v === 'Detected' && 'text-danger-text')}>{v}</dd>
          </div>
        ))}
      </dl>

      {record && (
        <figure className="flex flex-col gap-1.5 rounded-[14px] bg-[#f7f8f5] px-4 py-3.5">
          <figcaption className="text-xs text-muted">Reason given in the field</figcaption>
          <blockquote className={cx('text-[14.5px] leading-[1.55]', !reason && 'text-muted')}>{reason ? `“${reason}”` : 'No reason given.'}</blockquote>
        </figure>
      )}

      {item.decision && (
        <form action={undoItem} className={cx('flex items-center justify-between gap-3 rounded-xl py-1.5 pr-2 pl-3.5 text-[13.5px] font-medium', item.decision.decision === 'APPROVED' ? 'bg-brand-tint text-brand-text' : 'bg-danger-tint text-danger-text')} role="status">
          <input type="hidden" name="itemId" value={item.id} />
          <span>
            {item.decision.decision === 'APPROVED' ? 'You accepted this item. The FA will see your comment on next sync.' : 'You rejected this item. The FA will be asked to revisit.'}
            {item.decision.comment && <span className="mt-0.5 block font-normal opacity-90">Comment: “{item.decision.comment}”</span>}
          </span>
          <UndoButton />
        </form>
      )}

      <form key={`${item.id}-${item.decision?.decision ?? 'open'}`} className="flex flex-col gap-4">
        <input type="hidden" name="itemId" value={item.id} />
        <div className="flex flex-col gap-2">
          <label htmlFor="review-comment" className="text-[13px] font-medium">Comment for the field assistant</label>
          <textarea
            id="review-comment"
            name="comment"
            rows={3}
            maxLength={1000}
            defaultValue={item.decision?.comment ?? ''}
            placeholder="Visible to the FA in the app and saved in the audit log"
            className="resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-sm placeholder:text-faint"
          />
        </div>
        <DecisionButtons approve={approveItem} reject={rejectItem} approveLabel={item.decision ? `${approveLabel} instead` : approveLabel} rejectLabel={item.decision ? `${rejectLabel} instead` : rejectLabel} />
      </form>
    </section>
  );
}

const W = 520;
const H = 280;

function MapFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#eef1ea]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} className="block font-sans">
        <g stroke="#e2e7de">
          {[70, 140, 210].map((y) => <path key={`h${y}`} d={`M0 ${y} H${W}`} />)}
          {[130, 260, 390].map((x) => <path key={`v${x}`} d={`M${x} 0 V${H}`} />)}
        </g>
        {children}
      </svg>
    </div>
  );
}

function ScaleBar({ scale }: { scale: number }) {
  // Pick a round distance that renders between ~40 and ~120 px.
  const metres = [5, 10, 20, 25, 50, 100, 200, 250, 500].find((m) => m * scale >= 40) ?? 500;
  const px = metres * scale;
  return (
    <g transform={`translate(${W - 20 - px} ${H - 18})`} fontSize="11" fill="#3a4a42">
      <path d={`M0 -4 V0 H${px} V-4`} fill="none" stroke="#3a4a42" strokeWidth="1.4" />
      <text x={px / 2} y="-8" textAnchor="middle">{metres} m</text>
    </g>
  );
}

function GeoVisual({ item }: { item: ReviewItem }) {
  const r = item.record!;
  const ref = item.lot.farm.location;
  const fenceM = item.lot.farm.geofence.map((p) => toMetres(p, ref));
  const gpsM = toMetres(r.gps, ref);
  const { project, scale } = fitProjection([...fenceM.map((p) => ({ p })), { p: gpsM, r: r.gpsAccuracyM }], W, H, 40);
  const fence = fenceM.map(project);
  const pt = project(gpsM);
  const edge = project(nearestOnRing(gpsM, fenceM));
  const c = project(centroid(fenceM));
  const ringR = Math.max(r.gpsAccuracyM * scale, 8);
  const labelY = pt.y - ringR - 10 < 16 ? pt.y + ringR + 18 : pt.y - ringR - 10;
  const labelX = Math.min(Math.max(pt.x, 70), W - 70);
  const outside = !r.insideGeofence;

  return (
    <MapFrame label={`Record location ${outside ? `${r.distanceOutsideM} m outside` : 'inside'} the farm geo-fence, GPS accuracy ±${r.gpsAccuracyM} m`}>
      <polygon points={pointsAttr(fence)} fill="#7fbf93" fillOpacity={0.32} stroke="#2f7d4e" strokeWidth={2.5} strokeLinejoin="round" />
      <g fill="#ffffff" stroke="#2f7d4e" strokeWidth={2}>
        {fence.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4.5} />)}
      </g>
      <text x={c.x} y={c.y} textAnchor="middle" fontSize="12" fontWeight="600" fill="#165131">Farm geo-fence</text>
      {outside && <line x1={pt.x} y1={pt.y} x2={edge.x} y2={edge.y} stroke="#b4570f" strokeWidth={1.6} strokeDasharray="4 4" />}
      <circle cx={pt.x} cy={pt.y} r={ringR} fill="#d98a2b" fillOpacity={0.18} stroke="#d98a2b" strokeWidth={1.2} />
      <circle cx={pt.x} cy={pt.y} r={6.5} fill="#b4570f" stroke="#ffffff" strokeWidth={2} />
      <text x={labelX} y={labelY} textAnchor="middle" fontSize="12" fontWeight="600" fill="#7a3f08" paintOrder="stroke" stroke="#eef1ea" strokeWidth={4}>
        {outside ? `${r.distanceOutsideM} m out · ±${r.gpsAccuracyM} m` : `Reported inside · ±${r.gpsAccuracyM} m`}
      </text>
      <ScaleBar scale={scale} />
    </MapFrame>
  );
}

function AreaVisual({ item }: { item: ReviewItem }) {
  const { farm } = item.lot;
  const ref = farm.location;
  const fenceM = farm.geofence.map((p) => toMetres(p, ref));
  const cm = centroid(fenceM);
  // Illustrative outline: the fence scaled about its centre to the declared area.
  const k = Math.sqrt(farm.declaredAreaSqm / Math.max(farm.computedAreaSqm, 1));
  const declaredM: XY[] = fenceM.map((p) => ({ x: cm.x + (p.x - cm.x) * k, y: cm.y + (p.y - cm.y) * k }));
  const { project, scale } = fitProjection([...fenceM, ...declaredM].map((p) => ({ p })), W, H, 56);
  return (
    <figure className="flex flex-col gap-2">
      <MapFrame label={`Declared area ${fmtGuntas(farm.declaredAreaSqm)} compared with the geo-fence area ${fmtGuntas(farm.computedAreaSqm)}`}>
        <polygon points={pointsAttr(fenceM.map(project))} fill="#7fbf93" fillOpacity={0.38} stroke="#2f7d4e" strokeWidth={2.5} strokeLinejoin="round" />
        <polygon points={pointsAttr(declaredM.map(project))} fill="none" stroke="#10201a" strokeWidth={1.8} strokeDasharray="7 6" strokeLinejoin="round" />
        <g fontSize="12" fontWeight="600">
          <g transform="translate(20 22)">
            <path d="M0 0 H22" stroke="#10201a" strokeWidth={1.8} strokeDasharray="5 4" />
            <text x="30" y="4" fill="#10201a">Declared {fmtGuntas(farm.declaredAreaSqm)}</text>
          </g>
          <g transform="translate(20 42)">
            <rect x="0" y="-5" width="22" height="10" rx="2" fill="#7fbf93" fillOpacity={0.6} stroke="#2f7d4e" strokeWidth={1.5} />
            <text x="30" y="4" fill="#165131">Geo-fence {fmtGuntas(farm.computedAreaSqm)}</text>
          </g>
        </g>
        <ScaleBar scale={scale} />
      </MapFrame>
      <figcaption className="text-xs text-muted">The dashed outline is the walked fence scaled to the declared area, for comparison. It is not a surveyed boundary.</figcaption>
    </figure>
  );
}

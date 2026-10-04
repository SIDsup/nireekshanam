import Link from 'next/link';
import { Donut } from '@/components/charts/donut';
import { GroupedBars } from '@/components/charts/grouped-bars';
import { MiniBars, Sparkline } from '@/components/charts/sparkline';
import { StageBar } from '@/components/charts/stage-bar';
import { Icon } from '@/components/ui/icon';
import { Badge, ButtonLink, Card, CardHeader, cx, LotIdText, PageHeader, ProgressBar, tdClass, thClass } from '@/components/ui/primitives';
import { seasonOverview, weeklyActivity } from '@/lib/data/queries';
import { fmtAcres, fmtDays, fmtInt, fmtOne, fmtPct, fmtSignedPct, fmtTonnes } from '@/lib/format';

export const metadata = { title: 'Season overview' };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ measure?: string }> }) {
  const { measure } = await searchParams;
  const byArea = measure === 'area';
  const o = seasonOverview();
  const weekly = weeklyActivity();
  const estVsTarget = o.estimateKg / o.targetKg - 1;

  return (
    <>
      <PageHeader
        eyebrow="Kharif 2026 · Telangana · All crops"
        title="Season overview"
        actions={
          <>
            <ButtonLink href="/lots" icon="search" variant="secondary">Find a lot</ButtonLink>
            <ButtonLink href="/admin/labels" icon="download">Export</ButtonLink>
            <ButtonLink href="/admin/labels" icon="qr" variant="primary">Print QR labels</ButtonLink>
          </>
        }
      />

      <div className="flex items-center gap-2.5 text-[13px] text-muted">
        <span className="size-2 rounded-full bg-[#2f9e5e] shadow-[0_0_0_4px_#ddf1e4]" />
        Demo data as of {o.today} · {fmtInt(o.recordsToday)} field records today
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <Kpi title="Lots this season" value={fmtInt(o.lots)} sub={`${fmtInt(o.lots - o.closed)} active · ${fmtInt(o.closed)} closed`}>
          <Sparkline values={weekly.map((w) => w.records)} />
        </Kpi>
        <Kpi title="Contracted area" value={fmtInt(o.contractedSqm / 4046.8564224)} unit="ac" sub={`${fmtInt(o.farms)} farms · ${o.districts} districts`}>
          <MiniBars values={o.stages.filter((s) => s.count).map((s) => s.areaSqm)} />
        </Kpi>
        <Kpi
          title="Estimated seed yield"
          value={fmtTonnes(o.estimateKg)}
          unit="t"
          badge={<Badge tone={estVsTarget < 0 ? 'signal' : 'brand'}>{fmtSignedPct(estVsTarget)} vs target</Badge>}
          sub={`${fmtPct(o.estimateKg / o.targetKg)} of ${fmtTonnes(o.targetKg)} t target`}
        >
          <div className="w-24"><ProgressBar value={o.estimateKg / o.targetKg} marker={0.98} /></div>
        </Kpi>
        <Kpi title="Final seed yield" value={fmtOne(o.finalKg / 1000)} unit="t" sub={`From ${fmtInt(o.harvestPlusLots)} lots in harvest or later`}>
          <div className="w-24"><ProgressBar value={o.finalKg / o.targetKg} color="#10201a" /></div>
        </Kpi>
        <Kpi
          title="Inside geo-fence"
          value={(o.insideRecords / o.records * 100).toFixed(1)}
          unit="%"
          badge={<Badge tone={o.insideRecords / o.records >= 0.9 ? 'brand' : 'signal'}>Target ≥ 90%</Badge>}
          sub={`${fmtInt(o.outsideRecords)} of ${fmtInt(o.records)} records outside`}
        >
          <Sparkline values={weekly.map((w) => w.insidePct)} color="#1f6fb2" min={0.8} max={1} />
        </Kpi>
      </div>

      <Card className="flex flex-col gap-[18px] px-6 py-[22px]">
        <CardHeader
          title="Lots by current stage"
          subtitle="Each lot sits at its latest recorded stage. Select a segment to see those lots."
          actions={
            <>
              <div role="group" aria-label="Measure" className="flex rounded-xl bg-ground-2 p-[3px]">
                <SegLink href="/" active={!byArea}>Lots</SegLink>
                <SegLink href="/?measure=area" active={byArea}>Acreage</SegLink>
              </div>
              <Link href="/map" className="flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-brand">Open on map <Icon name="arrowRight" size={14} strokeWidth={2} /></Link>
            </>
          }
        />
        <StageBar segments={o.stages.map((s) => ({ key: s.key, label: s.label, value: byArea ? s.areaSqm : s.count, display: byArea ? fmtAcres(s.areaSqm) : fmtInt(s.count) }))} />
      </Card>

      <div className="flex flex-wrap gap-5">
        <Card className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5 px-6 py-[22px]">
          <CardHeader title="Estimated vs final seed yield" subtitle="Top six hybrids by contracted area · tonnes" />
          <div className="flex flex-wrap gap-[18px] text-[12.5px] text-subtle">
            <Legend color="#d5dcd4" label="Target" />
            <Legend color="#2f7d4e" label="Estimate" />
            <Legend color="#10201a" label="Final (to date)" />
          </div>
          <GroupedBars
            ariaLabel="Target, estimated and final seed yield for the top six hybrids"
            colors={['#d5dcd4', '#2f7d4e', '#10201a']}
            groups={o.hybridRows.slice(0, 6).map((r) => ({
              label: `${r.hybrid.cropCode} ${r.hybrid.hybridCode}`,
              sublabel: r.crop.name,
              values: [r.targetKg / 1000, r.estimateKg / 1000, r.finalKg / 1000],
            }))}
          />
        </Card>

        <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] px-6 py-[22px]">
          <CardHeader title="Field data integrity" subtitle={`${fmtInt(o.records)} stage records this season`} />
          <div className="flex flex-wrap items-center gap-5">
            <Donut value={o.insideRecords / o.records} label={fmtPct(o.insideRecords / o.records)} sub="in fence" />
            <div className="flex flex-[1_1_140px] flex-col gap-2 text-[13px]">
              <LegendRow color="#1f6fb2" label="Inside fence" value={fmtInt(o.insideRecords)} />
              <LegendRow color="#f2b766" label="Outside, with reason" value={fmtInt(o.outsideRecords - o.pendingReview)} />
              <LegendRow color="#b4570f" label="Awaiting review" value={fmtInt(o.pendingReview)} />
            </div>
          </div>
          <div className="flex flex-col gap-3.5 border-t border-line-soft pt-4">
            <Metric label="Records with geo-tagged photos" value={o.photosPct} />
            <Metric label="GPS accuracy within 50 m" value={o.gpsGoodPct} />
            <div className="flex items-center justify-between gap-2.5 rounded-xl bg-[#fdf4e7] px-3 py-2.5 text-[13px]">
              <span className="flex items-center gap-2 text-signal-text"><Icon name="alert" size={16} strokeWidth={2} />{o.mockFlags} mock-location {o.mockFlags === 1 ? 'flag' : 'flags'}</span>
              <Link href="/review" className="flex min-h-7 items-center font-medium text-signal-text underline">Review</Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-5">
        <Card className="flex min-w-0 flex-[3_1_620px] flex-col gap-3 pt-[22px] pb-2">
          <CardHeader className="px-6" title={<span className="flex items-center gap-2.5">Overdue inspections <Badge tone="signal" className="font-semibold">{o.overdue.length}</Badge></span>} actions={<Link href="/lots" className="flex min-h-11 items-center text-[13px] font-medium text-brand">View all lots</Link>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className={cx(thClass, 'pl-6')}>Lot</th>
                  <th scope="col" className={thClass}>Farmer · village</th>
                  <th scope="col" className={thClass}>Stage due</th>
                  <th scope="col" className={thClass}>Overdue</th>
                  <th scope="col" className={cx(thClass, 'pr-6')}>Field assistant</th>
                </tr>
              </thead>
              <tbody>
                {o.overdue.slice(0, 7).map((v) => (
                  <tr key={v.lot.lotId}>
                    <td className={cx(tdClass, 'pl-6')}><LotIdText lotId={v.lot.lotId} href={`/lots/${v.lot.lotId}`} /></td>
                    <td className={tdClass}><div className="font-medium">{v.farmer.name}</div><div className="text-xs text-muted">{v.village.name}, {v.village.districtName}</div></td>
                    <td className={tdClass}>{v.next?.definition.name}</td>
                    <td className={tdClass}><Badge tone={v.overdueDays >= 5 ? 'signalStrong' : v.overdueDays >= 3 ? 'signalMid' : 'signal'} className="tabular font-semibold">{fmtDays(v.overdueDays)}</Badge></td>
                    <td className={cx(tdClass, 'pr-6 text-subtle')}>{v.faName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex min-w-0 flex-[2_1_420px] flex-col gap-3 pt-[22px] pb-2">
          <CardHeader className="px-6" title="Organiser performance" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className={cx(thClass, 'pl-6')}>Organiser</th>
                  <th scope="col" className={cx(thClass, 'text-right')}>Lots</th>
                  <th scope="col" className={cx(thClass, 'text-right')}>In fence</th>
                  <th scope="col" className={cx(thClass, 'pr-6')}>Est. vs target</th>
                </tr>
              </thead>
              <tbody>
                {o.organisers.map((r) => (
                  <tr key={r.organiser.id}>
                    <td className={cx(tdClass, 'pl-6')}><div className="font-medium">{r.organiser.name}</div><div className="text-xs text-muted"><span className="font-mono">{r.organiser.code}</span> · {fmtAcres(r.areaSqm)}</div></td>
                    <td className={cx(tdClass, 'tabular text-right')}>{r.lots}</td>
                    <td className={cx(tdClass, 'tabular text-right')}>{fmtPct(r.insidePct)}</td>
                    <td className={cx(tdClass, 'pr-6')}>
                      <div className="flex items-center gap-2.5">
                        <ProgressBar className="min-w-[70px] flex-1" value={r.yieldVsTarget / 1.2} marker={1 / 1.2} color={r.yieldVsTarget >= 0.95 ? '#2f7d4e' : r.yieldVsTarget >= 0.9 ? '#7fbf93' : '#d98a2b'} />
                        <span className="tabular w-11 text-right font-medium">{fmtInt(r.yieldVsTarget * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function Kpi({ title, value, unit, sub, badge, children }: { title: string; value: string; unit?: string; sub: string; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5 rounded-[18px] px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2"><h2 className="text-[13px] font-medium text-muted">{title}</h2>{badge}</div>
      <div className="tabular text-[34px] font-semibold tracking-[-0.03em]">
        {value}
        {unit && <span className="ml-1 text-base font-medium tracking-normal text-muted">{unit}</span>}
      </div>
      <div className="flex items-end justify-between gap-3"><p className="text-[12.5px] text-muted">{sub}</p>{children}</div>
    </Card>
  );
}

function SegLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-current={active ? 'true' : undefined} className={cx('flex h-[34px] items-center rounded-[9px] px-3 text-[13px]', active ? 'bg-surface font-medium shadow-[0_1px_2px_rgba(16,32,26,0.12)]' : 'text-muted')}>
      {children}
    </Link>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-[7px]"><span className="size-2.5 rounded-[3px]" style={{ background: color }} />{label}</span>;
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
      <b className="tabular ml-auto font-semibold">{value}</b>
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]"><span>{label}</span><b className="tabular font-semibold">{fmtPct(value)}</b></div>
      <ProgressBar value={value} />
    </div>
  );
}

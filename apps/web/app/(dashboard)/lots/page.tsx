import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { ButtonLink, cx, PageHeader, Pill } from '@/components/ui/primitives';
import { listLots, STAGE_GROUPS, type StageGroupKey } from '@/lib/data/queries';
import { fmtAcresPrecise, fmtDay, fmtDays, fmtInt } from '@/lib/format';
import { STAGE_COLORS } from '@/lib/stage-colors';
import { LotsTable, type LotRow } from './lots-table';

export const metadata = { title: 'Production lots' };

const PAGE_SIZE = 20;

export default async function LotsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const group = (STAGE_GROUPS.some((g) => g.key === sp.stage) ? sp.stage : 'all') as StageGroupKey | 'all';
  const q = (sp.q ?? '').slice(0, 80);
  const requested = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  let res = listLots({ group, q, page: requested, pageSize: PAGE_SIZE });
  if (requested > res.pages) res = listLots({ group, q, page: res.pages, pageSize: PAGE_SIZE });

  const href = (over: { stage?: string; q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const stage = over.stage ?? group;
    const query = over.q ?? q;
    if (stage !== 'all') p.set('stage', stage);
    if (query) p.set('q', query);
    if (over.page && over.page > 1) p.set('page', String(over.page));
    const s = p.toString();
    return s ? `/lots?${s}` : '/lots';
  };

  const groupIndex = (key: StageGroupKey) => STAGE_GROUPS.findIndex((g) => g.key === key);
  const rows: LotRow[] = res.rows.map((v) => {
    const total = v.progress.length;
    const done = v.progress.filter((p) => p.status === 'DONE' || p.status === 'IN_PROGRESS').length;
    let due: LotRow['due'];
    if (v.lot.status === 'CLOSED') due = { text: v.finalKg !== null ? `Closed · ${fmtInt(v.finalKg)} kg` : 'Closed', tone: 'done' };
    else if (v.next && v.overdueDays > 0) due = { text: `${v.next.definition.name} · ${fmtDays(v.overdueDays)} late`, tone: 'late' };
    else if (v.next && v.next.status === 'DUE') due = { text: `${v.next.definition.name} · ${v.next.daysLate === 0 ? 'today' : fmtDay(v.next.dueOn)}`, tone: 'soon' };
    else if (v.next) due = { text: `${v.next.definition.name} · ${fmtDay(v.next.dueOn)}`, tone: 'ok' };
    else due = { text: 'All stages recorded', tone: 'done' };
    return {
      lotId: v.lot.lotId,
      cropCode: v.hybrid.cropCode,
      hybridCode: v.hybrid.hybridCode,
      farmer: v.farmer.name,
      village: `${v.village.name}, ${v.village.districtName}`,
      organiser: v.organiser.name,
      stage: v.lot.status === 'CLOSED' ? 'Closed' : v.current?.definition.name ?? 'Not started',
      stageColor: STAGE_COLORS[v.group],
      groupLabel: STAGE_GROUPS[groupIndex(v.group)]?.label ?? '',
      progress: total ? done / total : 0,
      area: fmtAcresPrecise(v.lot.contractedAreaSqm),
      due,
      fa: v.faName,
    };
  });

  const from = res.total === 0 ? 0 : (res.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(res.total, res.page * PAGE_SIZE);
  const pageNumbers = pageWindow(res.page, res.pages);

  return (
    <>
      <PageHeader
        eyebrow={`Kharif 2026 · ${fmtInt(res.all)} lots`}
        title="Production lots"
        actions={
          <>
            <form action="/lots" method="get" role="search" className="flex w-[300px] max-w-full">
              {group !== 'all' && <input type="hidden" name="stage" value={group} />}
              <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-line-strong bg-surface pr-1.5 pl-3.5 focus-within:outline-2 focus-within:outline-sky">
                <Icon name="search" size={16} strokeWidth={2} className="flex-none text-muted" />
                <span className="sr-only">Search lots</span>
                <input type="search" name="q" defaultValue={q} placeholder="Lot ID, farmer, village or FA" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
                {q && (
                  <Link href={href({ q: '', page: 1 })} aria-label="Clear search" className="flex size-8 flex-none items-center justify-center rounded-lg text-muted hover:bg-ground-2">
                    <Icon name="x" size={14} strokeWidth={2} />
                  </Link>
                )}
              </label>
            </form>
            <ButtonLink href="/admin/labels" icon="download">Export</ButtonLink>
          </>
        }
      />

      <nav aria-label="Filter by stage" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <Pill href={href({ stage: 'all', page: 1 })} active={group === 'all'}>
          All stages<span className="tabular opacity-75">{fmtInt(res.all)}</span>
        </Pill>
        {STAGE_GROUPS.map((g) => (
          <Pill key={g.key} href={href({ stage: g.key, page: 1 })} active={group === g.key}>
            <span aria-hidden="true" className="size-[9px] flex-none rounded-full border border-black/10" style={{ background: STAGE_COLORS[g.key] }} />
            {g.label}
            <span className="tabular opacity-75">{fmtInt(res.counts[g.key])}</span>
          </Pill>
        ))}
      </nav>

      <LotsTable rows={rows} key={`${group}|${q}|${res.page}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] text-muted">
          <span aria-live="polite">
            {res.total === 0 ? 'No lots match' : `Showing ${fmtInt(from)}–${fmtInt(to)} of ${fmtInt(res.total)}`}
            {q && <> for “<span className="text-ink">{q}</span>”</>}
          </span>
          {res.pages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap gap-1.5">
              <PageLink href={href({ page: res.page - 1 })} disabled={res.page <= 1} label="Previous page"><Icon name="chevronLeft" size={16} strokeWidth={2} /></PageLink>
              {pageNumbers.map((n, i) => n === null
                ? <span key={`gap${i}`} aria-hidden="true" className="flex size-11 items-center justify-center">…</span>
                : <PageLink key={n} href={href({ page: n })} current={n === res.page} label={`Page ${n}`}>{n}</PageLink>)}
              <PageLink href={href({ page: res.page + 1 })} disabled={res.page >= res.pages} label="Next page"><Icon name="chevronRight" size={16} strokeWidth={2} /></PageLink>
            </nav>
          )}
        </div>
      </LotsTable>
    </>
  );
}

function PageLink({ href, current, disabled, label, children }: { href: string; current?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  const cls = 'tabular flex size-11 items-center justify-center rounded-[10px] text-[13px]';
  if (disabled) return <span aria-disabled="true" aria-label={label} className={cx(cls, 'border border-line-strong bg-surface text-faint')}>{children}</span>;
  return (
    <Link href={href} aria-label={label} aria-current={current ? 'page' : undefined} className={cx(cls, current ? 'bg-ink font-medium text-white' : 'border border-line-strong bg-surface text-ink hover:bg-ground-3')}>
      {children}
    </Link>
  );
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pages: number): (number | null)[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push(null);
    out.push(n);
  });
  return out;
}

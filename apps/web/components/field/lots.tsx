'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { fmtDay, fmtDays } from '@/lib/format';
import { lotProgress, lotRecords, nextRound, nextStage, shortLotId, stageLabel } from '@/lib/field/progress';
import { useFieldData, useRouteParams } from '@/lib/field/use-field';
import { BundleGate, Chip, STATUS_STYLE, SubHeader } from './ui';

/* ---------- list ---------- */

export function LotsScreen() {
  const { row, outbox } = useFieldData();
  const [q, setQ] = useState('');
  const bundle = row?.data;

  const rows = useMemo(() => {
    if (!bundle) return [];
    return bundle.lots.map((lot) => {
      const progress = lotProgress(bundle, lot, outbox);
      const next = lot.status === 'CLOSED' ? undefined : nextStage(progress);
      const current = [...progress].reverse().find((p) => p.status === 'DONE' || p.status === 'IN_PROGRESS');
      const pending = outbox.filter((i) => i.record.lotId === lot.lotId && i.status !== 'rejected').length;
      return { lot, next, current, pending };
    }).sort((a, b) =>
      (b.next?.status === 'OVERDUE' ? b.next.daysLate : -999) - (a.next?.status === 'OVERDUE' ? a.next.daysLate : -999) ||
      a.lot.farmer.name.localeCompare(b.lot.farmer.name));
  }, [bundle, outbox]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => [r.lot.lotId, r.lot.farmer.name, r.lot.village.name, r.lot.cropName, r.lot.hybridCode].some((s) => s.toLowerCase().includes(needle)))
    : rows;

  return (
    <>
      <SubHeader title="My lots" back={null} subtitle={bundle ? `${bundle.lots.length} lots assigned to ${bundle.fa.name}` : undefined} />
      {row === undefined ? <BundleGate state="loading" /> : row === null ? <BundleGate state="missing" /> : (
        <div className="flex flex-1 flex-col gap-2.5 px-3.5 pt-3.5 pb-6">
          <label className="relative block">
            <span className="sr-only">Search lots</span>
            <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Farmer, village or lot ID"
              autoComplete="off"
              className="h-[50px] w-full rounded-xl border border-line-strong bg-surface pr-3.5 pl-10 text-[16px] outline-none focus:border-brand"
            />
          </label>
          <p className="px-1 text-[12.5px] text-muted">{needle ? `${shown.length} of ${rows.length} lots` : 'Most overdue first'}</p>
          {shown.length === 0 && <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[14px] text-muted">No lots match “{q}”.</p>}
          {shown.map(({ lot, next, current, pending }) => (
            <Link key={lot.lotId} href={`/field/lots/${lot.lotId}`} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3.5 active:bg-ground-3">
              <span className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-semibold">{lot.farmer.name}</span>
                {lot.status === 'CLOSED' ? <Chip className="bg-ground-2 text-muted">Closed</Chip>
                  : next?.status === 'OVERDUE' ? <Chip className={STATUS_STYLE.OVERDUE.chip}>{fmtDays(next.daysLate)} late</Chip>
                  : next?.status === 'DUE' ? <Chip className={STATUS_STYLE.DUE.chip}>Due {next.daysLate === 0 ? 'today' : fmtDay(next.dueOn)}</Chip>
                  : null}
              </span>
              <span className="text-[13px] text-subtle">{lot.village.name} · {lot.cropName} {lot.hybridCode}</span>
              <span className="text-[13px] text-subtle">
                {current ? current.definition.name : 'Not started'}
                {next && lot.status !== 'CLOSED' && <span className="text-muted"> → next: {next.definition.name}</span>}
              </span>
              <span className="flex items-center justify-between text-[12px] text-muted">
                <span className="font-mono">{lot.lotId}</span>
                {pending > 0 && <span className="font-medium text-signal-text">{pending} waiting to sync</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- one lot ---------- */

export function LotScreen() {
  const params = useRouteParams(['lotId'] as const);
  const { row, outbox } = useFieldData();

  if (!params || row === undefined) return <><SubHeader title="Lot" back="/field/lots" /><BundleGate state="loading" /></>;
  if (row === null) return <><SubHeader title="Lot" back="/field/lots" /><BundleGate state="missing" /></>;
  const bundle = row.data;
  const lot = bundle.lots.find((l) => l.lotId === params.lotId);
  if (!lot) {
    return (
      <>
        <SubHeader title="Lot" back="/field/lots" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-signal-tint text-signal-text"><Icon name="alert" size={22} /></span>
          <h2 className="text-lg font-semibold">This lot is not in your list</h2>
          <p className="font-mono text-[13px] text-muted">{params.lotId}</p>
          <p className="text-[14px] text-muted">If it was assigned to you today, sync to download it.</p>
        </div>
      </>
    );
  }

  const progress = lotProgress(bundle, lot, outbox);
  const records = lotRecords(lot, outbox);
  const closed = lot.status === 'CLOSED';

  return (
    <>
      <SubHeader title={lot.farmer.name} back="/field/lots" subtitle={<>{lot.village.name} · {lot.cropName} {lot.hybridCode} · <span className="font-mono">{shortLotId(lot.lotId)}</span></>} />
      <div className="flex flex-1 flex-col gap-3 px-3.5 pt-3.5 pb-6">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Fact label="Female sowing" value={fmtDay(lot.femaleSowingDate)} />
          <Fact label="Area" value={`${(lot.contractedAreaSqm / 4046.8564224).toFixed(2)} ac`} />
          <Fact label="Target" value={`${Math.round(lot.targetYieldKg)} kg`} />
        </div>
        <p className="px-1 font-mono text-[12.5px] text-muted">{lot.lotId}</p>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="px-4 pt-3.5 pb-2.5 text-[13px] font-semibold tracking-[0.07em] text-subtle uppercase">Stages</h2>
          <ol>
            {progress.map((p) => {
              const s = STATUS_STYLE[p.status];
              const local = records.some((r) => r.stageCode === p.definition.stageCode && r.local);
              const last = p.records.at(-1);
              const canAdd = !closed;
              const recorded = p.status === 'DONE' || p.status === 'IN_PROGRESS';
              const action = !recorded ? 'Record' : p.definition.repeatable ? `Add ${stageLabel(p.definition, nextRound(p.definition, records)).split(' · ').at(-1)}` : 'Correct';
              const when = p.status === 'OVERDUE' ? `${fmtDays(p.daysLate)} late`
                : p.status === 'DONE' || p.status === 'IN_PROGRESS' ? `${p.records.length > 1 ? `${p.records.length} records · last ` : ''}${fmtDay(last!.observedOn)}`
                : p.daysLate === 0 ? 'Due today' : `Due ${fmtDay(p.dueOn)}`;
              const body = (
                <>
                  <span className={cx('size-2.5 flex-none rounded-full', s.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{p.definition.name}</span>
                    <span className={cx('block text-[12px]', p.status === 'OVERDUE' ? 'font-medium text-signal-text' : 'text-muted')}>
                      {when}{local && <span className="text-signal-text"> · waiting to sync</span>}
                    </span>
                  </span>
                  {canAdd ? (
                    <span className={cx('flex items-center gap-1 text-[12.5px] font-medium', action === 'Correct' ? 'text-muted' : 'text-brand')}>
                      {action}
                      <Icon name="chevronRight" size={14} strokeWidth={2} />
                    </span>
                  ) : p.status === 'DONE' ? <Icon name="check" size={16} strokeWidth={2.4} className="text-brand" /> : null}
                </>
              );
              return (
                <li key={p.definition.stageCode} className="border-t border-row">
                  {canAdd ? (
                    <Link href={`/field/lots/${lot.lotId}/stage/${p.definition.stageCode}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 active:bg-ground-3">{body}</Link>
                  ) : (
                    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-2 py-2.5">
      <div className="tabular text-[15px] font-semibold">{value}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx, LotIdText } from '@/components/ui/primitives';

export interface LotRow {
  lotId: string;
  cropCode: string;
  hybridCode: string;
  farmer: string;
  village: string;
  organiser: string;
  stage: string;
  stageColor: string;
  groupLabel: string;
  /** Share of stages recorded, 0–1. */
  progress: number;
  area: string;
  due: { text: string; tone: 'late' | 'soon' | 'ok' | 'done' };
  fa: string;
}

const DUE_TONE: Record<LotRow['due']['tone'], string> = {
  late: 'bg-signal-tint font-semibold text-signal-text',
  soon: 'bg-sky-tint font-medium text-sky-text',
  ok: 'text-subtle',
  done: 'text-muted',
};

const th = 'border-b border-line-soft px-2 py-3 text-left font-medium text-muted';
const td = 'border-b border-row px-2 py-2.5';

export function LotsTable({ rows, children }: { rows: LotRow[]; children?: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  const count = selected.size;
  const allSel = rows.length > 0 && rows.every((r) => selected.has(r.lotId));
  const someSel = count > 0 && !allSel;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSel;
  }, [someSel]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(rows.map((r) => r.lotId)));

  const ids = [...selected];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ids.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      {count > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2.5 rounded-[14px] bg-ink py-2 pr-2 pl-4 text-white">
          <span className="flex-auto text-sm font-medium" aria-live="polite">{count} selected</span>
          <Link href={`/admin/labels?lots=${ids.join(',')}`} className="flex h-11 items-center gap-2 rounded-[10px] bg-leaf px-3.5 text-[13.5px] font-semibold text-forest hover:bg-[#a6e8b3]">
            <Icon name="qr" size={16} />Print QR labels
          </Link>
          <button type="button" onClick={copy} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#2b3d34] px-3.5 text-[13.5px] hover:bg-forest-3">
            <Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? 'Copied' : 'Copy lot IDs'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="flex h-11 items-center px-3 text-[13.5px] text-[#afc2b7] hover:text-white">Clear</button>
        </div>
      )}

      <section aria-label="Lots" className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-[13px]">
            <thead className="bg-ground-3">
              <tr>
                <th scope="col" className={cx(th, 'w-6 pl-5')}>
                  <label className="-m-3 flex size-11 items-center justify-center">
                    <span className="sr-only">Select all lots on this page</span>
                    <input ref={allRef} type="checkbox" checked={allSel} onChange={toggleAll} disabled={!rows.length} className="m-0 size-4 accent-brand" />
                  </label>
                </th>
                <th scope="col" className={th}>Lot ID</th>
                <th scope="col" className={th}>Hybrid</th>
                <th scope="col" className={th}>Farmer · village</th>
                <th scope="col" className={th}>Organiser</th>
                <th scope="col" className={th}>Current stage</th>
                <th scope="col" className={cx(th, 'text-right')}>Area</th>
                <th scope="col" className={th}>Next due</th>
                <th scope="col" className={cx(th, 'pr-5')}>FA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-sm text-muted">
                    No lots match these filters. <Link href="/lots" className="font-medium text-brand underline underline-offset-2">Show all lots</Link>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const on = selected.has(r.lotId);
                return (
                  <tr key={r.lotId} className={cx(on ? 'bg-brand-soft' : 'hover:bg-ground-3')}>
                    <td className={cx(td, 'pl-5')}>
                      <label className="-m-3 flex size-11 items-center justify-center">
                        <span className="sr-only">Select lot {r.lotId}</span>
                        <input type="checkbox" checked={on} onChange={() => toggle(r.lotId)} className="m-0 size-4 accent-brand" />
                      </label>
                    </td>
                    <td className={td}><LotIdText lotId={r.lotId} href={`/lots/${r.lotId}`} /></td>
                    <td className={cx(td, 'whitespace-nowrap')}>
                      <span className="mr-1.5 rounded-md bg-ground-2 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold">{r.cropCode}</span>
                      <span className="font-mono text-[12.5px]">{r.hybridCode}</span>
                    </td>
                    <td className={td}><div className="font-medium">{r.farmer}</div><div className="text-xs text-muted">{r.village}</div></td>
                    <td className={cx(td, 'text-subtle')}>{r.organiser}</td>
                    <td className={td}>
                      <div className="flex min-w-[170px] flex-col gap-[5px]" title={r.groupLabel}>
                        <span className="flex items-center gap-[7px]"><span aria-hidden="true" className="size-[9px] flex-none rounded-full border border-black/10" style={{ background: r.stageColor }} />{r.stage}</span>
                        <span className="block h-1 rounded-full bg-line-soft" role="img" aria-label={`${Math.round(r.progress * 100)}% of stages recorded`}>
                          <span className="block h-1 rounded-full bg-brand-mid" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className={cx(td, 'tabular text-right whitespace-nowrap')}>{r.area}</td>
                    <td className={td}><span className={cx('rounded-lg px-2 py-[3px] text-[12.5px] whitespace-nowrap', DUE_TONE[r.due.tone])}>{r.due.text}</span></td>
                    <td className={cx(td, 'pr-5 whitespace-nowrap text-subtle')}>{r.fa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {children}
      </section>
    </>
  );
}

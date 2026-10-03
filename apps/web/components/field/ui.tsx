'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { syncNow, useSyncState } from '@/lib/field/sync';

export function SubHeader({ title, subtitle, back = '/field', actions }: { title: ReactNode; subtitle?: ReactNode; back?: string | null; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line bg-surface py-3.5 pr-3.5 pl-2">
      {back ? (
        <Link href={back} aria-label="Back" className="flex size-11 flex-none items-center justify-center text-ink">
          <Icon name="chevronLeft" size={22} strokeWidth={2} />
        </Link>
      ) : <span className="w-2" />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[12px] text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Shown while IndexedDB loads, or when the device has never downloaded its lots. */
export function BundleGate({ state }: { state: 'loading' | 'missing' }) {
  const sync = useSyncState();
  if (state === 'loading') {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-line-soft" />)}
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-signal-tint text-signal-text"><Icon name={sync.online ? 'download' : 'wifiOff'} size={22} /></span>
      <h2 className="text-lg font-semibold">{sync.syncing ? 'Downloading your lots…' : 'Your lots are not on this phone yet'}</h2>
      <p className="text-[14px] leading-relaxed text-muted">
        Connect to the internet once to download your assigned lots. After that, everything works offline.
      </p>
      <button type="button" onClick={() => void syncNow()} disabled={sync.syncing} className="h-[50px] rounded-[14px] bg-brand px-6 text-[15px] font-semibold text-white disabled:opacity-60">
        {sync.syncing ? 'Downloading…' : 'Download now'}
      </button>
      {sync.lastError && !sync.syncing && <p className="text-[13px] text-signal-text">{sync.lastError}</p>}
    </div>
  );
}

export const STATUS_STYLE = {
  OVERDUE: { label: 'Overdue', dot: 'bg-signal-mid', chip: 'bg-signal-tint text-signal-text' },
  DUE: { label: 'Due', dot: 'bg-brand-mid', chip: 'bg-brand-tint text-brand-text' },
  IN_PROGRESS: { label: 'In progress', dot: 'bg-sky', chip: 'bg-sky-tint text-sky-text' },
  DONE: { label: 'Done', dot: 'bg-brand', chip: 'bg-ground-2 text-subtle' },
  UPCOMING: { label: 'Upcoming', dot: 'bg-line-strong', chip: 'bg-ground-2 text-muted' },
} as const;

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium', className)}>{children}</span>;
}

export function clockIST(ms: number): string {
  const d = new Date(ms + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "07:12 today", "yesterday 18:40" or "28 Sep 18:40", relative to the device clock. */
export function relativeTime(ms: number): string {
  const day = (t: number) => Math.floor((t + 5.5 * 3600_000) / 86_400_000);
  const diff = day(Date.now()) - day(ms);
  if (diff === 0) return `${clockIST(ms)} today`;
  if (diff === 1) return `yesterday ${clockIST(ms)}`;
  const d = new Date(ms + 5.5 * 3600_000);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${clockIST(ms)}`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

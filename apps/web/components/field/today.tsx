'use client';

import type { LngLat, StageCode } from '@nk/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { fmtDays } from '@/lib/format';
import { fmtDistance, todaysWork, type WorkItem } from '@/lib/field/progress';
import { useSyncState } from '@/lib/field/sync';
import { useFieldData, useQueueStats } from '@/lib/field/use-field';
import { STAGE_COLORS } from '@/lib/stage-colors';
import { BundleGate, relativeTime } from './ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Bar colour for a stage, from the dashboard's sequential stage ramp. */
const STAGE_BAR: Partial<Record<StageCode, string>> = {
  SOW_M: STAGE_COLORS.transplanting, SOW_F: STAGE_COLORS.transplanting,
  ROGUE_F_NURSERY: STAGE_COLORS.vegetative, TP_M: STAGE_COLORS.vegetative, TP_F: STAGE_COLORS.vegetative,
  VEG: STAGE_COLORS.vegetative, ROGUE_M: STAGE_COLORS.rogueing, POLL: STAGE_COLORS.pollination,
  ROGUE_F_PREMAT: STAGE_COLORS.rogueing, MAT: STAGE_COLORS.maturity, ROGUE_F_PREHARV: STAGE_COLORS.rogueing,
  YIELD_EST: STAGE_COLORS.yield, HARV: STAGE_COLORS.harvest, PLOW: STAGE_COLORS.harvest,
  SEED_COLL: STAGE_COLORS.collection, FINAL_YIELD: STAGE_COLORS.closed,
};

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function TodayScreen() {
  const { row, outbox } = useFieldData();
  const here = useHere();
  const bundle = row?.data;
  const work = useMemo(() => (bundle ? todaysWork(bundle, outbox, here.position) : null), [bundle, outbox, here.position]);

  return (
    <>
      <header className="flex flex-col gap-3.5 bg-forest px-[18px] pt-5 pb-[18px] text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px] text-[#9fb3a8]">{bundle ? `${longDate(bundle.today)} · ${bundle.season}` : 'Field work'}</p>
            <h1 className="mt-[3px] text-2xl font-semibold tracking-[-0.02em]">Today&apos;s work</h1>
          </div>
          {bundle && (
            <span aria-label={bundle.fa.name} title={bundle.fa.name} className="flex size-10 items-center justify-center rounded-full bg-[#2b5b40] text-[13px] font-semibold">{bundle.fa.initials}</span>
          )}
        </div>
        <SyncBanner />
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile value={work?.overdue.length} label="Overdue" className="text-signal-soft" />
          <Tile value={work?.dueSoon.length} label="Due this week" />
          <Tile value={work?.doneToday} label="Done today" className="text-leaf" />
        </div>
      </header>

      {row === undefined ? <BundleGate state="loading" /> : row === null ? <BundleGate state="missing" /> : work && (
        <div className="flex flex-1 flex-col gap-2.5 px-3.5 pt-4 pb-6">
          <SectionHead title="Overdue" tone="signal" right={work.overdue.length > 0 && <SortNote here={here} />} />
          {work.overdue.length === 0 && <EmptyRow text="Nothing overdue. Well done." />}
          {work.overdue.map((w) => <WorkCard key={w.lot.lotId} item={w} overdue />)}

          <SectionHead title="Due this week" right={work.overdue.length === 0 && work.dueSoon.length > 0 && <SortNote here={here} />} />
          {work.dueSoon.length === 0 && <EmptyRow text="No stages due in the next 7 days." />}
          {work.dueSoon.map((w) => <WorkCard key={w.lot.lotId} item={w} />)}
        </div>
      )}
    </>
  );
}

function Tile({ value, label, className }: { value: number | undefined; label: string; className?: string }) {
  return (
    <div className="rounded-xl bg-forest-2 px-1.5 py-2.5">
      <div className={cx('tabular text-[22px] font-semibold', className)}>{value ?? '–'}</div>
      <div className="text-[11.5px] text-[#9fb3a8]">{label}</div>
    </div>
  );
}

function SectionHead({ title, tone, right }: { title: string; tone?: 'signal'; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between px-1 pt-1">
      <h2 className={cx('text-[13px] font-semibold tracking-[0.07em] uppercase', tone === 'signal' ? 'text-signal-text' : 'text-subtle')}>{title}</h2>
      {right}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-4 text-[14px] text-muted">{text}</p>;
}

function WorkCard({ item, overdue }: { item: WorkItem; overdue?: boolean }) {
  const { lot, progress } = item;
  const days = progress.daysLate;
  const when = overdue ? `${fmtDays(days)} late` : days === 0 ? 'Due today' : `in ${fmtDays(-days)}`;
  return (
    <Link
      href={`/field/lots/${lot.lotId}/stage/${progress.definition.stageCode}`}
      className={cx('flex gap-3 rounded-2xl border bg-surface p-3.5 text-ink active:bg-ground-3', overdue ? 'border-[#f3d7ae]' : 'border-line')}
    >
      <span className="w-1.5 flex-none rounded-full" style={{ background: overdue ? '#d98a2b' : STAGE_BAR[progress.definition.stageCode] ?? '#7fbf93' }} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex justify-between gap-2">
          <span className="text-[15px] font-semibold">{item.label}</span>
          <span className={cx('text-[12px] whitespace-nowrap', overdue ? 'font-semibold text-signal-text' : 'text-muted')}>{when}</span>
        </span>
        <span className="text-[13px] text-subtle">{lot.farmer.name} · {lot.village.name}</span>
        <span className="flex justify-between text-[12px] text-muted">
          <span className="font-mono">{lot.lotId}</span>
          <span>{fmtDistance(item.distanceM)}</span>
        </span>
      </span>
    </Link>
  );
}

function SyncBanner() {
  const sync = useSyncState();
  const stats = useQueueStats();
  const pending = stats?.pending ?? 0;
  const rejected = stats?.rejected ?? 0;
  const photos = stats?.photos ?? 0;
  const waiting = `${pending} ${pending === 1 ? 'record' : 'records'}, ${photos} ${photos === 1 ? 'photo' : 'photos'}`;

  let icon: 'wifiOff' | 'sync' | 'check' | 'alert' = 'check';
  let iconClass = 'text-leaf';
  let text: React.ReactNode;
  if (!sync.online) {
    icon = 'wifiOff'; iconClass = 'text-signal-soft';
    text = pending + photos > 0 ? <>Offline · <b className="font-semibold text-white">{waiting}</b> waiting</> : <>Offline · all your work is saved on this phone</>;
  } else if (rejected > 0) {
    icon = 'alert'; iconClass = 'text-signal-soft';
    text = <><b className="font-semibold text-white">{rejected} {rejected === 1 ? 'record needs' : 'records need'} attention</b> · see Sync</>;
  } else if (sync.syncing) {
    icon = 'sync'; iconClass = 'text-leaf animate-spin [animation-duration:2s]';
    text = pending + photos > 0 ? <>Syncing <b className="font-semibold text-white">{waiting}</b>…</> : <>Checking for updates…</>;
  } else if (pending + photos > 0) {
    icon = 'sync'; iconClass = 'text-signal-soft';
    text = <><b className="font-semibold text-white">{waiting}</b> waiting{sync.lastError ? ' · will retry' : ''}</>;
  } else {
    text = <>All records synced{sync.lastSyncAt ? ` · ${relativeTime(sync.lastSyncAt)}` : ''}</>;
  }

  return (
    <Link href="/field/sync" className="flex min-h-11 items-center gap-2.5 rounded-xl bg-forest-3 px-3 py-2.5 text-[13px] text-[#dce7e0]">
      <Icon name={icon} size={16} strokeWidth={2} className={iconClass} />
      <span className="flex-1">{text}</span>
      <Icon name="chevronRight" size={14} strokeWidth={2} />
    </Link>
  );
}

/* ---------- position for "sorted by distance" ---------- */

interface Here {
  position: LngLat | null;
  status: 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable';
  locate: () => void;
}

function useHere(): Here {
  const [position, setPosition] = useState<LngLat | null>(null);
  const [status, setStatus] = useState<Here['status']>('idle');

  const locate = () => {
    if (!('geolocation' in navigator)) { setStatus('unavailable'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setStatus('ok'); },
      (e) => setStatus(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 },
    );
  };

  useEffect(() => {
    // Only locate automatically when permission is already granted: no prompt on page load.
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((p) => { if (p.state === 'granted') locate(); })
      .catch(() => {});
  }, []);

  return { position, status, locate };
}

function SortNote({ here }: { here: Here }) {
  if (here.status === 'ok') return <span className="text-[12px] text-muted">Sorted by distance</span>;
  if (here.status === 'locating') return <span className="text-[12px] text-muted">Finding you…</span>;
  if (here.status === 'denied' || here.status === 'unavailable') return <span className="text-[12px] text-muted">Most late first</span>;
  return (
    <button type="button" onClick={here.locate} className="-my-2 flex min-h-11 items-center gap-1.5 text-[12.5px] font-medium text-brand">
      <Icon name="locate" size={14} strokeWidth={2} /> Sort by distance
    </button>
  );
}

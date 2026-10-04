'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { fieldDb, useLive } from '@/lib/field/db';
import { shortLotId } from '@/lib/field/progress';
import { discardRejected, photoUploadAllowed, readWifiOnly, requeue, syncNow, useSyncState, writeWifiOnly } from '@/lib/field/sync';
import { useFieldData, useQueueStats } from '@/lib/field/use-field';
import { fmtBytes, relativeTime, SubHeader } from './ui';

export function SyncScreen() {
  const sync = useSyncState();
  const stats = useQueueStats();
  const { row, outbox } = useFieldData();
  const photoMeta = useLive(async () => (await fieldDb().photos.toArray()).map((p) => ({ id: p.id, recordUuid: p.recordUuid, lotId: p.lotId, size: p.size, createdAt: p.createdAt })));
  const [wifiOnly, setWifiOnly] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setWifiOnly(readWifiOnly()), []);
  useEffect(() => {
    if (!sync.retryAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sync.retryAt]);

  const pending = stats?.pending ?? 0;
  const rejected = stats?.rejected ?? 0;
  const photos = stats?.photos ?? 0;
  const items = useMemo(() => [...outbox].sort((a, b) => (a.status === 'rejected' ? -1 : 0) - (b.status === 'rejected' ? -1 : 0) || b.createdAt - a.createdAt), [outbox]);
  const waitingRecord = new Set(outbox.map((i) => i.recordUuid));
  const loosePhotos = (photoMeta ?? []).filter((p) => !waitingRecord.has(p.recordUuid));
  const photosBlocked = loosePhotos.length > 0 && typeof navigator !== 'undefined' && !photoUploadAllowed();

  let title: string;
  let icon: 'wifiOff' | 'sync' | 'check' | 'alert';
  if (!sync.online) { title = 'No connection'; icon = 'wifiOff'; }
  else if (sync.syncing) { title = 'Syncing…'; icon = 'sync'; }
  else if (sync.lastError && pending + photos > 0) { title = 'Could not sync'; icon = 'alert'; }
  else if (pending + photos > 0) { title = 'Waiting to sync'; icon = 'sync'; }
  else { title = 'Everything is synced'; icon = 'check'; }
  const good = icon === 'check';

  const retryIn = sync.retryAt ? Math.max(0, Math.round((sync.retryAt - now) / 1000)) : null;

  return (
    <>
      <SubHeader title="Sync" />
      <div className="flex flex-1 flex-col gap-3.5 px-3.5 pt-4 pb-6">
        <section className="flex flex-col gap-4 rounded-[20px] bg-forest p-5 text-white">
          <div className="flex items-center gap-3">
            <span className={cx('flex size-[46px] flex-none items-center justify-center rounded-full', good ? 'bg-forest-3 text-leaf' : 'bg-[#3a2a12] text-signal-soft')}>
              <Icon name={icon} size={22} strokeWidth={2} className={sync.syncing ? 'animate-spin [animation-duration:2s]' : undefined} />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-semibold">{title}</div>
              <div className="text-[13px] text-[#9fb3a8]">
                {sync.lastSyncAt ? `Last synced ${relativeTime(sync.lastSyncAt)}` : 'Not synced from this phone yet'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-forest-2 p-3">
              <div className="tabular text-[26px] font-semibold">{pending}</div>
              <div className="text-[12px] text-[#9fb3a8]">Records waiting</div>
            </div>
            <div className="rounded-[14px] bg-forest-2 p-3">
              <div className="tabular text-[26px] font-semibold">{photos}</div>
              <div className="text-[12px] text-[#9fb3a8]">Photos waiting{photos > 0 ? ` · ${fmtBytes(stats?.photoBytes ?? 0)}` : ''}</div>
            </div>
          </div>
          {sync.lastError && !sync.syncing && (
            <p className="text-[12.5px] text-signal-soft">
              {sync.online ? friendlySyncError(sync.lastError) : 'The phone is offline.'}{retryIn !== null ? ` Trying again in ${retryIn} s.` : ''}
            </p>
          )}
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={sync.syncing}
            className="h-[50px] rounded-[14px] bg-leaf text-[15px] font-semibold text-forest disabled:opacity-70"
          >
            {sync.syncing ? 'Syncing…' : sync.lastError || !sync.online ? 'Retry now' : 'Sync now'}
          </button>
        </section>

        <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span>
            <span className="block text-[14px] font-medium">Upload photos on Wi-Fi only</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">Records still sync on mobile data</span>
          </span>
          <input
            type="checkbox"
            checked={wifiOnly}
            onChange={(e) => { setWifiOnly(e.target.checked); writeWifiOnly(e.target.checked); if (!e.target.checked) void syncNow(); }}
            className="m-0 size-[22px] flex-none accent-brand"
          />
        </label>
        {photosBlocked && <p className="-mt-1.5 px-1 text-[12.5px] text-signal-text">{loosePhotos.length} {loosePhotos.length === 1 ? 'photo is' : 'photos are'} waiting for Wi-Fi.</p>}

        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="px-4 pt-3.5 pb-2.5 text-[13px] font-semibold tracking-[0.07em] text-subtle uppercase">Queue</h2>
          {items.length === 0 && loosePhotos.length === 0 && (
            <p className="border-t border-row px-4 py-4 text-[14px] text-muted">Nothing waiting. New records appear here until the server confirms them.</p>
          )}
          {items.map((i) => (
            <div key={i.recordUuid} className="flex flex-col gap-2 border-t border-row px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={cx('size-2.5 flex-none rounded-full', i.status === 'rejected' ? 'bg-signal' : i.status === 'syncing' ? 'bg-sky' : 'bg-signal-mid')} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{i.stageName}</div>
                  <div className="truncate text-[12px] text-muted">
                    {i.farmerName} · <span className="font-mono">{shortLotId(i.record.lotId)}</span> · {relativeTime(i.createdAt)}
                  </div>
                </div>
                <span className={cx('text-[12px] whitespace-nowrap', i.status === 'rejected' ? 'font-medium text-signal-text' : 'text-muted')}>
                  {i.status === 'rejected' ? 'Rejected' : i.status === 'syncing' ? 'Sending…' : i.photoCount ? `${i.photoCount} ${i.photoCount === 1 ? 'photo' : 'photos'}` : 'No photos'}
                </span>
              </div>
              {i.status === 'rejected' && (
                <div className="ml-[22px] flex flex-col gap-2 rounded-xl bg-signal-tint px-3 py-2.5">
                  <p className="text-[13px] text-signal-text">{i.reason ?? 'The server did not accept this record.'}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void requeue(i.recordUuid)} className="h-11 flex-1 rounded-xl border border-line-strong bg-surface text-[13.5px] font-medium">Send again</button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('Discard this record and its photos from the phone? This cannot be undone.')) void discardRejected(i.recordUuid); }}
                      className="h-11 flex-1 rounded-xl border-[1.5px] border-signal bg-surface text-[13.5px] font-medium text-signal-text"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loosePhotos.length > 0 && (
            <div className="flex items-center gap-3 border-t border-row px-4 py-3">
              <span className="size-2.5 flex-none rounded-full bg-signal-mid" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">Photos for synced records</div>
                <div className="text-[12px] text-muted">{new Set(loosePhotos.map((p) => p.lotId)).size} lots · {fmtBytes(loosePhotos.reduce((a, p) => a + p.size, 0))}</div>
              </div>
              <span className="text-[12px] whitespace-nowrap text-muted">{loosePhotos.length} {loosePhotos.length === 1 ? 'photo' : 'photos'}</span>
            </div>
          )}
        </section>

        <p className="px-1 text-[12px] leading-normal text-muted">
          Records are kept on this phone until the server confirms them.
          {row?.fetchedAt ? ` Lot list downloaded ${relativeTime(row.fetchedAt)}.` : ''}
        </p>

        <form action="/api/auth/logout" method="post" className="flex flex-col gap-1.5 pt-2">
          <button
            type="submit"
            disabled={pending + rejected > 0}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-[14px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
          {pending + rejected > 0 && <p className="text-center text-[12px] text-muted">Signing out is blocked while records are waiting to sync.</p>}
        </form>
      </div>
    </>
  );
}

/** Network failures surface as the browser's own wording ("Failed to fetch", "Load failed"); show plain language instead. */
function friendlySyncError(err: string | null) {
  if (!err || /fetch|network|load failed/i.test(err)) return 'Could not reach the server.';
  return /[.!?]$/.test(err) ? err : `${err}.`;
}

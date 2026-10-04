'use client';

import type { SyncPushResult } from '@nk/shared';
import { useSyncExternalStore } from 'react';
import { cachedBundle, deviceId, fieldDb, getMeta, setMeta } from './db';
import type { BundleRecord, FieldBundle, OutboxItem } from './types';

/* ---------- sync status, shared by every screen ---------- */

export interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  /** When the next automatic retry is scheduled, if any. */
  retryAt: number | null;
}

let state: SyncState = { online: true, syncing: false, lastSyncAt: null, lastError: null, retryAt: null };
const listeners = new Set<() => void>();
const SERVER_STATE: SyncState = state;

function update(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => SERVER_STATE,
  );
}

/* ---------- settings ---------- */

const WIFI_ONLY_KEY = 'nk.field.photosWifiOnly';

export function readWifiOnly(): boolean {
  try {
    return window.localStorage.getItem(WIFI_ONLY_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeWifiOnly(v: boolean): void {
  try {
    window.localStorage.setItem(WIFI_ONLY_KEY, v ? '1' : '0');
  } catch {
    // Storage blocked: the setting lasts for this session only.
  }
}

type NetInfo = { type?: string; saveData?: boolean };
/** True when photo uploads are allowed on the current connection. Unknown types count as Wi-Fi. */
export function photoUploadAllowed(): boolean {
  if (!readWifiOnly()) return true;
  const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (!conn?.type) return true;
  return conn.type === 'wifi' || conn.type === 'ethernet';
}

/* ---------- pull ---------- */

export interface PullResult {
  bundle: FieldBundle | null;
  fetchedAt: number | null;
  fromCache: boolean;
}

/** Fetches the offline bundle and stores it. Falls back to the cached copy when offline. */
export async function pullBundle(): Promise<PullResult> {
  try {
    const res = await fetch('/api/field/bundle', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Bundle request failed (${res.status})`);
    const data = (await res.json()) as FieldBundle;
    if (data.version !== 1 || !Array.isArray(data.lots)) throw new Error('Unexpected bundle format');
    const fetchedAt = Date.now();
    await fieldDb().bundle.put({ key: 'current', data, fetchedAt });
    return { bundle: data, fetchedAt, fromCache: false };
  } catch {
    const cached = await cachedBundle();
    return { bundle: cached?.data ?? null, fetchedAt: cached?.fetchedAt ?? null, fromCache: true };
  }
}

/* ---------- push ---------- */

export interface PushOutcome {
  ok: boolean;
  accepted: number;
  rejected: number;
  error?: string;
}

/** Adds confirmed records to the cached bundle, so progress is right before the next pull. */
async function mergeIntoBundle(items: OutboxItem[]) {
  const d = fieldDb();
  await d.transaction('rw', d.bundle, async () => {
    const row = await d.bundle.get('current');
    if (!row) return;
    for (const item of items) {
      const lot = row.data.lots.find((l) => l.lotId === item.record.lotId);
      if (!lot || lot.records.some((r) => r.recordUuid === item.recordUuid)) continue;
      const r: BundleRecord = {
        recordUuid: item.recordUuid,
        stageCode: item.record.stageCode,
        roundNo: item.record.roundNo,
        observedOn: item.record.observedOn,
        insideGeofence: item.record.insideGeofence,
        reviewStatus: 'NONE',
      };
      lot.records.push(r);
    }
    await d.bundle.put(row);
  });
}

let pushing: Promise<PushOutcome> | null = null;

/** Sends every pending record. Accepted records leave the outbox; rejected ones stay with the reason. */
export function pushOutbox(): Promise<PushOutcome> {
  pushing ??= doPush().finally(() => { pushing = null; });
  return pushing;
}

async function doPush(): Promise<PushOutcome> {
  const d = fieldDb();
  // 'syncing' left over from a closed tab counts as pending.
  const items = (await d.outbox.toArray()).filter((i) => i.status !== 'rejected').sort((a, b) => a.createdAt - b.createdAt);
  if (items.length === 0) return { ok: true, accepted: 0, rejected: 0 };
  const uuids = items.map((i) => i.recordUuid);
  await d.outbox.where('recordUuid').anyOf(uuids).modify({ status: 'syncing' });

  let result: SyncPushResult;
  try {
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        deviceId: await deviceId(),
        lastPulledAt: (await cachedBundle())?.data.serverTime ?? 0,
        changes: { stageRecords: { created: items.map((i) => i.record) } },
      }),
    });
    if (!res.ok) {
      const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      throw new Error(msg ?? `Server answered ${res.status}`);
    }
    result = (await res.json()) as SyncPushResult;
  } catch (err) {
    await d.outbox.where('recordUuid').anyOf(uuids).modify((i) => { i.status = 'pending'; i.attempts += 1; });
    return { ok: false, accepted: 0, rejected: 0, error: err instanceof Error ? err.message : 'Network error' };
  }

  const accepted = new Set(result.accepted);
  const rejected = new Map(result.rejected.map((r) => [r.recordUuid, r.reason]));
  const acceptedItems = items.filter((i) => accepted.has(i.recordUuid));
  await mergeIntoBundle(acceptedItems);
  await d.transaction('rw', d.outbox, async () => {
    for (const item of items) {
      if (accepted.has(item.recordUuid)) await d.outbox.delete(item.recordUuid);
      else if (rejected.has(item.recordUuid)) await d.outbox.update(item.recordUuid, { status: 'rejected', reason: rejected.get(item.recordUuid), attempts: item.attempts + 1 });
      // Not mentioned in the answer: keep it for the next attempt.
      else await d.outbox.update(item.recordUuid, { status: 'pending', attempts: item.attempts + 1 });
    }
  });
  await setMeta('lastSyncAt', result.serverTime);
  return { ok: true, accepted: acceptedItems.length, rejected: rejected.size };
}

/* ---------- photos ---------- */

/** Uploads photos whose record the server has confirmed. Photos follow data (SPECS §3.6). */
export async function uploadPhotos(): Promise<{ uploaded: number; skipped: boolean }> {
  if (!photoUploadAllowed()) return { uploaded: 0, skipped: true };
  const d = fieldDb();
  const waiting = new Set((await d.outbox.toArray()).map((i) => i.recordUuid));
  const ids = (await d.photos.orderBy('createdAt').primaryKeys()) as string[];
  let uploaded = 0;
  for (const id of ids) {
    const photo = await d.photos.get(id);
    if (!photo || waiting.has(photo.recordUuid)) continue;
    const res = await fetch(`/api/sync/photos?id=${photo.id}&record=${photo.recordUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      credentials: 'same-origin',
      body: photo.blob,
    });
    if (!res.ok) throw new Error(`Photo upload failed (${res.status})`);
    await d.photos.delete(photo.id);
    uploaded++;
  }
  return { uploaded, skipped: false };
}

/* ---------- orchestration ---------- */

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let running: Promise<void> | null = null;

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  // 5 s, 10 s, 20 s … capped at 5 minutes.
  const delay = Math.min(300_000, 5_000 * 2 ** Math.min(failures, 6));
  update({ retryAt: Date.now() + delay });
  retryTimer = setTimeout(() => { retryTimer = null; void syncNow(); }, delay);
}

/** Push records, upload photos, then refresh the bundle. Safe to call at any time. */
export function syncNow(): Promise<void> {
  running ??= runSync().finally(() => { running = null; });
  return running;
}

async function runSync() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  update({ syncing: true, retryAt: null, online: navigator.onLine });
  let error: string | null = null;
  try {
    const push = await pushOutbox();
    if (!push.ok) error = push.error ?? 'Could not reach the server';
    else {
      try {
        await uploadPhotos();
      } catch (e) {
        error = e instanceof Error ? e.message : 'Photo upload failed';
      }
      const pull = await pullBundle();
      if (pull.fromCache && !error) error = 'Could not refresh lots';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Sync failed';
  }
  const lastSyncAt = (await getMeta<number>('lastSyncAt').catch(() => undefined)) ?? null;
  update({ syncing: false, lastError: error, lastSyncAt });

  const pending = await fieldDb().outbox.where('status').notEqual('rejected').count();
  const photos = await fieldDb().photos.count();
  if (error && (pending > 0 || photos > 0 || error === 'Could not refresh lots')) {
    failures++;
    scheduleRetry();
  } else {
    failures = 0;
  }
}

let started = false;

/** Starts automatic sync: on app open, when the connection returns, and when the app is shown again. */
export function startAutoSync(): () => void {
  if (started) return () => {};
  started = true;
  update({ online: navigator.onLine });
  void getMeta<number>('lastSyncAt').then((v) => update({ lastSyncAt: v ?? null })).catch(() => {});
  // Ask the browser not to evict the outbox under storage pressure.
  void navigator.storage?.persist?.().catch(() => false);

  const onOnline = () => { update({ online: true }); failures = 0; void syncNow(); };
  const onOffline = () => update({ online: false });
  const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine) void syncNow(); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  void syncNow();

  return () => {
    started = false;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    if (retryTimer) clearTimeout(retryTimer);
  };
}

/** Writes a record and its photos to the device in one transaction, then tries to send it. */
export async function saveToOutbox(item: OutboxItem, photos: { id: string; blob: Blob; width: number; height: number }[]): Promise<void> {
  const d = fieldDb();
  await d.transaction('rw', d.outbox, d.photos, async () => {
    await d.outbox.add(item);
    await d.photos.bulkAdd(photos.map((p) => ({
      id: p.id, recordUuid: item.recordUuid, lotId: item.record.lotId, blob: p.blob, size: p.blob.size, width: p.width, height: p.height, createdAt: Date.now(),
    })));
  });
  if (navigator.onLine) void syncNow();
}

/** Puts a rejected record back in the queue (e.g. after the lot was reassigned). */
export async function requeue(recordUuid: string): Promise<void> {
  await fieldDb().outbox.update(recordUuid, { status: 'pending', reason: undefined });
  if (navigator.onLine) void syncNow();
}

/** Discards a rejected record and its photos. Only offered for records the server refused. */
export async function discardRejected(recordUuid: string): Promise<void> {
  const d = fieldDb();
  await d.transaction('rw', d.outbox, d.photos, async () => {
    const item = await d.outbox.get(recordUuid);
    if (item?.status !== 'rejected') return;
    await d.outbox.delete(recordUuid);
    await d.photos.where('recordUuid').equals(recordUuid).delete();
  });
}

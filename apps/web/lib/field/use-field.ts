'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { fieldDb, queueStats, useLive, type BundleRow, type QueueStats } from './db';
import type { OutboxItem } from './types';

export interface FieldData {
  /** `undefined` while IndexedDB is being read; `null` when nothing has been downloaded yet. */
  row: BundleRow | null | undefined;
  outbox: OutboxItem[];
}

export function useFieldData(): FieldData {
  const row = useLive(async () => (await fieldDb().bundle.get('current')) ?? null);
  const outbox = useLive(() => fieldDb().outbox.toArray());
  return { row, outbox: outbox ?? [] };
}

export function useQueueStats(): QueueStats | undefined {
  return useLive(queueStats);
}

/**
 * Route params for pages that can be served offline from a cached template (`_` segments).
 * The service worker answers any `/field/lots/…` navigation with that template, so the real
 * values are read from the address bar after mount.
 */
export function useRouteParams<K extends string>(names: readonly K[]): Record<K, string> | null {
  const params = useParams<Record<K, string>>();
  const [fromLocation, setFromLocation] = useState<Record<K, string> | null>(null);
  const fromParams = names.every((n) => params?.[n] && params[n] !== '_');
  useEffect(() => {
    if (fromParams) return;
    // /field/lots/<lotId>[/stage/<stageCode>]
    const seg = window.location.pathname.split('/').filter(Boolean);
    const values: Record<string, string> = {};
    if (seg[1] === 'lots' && seg[2]) values.lotId = decodeURIComponent(seg[2]);
    if (seg[3] === 'stage' && seg[4]) values.stageCode = decodeURIComponent(seg[4]);
    setFromLocation(values as Record<K, string>);
  }, [fromParams]);
  if (fromParams) return Object.fromEntries(names.map((n) => [n, decodeURIComponent(params[n])])) as Record<K, string>;
  return fromLocation;
}

/* ---------- flash toast ---------- */

let flash: { id: number; text: string; tone: 'ok' | 'warn' } | null = null;
const flashListeners = new Set<() => void>();

export function showToast(text: string, tone: 'ok' | 'warn' = 'ok') {
  flash = { id: Date.now(), text, tone };
  for (const l of flashListeners) l();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => { flashListeners.add(l); return () => flashListeners.delete(l); },
    () => flash,
    () => null,
  );
}

export function clearToast() {
  flash = null;
  for (const l of flashListeners) l();
}

'use client';

import Dexie, { liveQuery, type EntityTable } from 'dexie';
import { useEffect, useState } from 'react';
import type { FieldBundle, OutboxItem, PhotoItem } from './types';

export interface BundleRow {
  key: 'current';
  data: FieldBundle;
  fetchedAt: number;
}

export interface MetaRow {
  key: string;
  value: string | number;
}

export type FieldDB = Dexie & {
  bundle: EntityTable<BundleRow, 'key'>;
  outbox: EntityTable<OutboxItem, 'recordUuid'>;
  photos: EntityTable<PhotoItem, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

let instance: FieldDB | null = null;

/** The device store (IndexedDB). Records live here until the server confirms them. */
export function fieldDb(): FieldDB {
  if (instance) return instance;
  const d = new Dexie('nireekshanam-field') as FieldDB;
  d.version(1).stores({
    bundle: 'key',
    outbox: 'recordUuid, status, createdAt, record.lotId',
    photos: 'id, recordUuid, createdAt',
    meta: 'key',
  });
  instance = d;
  return d;
}

export async function getMeta<T extends string | number>(key: string): Promise<T | undefined> {
  return (await fieldDb().meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: string | number): Promise<void> {
  await fieldDb().meta.put({ key, value });
}

/** A stable ID for this browser install, kept with the records it identifies. */
export async function deviceId(): Promise<string> {
  const existing = await getMeta<string>('deviceId');
  if (existing) return existing;
  const id = `web-${crypto.randomUUID().slice(0, 8)}`;
  await setMeta('deviceId', id);
  return id;
}

export async function cachedBundle(): Promise<BundleRow | undefined> {
  return fieldDb().bundle.get('current');
}

/**
 * Subscribes a component to a Dexie query; re-renders when the tables it reads change.
 * Returns `undefined` until the first result arrives.
 */
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(() => v),
      error: () => setValue(undefined),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export interface QueueStats {
  pending: number;
  rejected: number;
  photos: number;
  photoBytes: number;
}

export async function queueStats(): Promise<QueueStats> {
  const d = fieldDb();
  const [items, photos] = await Promise.all([d.outbox.toArray(), d.photos.toArray()]);
  return {
    pending: items.filter((i) => i.status !== 'rejected').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    photos: photos.length,
    photoBytes: photos.reduce((a, p) => a + p.size, 0),
  };
}

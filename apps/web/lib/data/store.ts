import { buildDataset } from './seed';
import type { Dataset } from './types';

/**
 * In-memory store for the demo build. Writes (review decisions, synced records) live for the
 * lifetime of the server process. Swap for the Postgres repository in `db/` for production.
 */
const globalForStore = globalThis as unknown as { __nkDataset?: Dataset };

export function db(): Dataset {
  globalForStore.__nkDataset ??= buildDataset();
  return globalForStore.__nkDataset;
}

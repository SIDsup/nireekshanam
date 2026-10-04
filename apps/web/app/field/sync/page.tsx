import { SyncScreen } from '@/components/field/sync-screen';

export const metadata = { title: 'Sync' };

/** Sync status (M-11): pending records and photos, last sync, manual retry. */
export default function FieldSyncPage() {
  return <SyncScreen />;
}

import { StageFormScreen } from '@/components/field/stage-form';

export const metadata = { title: 'Stage entry' };

/**
 * Stage entry form (M-08), rendered on the device from the stage definition in the offline
 * bundle. The page reads its lot and stage from the URL on the client, so the service worker
 * can serve one cached copy (`/field/lots/_/stage/_`) for every lot when offline.
 */
export default function StageEntryPage() {
  return <StageFormScreen />;
}

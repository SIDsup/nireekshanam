import { LotScreen } from '@/components/field/lots';

export const metadata = { title: 'Lot' };

/** Lot timeline (M-07). Reads the lot from the URL on the client so one cached copy serves every lot offline. */
export default function FieldLotPage() {
  return <LotScreen />;
}

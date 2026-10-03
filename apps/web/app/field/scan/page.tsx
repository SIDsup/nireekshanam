import { ScanScreen } from '@/components/field/scan';

export const metadata = { title: 'Scan QR' };

/** Open a lot by scanning its QR label (M-06), with manual entry as the fallback. */
export default function FieldScanPage() {
  return <ScanScreen />;
}

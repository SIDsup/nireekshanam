import Link from 'next/link';
import { BrandMark, Icon } from '@/components/ui/icon';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-forest px-6 text-forest-text">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <BrandMark size={48} />
        <span className="flex size-12 items-center justify-center rounded-full bg-[#3a2a12] text-signal-soft"><Icon name="wifiOff" size={22} /></span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-white">You are offline</h1>
        <p className="text-[15px] leading-relaxed">This page has not been saved on this device yet. Field work keeps running offline, and records sync when you are back online.</p>
        <Link href="/field" className="flex h-12 items-center justify-center rounded-[14px] bg-leaf px-6 text-[15px] font-semibold text-forest">Open field app</Link>
      </div>
    </main>
  );
}
